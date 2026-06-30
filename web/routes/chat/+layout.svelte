
<script lang="ts">
let { children } = $props();
</script>

{@render children()}
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

