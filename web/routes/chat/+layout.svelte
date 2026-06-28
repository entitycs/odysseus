
<script lang="ts">
let { children } = $props();
</script>
<div class="chat-top-bar">
   <button type="button" class="incognito-indicator" id="incognito-indicator" title="Nobody mode active — click to deactivate" style="display:none;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <line x1="8" y1="16" x2="16" y2="8"/>
         <line x1="8" y1="8" x2="16" y2="16"/>
      </svg>
   </button>
   <div class="chat-meta-overlay">
      <span id="current-meta">Odysseus Chat</span><span id="current-meta-count" class="chat-meta-count" aria-hidden="true"></span><span id="session-cost-display" class="session-cost-display" style="display:none;"></span>
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
<div id="welcome-screen">
   <div class="welcome-name">
      <svg class="welcome-boat" viewBox="0 0 32 32">
         <path d="M16 4L16 22L6 22Z" fill="currentColor"/>
         <path d="M16 8L16 22L24 22Z" fill="currentColor" opacity="0.6"/>
         <path d="M4 24Q10 20 16 24Q22 28 28 24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </svg>
      Odysseus
   </div>
   <div class="welcome-sub" id="welcome-sub">Welcome, <span class="setup-trigger-link" style="color:var(--accent,var(--red));font-weight:600;cursor:pointer;text-decoration:underline;" title="Click to launch setup">type /setup</span> to get started.</div>
   <div class="welcome-tip" id="welcome-tip"></div>
   <button type="button" class="incognito-btn" id="incognito-btn" title="Enable Nobody mode — no memory, no history saved">
      <svg class="eye-open" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>
      </svg>
      <svg class="eye-blinded" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <line x1="8" y1="16" x2="16" y2="8"/>
         <line x1="8" y1="8" x2="16" y2="16"/>
      </svg>
      <span class="incognito-label">Nobody</span>
   </button>
   <div id="welcome-setup" style="display:none"></div>
</div>
{@render children()}
