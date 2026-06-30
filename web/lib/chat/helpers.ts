import chatModule from '$lib/legacy/chat';
import documentModule from '$lib/legacy/document';
import presetsModule from '$lib/legacy/presets';
import * as researchPanelModule from '$lib/legacy/research/panel.js';
import sessionModule from '$lib/legacy/sessions';
import { updatePlusDot } from '$lib/overflow';

export function startFreshChat() {

    try {
        const prevId =
            sessionModule && sessionModule.getCurrentSessionId
                ? sessionModule.getCurrentSessionId()
                : null;
        if (chatModule && chatModule.detachCurrentStream)
            chatModule.detachCurrentStream(prevId);
        else if (chatModule && chatModule.abortCurrentRequest)
            chatModule.abortCurrentRequest();
    } catch (e) {
        console.warn('fresh chat stream detach failed:', e);
    }
    if (sessionModule) sessionModule.setCurrentSessionId(null);
    const box = document.getElementById('chat-history');
    if (box) box.innerHTML = '';
    if (chatModule && chatModule.showWelcomeScreen) {
        chatModule.showWelcomeScreen();
    }
    // Close document panel if open
    if (documentModule && documentModule.closePanel) documentModule.closePanel();
    if (researchPanelModule && researchPanelModule.isOpen())
        researchPanelModule.closePanel();
    // Reset research overflow dot (but don't touch research state — caller manages that)
    const _overflowRes = document.getElementById('overflow-research-btn');
    if (_overflowRes) _overflowRes.classList.remove('active');
    if (typeof updatePlusDot === 'function') updatePlusDot();
    // Reset agent mode to Chat
    const modeToggle = document.getElementById('agent-mode-toggle') as HTMLInputElement;
    if (modeToggle && modeToggle.checked) {
        modeToggle.checked = false;
        modeToggle.dispatchEvent(new Event('change'));
    }
    // Clear character/persona
    if (presetsModule && presetsModule.deactivateCharacter)
        presetsModule.deactivateCharacter();
}

// Serialize the current chat history into a plain-text transcript.
// Includes user messages, assistant rounds, and agent tool calls in DOM order.
export function serializeChatTranscript() {
    const box = document.getElementById('chat-history');
    if (!box) return '';
    const parts = [];
    for (const child of box.children) {
        if (child.classList?.contains('msg')) {
            const isUser = child.classList.contains('msg-user');
            let label;
            if (isUser) {
                label = 'User';
            } else {
                const roleEl = child.querySelector('.role');
                const ts = roleEl?.querySelector('.role-timestamp');
                let raw = roleEl ? roleEl.textContent : '';
                if (ts) raw = raw.replace(ts.textContent, '');
                label = (raw || '').trim() || 'Assistant';
            }
            const body = child.querySelector('.body');
            // Prefer dataset.raw (original markdown) over innerText (rendered HTML as text)
            // to avoid extra newlines and formatting artifacts.
            const text = body
                ? (body.dataset.raw || body.innerText || body.textContent || '').trim()
                : '';
            if (text) parts.push(`${label}: ${text}`);
        } else if (child.classList?.contains('agent-thread')) {
            const lines = ['[Tool calls]'];
            for (const n of child.querySelectorAll('.agent-thread-node')) {
                const tool =
                    n.querySelector('.agent-thread-tool')?.textContent?.trim() || 'tool';
                const cmd =
                    n.querySelector('.agent-thread-cmd')?.textContent?.trim() || '';
                const output =
                    n.querySelector('.agent-tool-output pre')?.textContent?.trim() || '';
                const status = n.classList.contains('error') ? 'failed' : 'done';
                let line = `- ${tool} [${status}]`;
                if (cmd) line += `\n  cmd: ${cmd}`;
                if (output) {
                    const truncated =
                        output.length > 2000 ? output.slice(0, 2000) + '…' : output;
                    line += `\n  out: ${truncated}`;
                }
                lines.push(line);
            }
            parts.push(lines.join('\n'));
        }
    }
    return parts.join('\n\n');
}
