<script lang="ts">
import { onMount } from 'svelte';
import { syncGroupIndicator } from '$lib/chat/group';
import { handleSubmit } from '$lib/chat/helpers';
import { deEmojify } from '$lib/emoji';
import chatModule from '$lib/legacy/chat';
import fileHandlerModule from '$lib/legacy/fileHandler';
import groupModule from '$lib/legacy/group';
import sessionModule from '$lib/legacy/sessions';
import uiModule from '$lib/legacy/ui';
import { updatePlusDot } from '$lib/overflow';

const _DEOJ_SKIP = '.sources-section, .thinking-toggle, .memory-used-pill';

/**
 * @param {string} id
 */
function el(id: string) {
  return document.getElementById(id);
}

onMount(() => {
  // Message count in the header — recount on any DOM change in
  // #chat-history and write "· N msgs" next to the title. Counts top-
  // level .msg elements (one per user/assistant turn); excludes the
  // welcome screen since it isn't inside chat-history.
  const _metaCountEl = document.getElementById('current-meta-count');
  const _chatHistEl = document.getElementById('chat-history');
  if (_metaCountEl && _chatHistEl) {
    let _countScheduled = false;
    const _updateMsgCount = () => {
      _countScheduled = false;
      const n = _chatHistEl.querySelectorAll(':scope > .msg').length;
      _metaCountEl.textContent = n ? `· ${n} msg${n === 1 ? '' : 's'}` : '';
    };
    const _scheduleCount = () => {
      if (_countScheduled) return;
      _countScheduled = true;
      requestAnimationFrame(_updateMsgCount);
    };
    new MutationObserver(_scheduleCount).observe(_chatHistEl, {
      childList: true,
    });
    _updateMsgCount();
  }

  // Scrolling
  document.getElementById('chat-history').addEventListener(
    'scroll',
    uiModule.debounce(() => {
      const box = document.getElementById('chat-history');
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      uiModule.setAutoScroll(atBottom);
    }, 100),
  );
  // Close all footer popups immediately on any scroll
  document.getElementById('chat-history').addEventListener(
    'scroll',
    () => {
      document
        .querySelectorAll('.ctx-popup, .memory-used-detail, .msg-overflow-menu')
        .forEach((p) => p.remove());
      document.querySelectorAll('.memory-used-pill').forEach((p) => {
        p._openDetail = null;
      });
    },
    { passive: true },
  );

  document.getElementById('chat-history').addEventListener('wheel', (e) => {
    // Only disable auto-scroll when user scrolls UP (deltaY < 0)
    if (e.deltaY < 0) uiModule.setAutoScroll(false);
  });
  let _touchThrottled = false;
  document.getElementById('chat-history').addEventListener(
    'touchmove',
    () => {
      if (_touchThrottled) return;
      _touchThrottled = true;
      uiModule.setAutoScroll(false);
      requestAnimationFrame(() => {
        _touchThrottled = false;
      });
    },
    { passive: true },
  );

  // Internal #session-id links from AI search results
  document.getElementById('chat-history').addEventListener('click', (e) => {
    const link = e.target.closest('a.chat-link');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href && href.startsWith('#') && sessionModule) {
      e.preventDefault();
      sessionModule.selectSession(href.slice(1));
    }
  });
  // Export: PDF
  const exportPdfBtn = el('export-pdf-btn');
  const exportMenu = document.getElementById('export-dropdown-menu');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.remove('open');
      const meta = sessionModule
        .getSessions()
        .find((s) => s.id === sessionModule.getCurrentSessionId());
      const sessionName = meta ? meta.name : 'Odysseus Chat';
      const originalTitle = document.title;
      document.title = sessionName;
      const chatHistory = document.getElementById('chat-history');
      if (chatHistory) chatHistory.dataset.printTitle = sessionName;
      document
        .querySelectorAll('#chat-history details:not([open])')
        .forEach((d) => {
          d.setAttribute('open', '');
          d.dataset.printOpened = '1';
        });
      window.print();
      document.title = originalTitle;
      document
        .querySelectorAll('#chat-history details[data-print-opened]')
        .forEach((d) => {
          d.removeAttribute('open');
          d.removeAttribute('data-print-opened');
        });
    });
  }
  document.addEventListener('overflow-state-change', () => updatePlusDot());

  // ── Prevent toolbar buttons from stealing focus (avoids mobile keyboard bounce) ──
  const chatInputBar = document.querySelector('.chat-input-bar');
  // ── Keep textarea focused when interacting with chat bar controls (mobile keyboard fix) ──
  const _msgTextarea = el('message');
  if (chatInputBar && _msgTextarea) {
    let _refocusOnBlur = false;
    function _flagRefocus(e) {
      if (e.target.closest('textarea, input')) return;
      // Don't refocus for attach — file picker needs full focus control
      if (e.target.closest('#overflow-attach-btn')) return;
      // Don't refocus for model picker button — focus should go to picker search input
      if (e.target.closest('.model-picker-btn')) return;
      // Don't refocus when tapping the +/chevron tools button — the user
      // is explicitly trying to dismiss the keyboard and open the tools
      // menu. Without this, the textarea blurs (keyboard down), then this
      // handler re-focuses it (keyboard bounces back up).
      if (e.target.closest('#overflow-plus-btn')) return;
      if (document.activeElement === _msgTextarea) _refocusOnBlur = true;
    }
    chatInputBar.addEventListener('touchstart', _flagRefocus, {
      passive: true,
    });
    // Overflow menu is position:fixed — may not bubble through chatInputBar on mobile
    const _overflowMenu = el('overflow-menu');
    if (_overflowMenu)
      _overflowMenu.addEventListener('touchstart', _flagRefocus, {
        passive: true,
      });
    // Model picker menu too
    const _pickerMenu = document.getElementById('model-picker-menu');
    if (_pickerMenu)
      _pickerMenu.addEventListener('touchstart', _flagRefocus, {
        passive: true,
      });
    // Attach strip (outside chat-input-bar)
    const _attachStrip = el('attach-strip');
    if (_attachStrip)
      _attachStrip.addEventListener('touchstart', _flagRefocus, {
        passive: true,
      });
    _msgTextarea.addEventListener('blur', () => {
      if (_refocusOnBlur) {
        _refocusOnBlur = false;
        setTimeout(() => _msgTextarea.focus(), 0);
      }
    });
    // Clear flag if touch ends without causing blur
    document.addEventListener(
      'touchend',
      () => {
        setTimeout(() => {
          _refocusOnBlur = false;
        }, 50);
      },
      { passive: true },
    );
  }
  // ── Overflow Group Chat toggle ──
  const overflowGroupBtn = el('overflow-group-btn');
  if (overflowGroupBtn) {
    overflowGroupBtn.addEventListener('click', async () => {
      const chk = el('group-toggle');
      const turningOn = chk ? !chk.checked : false;
      if (turningOn) {
        const picked = await groupModule.showModelPicker();
        if (!picked || picked.length < 2) return;
        groupModule.setActive(true); // Set early so updateModelPicker sees it
        syncGroupIndicator(true);
        _startFreshChat();
        // Clear any leftover splash screens
        const _chatBox = document.getElementById('chat-history');
        if (_chatBox) {
          _chatBox.querySelectorAll('.tool-splash').forEach((s) => s.remove());
          // Also hide welcome screen
          if (chatModule && chatModule.hideWelcomeScreen)
            chatModule.hideWelcomeScreen();
        }
        // Start group — create participant sessions immediately
        const sid =
          sessionModule.getCurrentSessionId() || 'group-' + Date.now();
        await groupModule.startGroup(picked, sid);
        // Re-hide picker after everything settles
        const _mpw = el('model-picker-wrap');
        if (_mpw) _mpw.style.display = 'none';
        uiModule.showToast(`Group chat ready — ${picked.length} models`);
      } else {
        syncGroupIndicator(false);
        groupModule.stopGroup();
        // Restore model picker
        const _mpWrap2 = el('model-picker-wrap');
        if (_mpWrap2) _mpWrap2.style.display = '';
      }
    });
  }

  // ── Group toggle button (chatbox indicator) — click to deactivate ──
  const groupToggleBtn = el('group-toggle-btn');
  if (groupToggleBtn) {
    groupToggleBtn.addEventListener('click', () => {
      syncGroupIndicator(false);
      groupModule.stopGroup();
    });
  }

  // Observe chat history for new/changed messages — de-emojify on the fly
  let _deEmojifyTimer = null;
  const _chatObs = new MutationObserver(() => {
    if (!document.body.classList.contains('text-emojis')) return;
    clearTimeout(_deEmojifyTimer);
    _deEmojifyTimer = setTimeout(() => {
      document
        .querySelectorAll('.msg .body')
        .forEach((e) => deEmojify(e, _DEOJ_SKIP));
    }, 150);
  });
  const _chatBox = document.getElementById('chat-history');
  if (_chatBox) _chatObs.observe(_chatBox, { childList: true, subtree: true });

  // INITIALIZE EVENT LISTENERS
  // Chat form submission
  //  document.getElementById('chat-form').addEventListener('submit', chatModule.handleChatSubmit);

  // File attachments (inside overflow menu)
  const _overflowAttach = document.getElementById('overflow-attach-btn');
  if (_overflowAttach)
    _overflowAttach.addEventListener('click', fileHandlerModule.openPicker);
  document.getElementById('file-input').addEventListener('change', (e) => {
    for (const f of e.target.files) fileHandlerModule.addFiles([f]);
    fileHandlerModule.renderAttachStrip();
    // Refocus textarea after file picker closes (mobile keyboard)
    const ta = document.getElementById('message');
    if (ta) setTimeout(() => ta.focus(), 100);
  });
  // Modify form submit to handle special modes
  const chatForm = document.getElementById('chat-form');
  chatForm.onsubmit = handleSubmit;
});
</script>

<main class="chat-container welcome-active" id="chat-container" aria-label="Chat area" aria-busy="false">
   <!-- Persistent page heading for assistive tech. Visually hidden so it
      never affects layout, but always present inside the main landmark
      (the sidebar that shows the visible brand is hidden off-canvas on
      mobile) so the page always exposes a single level-1 heading. -->
   <h1 class="a11y-visually-hidden">Odysseus</h1>

   <div class="chat-top-bar">
      <button type="button" class="incognito-indicator" id="incognito-indicator" title="Nobody mode active — click to deactivate" style="display:none;">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <line x1="8" y1="16" x2="16" y2="8"/>
            <line x1="8" y1="8" x2="16" y2="16"/>
         </svg>
      </button>
      <div class="chat-meta-overlay">
         <span id="current-meta">Odysseus Chat</span>
         <span id="current-meta-count" class="chat-meta-count" aria-hidden="true"></span>
         <span id="session-cost-display" class="session-cost-display" style="display:none;"></span>
         <span class="export-dropdown-wrap" id="export-dropdown-wrap">
            <button type="button" class="export-dl-btn" id="export-dl-btn" title="More">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
               </svg>
            </button>
            <div class="export-dropdown-menu" id="export-dropdown-menu">
               <div class="export-dropdown-item" id="export-rename-btn">
                  <span class="dropdown-icon">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                     </svg>
                  </span>
                  <span>Rename</span>
               </div>
               <div class="export-dropdown-item" id="export-copy-btn">
                  <span class="dropdown-icon">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                     </svg>
                  </span>
                  <span>Copy Chat</span>
               </div>
               <div class="export-dropdown-item" id="export-pdf-btn">
                  <span class="dropdown-icon">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <path d="M9 15v-2h2a1.5 1.5 0 0 1 0 3H9z"/>
                     </svg>
                  </span>
                  <span>PDF</span>
               </div>
               <div class="export-dropdown-item" id="export-doc-btn">
                  <span class="dropdown-icon">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                     </svg>
                  </span>
                  <span>Save to Documents</span>
               </div>
            </div>
         </span>
      </div>
   </div>

   <div id="chat-history" class="chat-history block" role="log" aria-live="polite"></div>
   <!-- Attachments strip -->
   <div id="attach-strip" class="attach-strip"></div>
   <!-- Hidden elements for form logic -->
   <input type="checkbox" id="research-toggle" style="display:none;">
   <input type="checkbox" id="rag-toggle" style="display:none;">
   <input type="checkbox" id="incognito-toggle" style="display:none;">
   <input type="file" id="file-input" class="hidden" multiple />
   <!-- Unified chat input bar -->
   <div class="chat-input-bar">
      <div class="chat-input-top">
         <div id="message-ghost" class="ghost-text-overlay" aria-hidden="true"></div>
         <textarea id="message" placeholder="Message Odysseus..." required autocomplete="off" aria-label="Message input" rows="1" autofocus></textarea>
         <!-- Model picker (inside chatbox, top-right) -->
         <div class="model-picker-wrap" id="model-picker-wrap">
            <button type="button" class="model-picker-btn" id="model-picker-btn" title="Switch model">
               <span id="model-picker-label">Select model</span>
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 15 12 9 18 15"/>
               </svg>
            </button>
            <div class="model-picker-menu hidden" id="model-picker-menu">
               <div class="model-picker-search-row">
                  <input type="text" id="model-picker-search" placeholder="Search models..." autocomplete="off" aria-label="Search models">
                  <button type="button" class="model-picker-action-btn primary" id="model-picker-add-models-btn" title="Add model endpoints" aria-label="Add model endpoints">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14"/>
                        <path d="M5 12h14"/>
                     </svg>
                  </button>
               </div>
               <div class="model-picker-list" id="model-picker-list"></div>
            </div>
         </div>
      </div>
      <div id="pinned-tools-bar"></div>
      <div class="chat-input-bottom" style="visibility:hidden">
         <div class="chat-input-left">
            <!-- Overflow menu (+) — always first/left -->
            <div class="overflow-wrapper">
               <button type="button" class="input-icon-btn overflow-plus-btn" id="overflow-plus-btn" title="More tools" aria-label="More tools" aria-haspopup="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                     <polyline points="6 15 12 9 18 15"/>
                  </svg>
                  <span class="plus-active-dot"></span>
               </button>
               <div id="overflow-menu" class="overflow-menu hidden">
                  <button type="button" class="overflow-menu-item" id="overflow-attach-btn">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                     </svg>
                     <span>Attach files</span>
                  </button>
                  <button type="button" class="overflow-menu-item" id="overflow-doc-btn">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                     </svg>
                     <span>Documents</span>
                  </button>
                  <button type="button" class="overflow-menu-item" id="overflow-rag-btn">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <ellipse cx="12" cy="5" rx="9" ry="3"/>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                     </svg>
                     <span>RAG</span>
                     <span class="overflow-active-dot"></span>
                  </button>
                  <button type="button" class="overflow-menu-item" id="overflow-workspace-btn">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                     </svg>
                     <span>Workspace</span>
                     <span class="overflow-active-dot"></span>
                  </button>
                  <!-- Inline "deep research mode" toggle removed (superseded by the
                     Deep Research sidebar / trigger_research). The hidden
                     #research-toggle checkbox is kept inert so existing JS refs
                     don't break; without this entry point it can't be enabled. -->
                  <!-- Group Chat moved to Characters modal Group tab -->
                  <!-- TTS Mode hidden — read-aloud feature is off in this build. -->
                  <button type="button" class="overflow-menu-item" id="overflow-tts-btn" hidden style="display:none">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                     </svg>
                     <span>TTS Mode</span>
                     <span class="overflow-active-dot"></span>
                  </button>
                  <button type="button" class="overflow-menu-item" id="overflow-preset-btn">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m18 2 4 4"/>
                        <path d="m17 7 3-3"/>
                        <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/>
                        <path d="m9 11 4 4"/>
                        <path d="m5 19-3 3"/>
                        <path d="m14 4 6 6"/>
                     </svg>
                     <span>Prompt</span>
                  </button>
               </div>
            </div>
            <!-- Web search (magnifying glass) -->
            <button type="button" class="input-icon-btn" title="Web search" id="web-toggle-btn" data-mode-tool="true" aria-label="Web search" aria-pressed="false">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
               </svg>
            </button>
            <!-- Shell commands (terminal) -->
            <button type="button" class="input-icon-btn" title="Shell Access" id="bash-toggle-btn" data-mode-tool="true" aria-label="Shell access" aria-pressed="false">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 17 10 11 4 5"/>
                  <line x1="12" y1="19" x2="20" y2="19"/>
               </svg>
            </button>
            <!-- Workspace indicator (hidden until a folder is set) -->
            <button type="button" class="input-icon-btn tool-indicator" title="Workspace - click to clear" id="workspace-indicator-btn" aria-label="Clear workspace" style="display:none;">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
               </svg>
               <span style="font-size:11px;margin-left:2px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" id="workspace-indicator-name"></span>
               <svg class="tool-indicator-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
               </svg>
            </button>
            <!-- RAG toolbar indicator (hidden until active) -->
            <button type="button" class="input-icon-btn tool-indicator" title="RAG active — click to deactivate" id="rag-indicator-btn" style="display:none;">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
               </svg>
               <span style="font-size:11px;margin-left:2px;">RAG</span>
               <svg class="tool-indicator-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
               </svg>
            </button>
            <!-- 6. Deep Research (hidden until active) -->
            <button type="button" class="input-icon-btn tool-indicator" title="Deep Research active — click to deactivate" id="research-toggle-btn" style="display:none;">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
               </svg>
               <span style="font-size:11px;margin-left:2px;">Research</span>
               <svg class="tool-indicator-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
               </svg>
            </button>
            <!-- 7. Group Chat (hidden until active) -->
            <button type="button" class="input-icon-btn tool-indicator" title="Group Chat active — click to deactivate" id="group-toggle-btn" style="display:none;">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
               </svg>
               <span style="font-size:11px;margin-left:2px;">Group</span>
               <svg class="tool-indicator-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
               </svg>
            </button>
            <input type="checkbox" id="group-toggle" style="display:none;">
            <!-- Character indicator (hidden until active) -->
            <button type="button" class="input-icon-btn tool-indicator" title="Persona active — click to deactivate" id="character-indicator-btn" style="display:none;">
               <svg id="char-indicator-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
               </svg>
               <span id="character-indicator-name" style="font-size:11px;margin-left:2px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
               <svg class="tool-indicator-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
               </svg>
            </button>
            <!-- Compare toolbar indicator (hidden until active) -->
            <button type="button" class="input-icon-btn tool-indicator" title="Compare active — click to deactivate" id="compare-indicator-btn" style="display:none;">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="18" r="3"/>
                  <circle cx="6" cy="6" r="3"/>
                  <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
                  <path d="M11 18H8a2 2 0 0 1-2-2V9"/>
               </svg>
               <span style="font-size:11px;margin-left:2px;">Compare</span>
               <svg class="tool-indicator-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
               </svg>
            </button>
         </div>
         <div class="chat-input-right">
            <!-- Agent / Chat mode toggle -->
            <div class="mode-toggle">
               <button type="button" class="mode-toggle-btn active" id="mode-agent-btn" aria-pressed="true">Agent</button>
               <button type="button" class="mode-toggle-btn" id="mode-chat-btn" aria-pressed="false">Chat</button>
            </div>
            <button type="submit" form="chat-form" class="send-btn newchat-mode" data-mode="newchat" aria-label="New chat">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
               </svg>
               <span class="send-btn-label">+ New</span>
            </button>
         </div>
      </div>
      <!-- Hidden checkboxes for state -->
      <input type="checkbox" id="web-toggle" style="display:none;">
      <input type="checkbox" id="bash-toggle" style="display:none;">
   </div>
   <form id="chat-form" autocomplete="off" action="javascript:void(0);" style="display:none;"></form>
   <!-- Character (custom preset) modal -->
   <div id="custom-preset-modal" class="modal hidden">
      <div class="modal-content preset-modal-content" role="dialog" aria-label="Prompt" style="background:var(--bg)">
         <div class="modal-header">
            <h4>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px">
                  <path d="m18 2 4 4"/>
                  <path d="m17 7 3-3"/>
                  <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/>
                  <path d="m9 11 4 4"/>
                  <path d="m5 19-3 3"/>
                  <path d="m14 4 6 6"/>
               </svg>
               Prompt
            </h4>
            <button class="close-btn" id="close-custom-preset" aria-label="Close prompt">✖</button>
         </div>
         <div class="modal-body preset-modal-body">
            <div id="char-fields-wrap">
               <div class="preset-tabs">
                  <button class="preset-tab active" data-chartab="inject">
                     <svg class="preset-tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m18 2 4 4"/>
                        <path d="m17 7 3-3"/>
                        <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/>
                        <path d="m9 11 4 4"/>
                        <path d="m5 19-3 3"/>
                        <path d="m14 4 6 6"/>
                     </svg>
                     <span>Inject</span>
                  </button>
                  <button class="preset-tab" data-chartab="character">
                     <svg class="preset-tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                     </svg>
                     <span>Persona</span>
                  </button>
                  <button class="preset-tab" data-chartab="group">
                     <svg class="preset-tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                     </svg>
                     <span>Group</span>
                  </button>
               </div>
               <!-- Inject tab (also holds model tuning: temperature + max tokens) -->
               <div class="preset-chartab" data-chartab-panel="inject">
                  <label for="inject-prefix">Prefix</label>
                  <textarea id="inject-prefix" rows="2" placeholder="Added before your message" style="margin-bottom:8px"></textarea>
                  <label for="inject-suffix">Suffix</label>
                  <textarea id="inject-suffix" rows="2" placeholder="Added after your message" style="margin-bottom:12px"></textarea>
                  <div class="preset-slider-row">
                     <label>Temperature <span class="preset-hint-icon" title="Controls randomness. Lower values give focused, deterministic answers (good for code). Higher values give more creative, varied responses.">?</span></label>
                     <span class="preset-slider-value" id="temp-value">1.0</span>
                  </div>
                  <input type="range" class="preset-range" id="custom-temperature" min="0" max="2" step="0.1" value="1.0">
                  <div class="preset-temp-hints">
                     <span>Precise / Code</span>
                     <span>Balanced</span>
                     <span>Creative</span>
                  </div>
                  <div class="preset-slider-row">
                     <label>Max Tokens <span class="preset-hint-icon" title="Maximum length of the AI response. 'No limit' lets the model decide when to stop.">?</span></label>
                     <span class="preset-slider-value" id="tokens-value">No limit</span>
                  </div>
                  <input type="range" class="preset-range" id="custom-max-tokens" min="256" max="8448" step="256" value="8448">
               </div>
               <!-- Prompt (character/persona) tab -->
               <div class="preset-chartab" data-chartab-panel="character" style="display:none">
                  <label>Persona</label>
                  <div class="char-name-combo">
                     <select id="char-template-select" class="char-template-select">
                        <option value="">Select persona...</option>
                     </select>
                     <button type="button" id="char-new-btn" class="char-action-btn" title="Create a new persona">+ New</button>
                  </div>
                  <div id="char-name-row">
                     <label for="custom-character-name">Name</label>
                     <div class="char-name-combo">
                        <input type="text" id="custom-character-name" maxlength="50" placeholder="Give your persona a name..." autocomplete="off" style="flex:1">
                        <button type="button" id="char-delete-template-btn" class="char-action-btn" title="Delete this persona and its memories" style="display:none;margin-top:-6px !important">
                           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                           </svg>
                           Delete
                        </button>
                        <button type="button" id="reset-character-btn" class="char-action-btn" title="Reset to default" style="margin-top:-6px !important">&#x21BA; Reset</button>
                     </div>
                  </div>
                  <label for="custom-system-prompt">System prompt</label>
                  <div class="char-prompt-wrap">
                     <textarea id="custom-system-prompt" rows="4" placeholder="Write rough notes and click Expand, or leave empty"></textarea>
                     <button type="button" id="char-expand-btn" class="char-expand-btn" title="AI expand — turn your notes into a full system prompt">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;margin-right:2px;">
                           <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z"/>
                        </svg>
                        Expand
                     </button>
                  </div>
               </div>
               <!-- Group tab -->
               <div class="preset-chartab" data-chartab-panel="group" style="display:none">
                  <div style="display:flex;gap:4px;margin-bottom:8px;">
                     <button type="button" class="compare-parallel-toggle" id="group-mode-btn" style="flex:1;height:auto;width:auto;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                           <line x1="8" y1="6" x2="20" y2="6"/>
                           <line x1="8" y1="12" x2="20" y2="12"/>
                           <line x1="8" y1="18" x2="20" y2="18"/>
                           <circle cx="4" cy="6" r="1.5" fill="currentColor"/>
                           <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
                           <circle cx="4" cy="18" r="1.5" fill="currentColor"/>
                        </svg>
                        <span class="compare-toggle-label">Sequential</span>
                     </button>
                  </div>
                  <div id="group-participants" style="display:flex;flex-direction:column;gap:4px;margin-bottom:0;max-height:220px;overflow-y:auto;"></div>
                  <button type="button" id="group-add-btn" class="preset-save-btn" style="width:100%;background:none;border:1px dashed var(--border);color:var(--fg);opacity:0.6;font-size:11px;padding:4px;margin-top:0;">+ Add participant</button>
               </div>
            </div>
         </div>
         <div class="modal-footer">
            <div style="flex:1"></div>
            <button type="button" id="cancel-custom-preset" style="margin-right:8px;display:none;">Cancel</button>
            <button type="button" id="save-custom-preset">Start</button>
         </div>
      </div>
   </div>

</main>

<style>
    .chat-history {
      display:flex;
      flex-direction:column;
      flex:1;
      overflow-y:auto;
      overflow-x:hidden;
      overscroll-behavior-y: none;
      margin-bottom:8px;
      white-space:normal;
      min-height:0;
      --chat-max: 800px;
      padding-left: max(0px, calc((100% - var(--chat-max)) / 2));
      padding-right: max(12px, calc((100% - var(--chat-max)) / 2 + 12px));
    }
    :global(.chat-history > *) {
      flex: 0 0 auto;
    }
    @media print {
      main.chat-container { width: 100% !important; margin: 0 !important; padding: 0 !important; max-height: none !important; overflow: visible !important; }
      #chat-history { max-height: none !important; overflow: visible !important; height: auto !important; padding: 0 !important; }
      #chat-history::before { content: attr(data-print-title); display: block; font-size: 1.3em; font-weight: bold; margin-bottom: 1em; color: #000; }
    }

</style>
