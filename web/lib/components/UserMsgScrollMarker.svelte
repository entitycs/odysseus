<script lang="ts">
import { onMount } from 'svelte';

// ScrollMarker component
//
// A self-contained scroll-position preview overlay.  Mounted into the legacy
// index.html shell via web/entries/scroll-marker.ts via:
//   <div data-svelte="scroll-marker"></div>
//
// Watches #chat-history for content mutations and container resizes, then
// renders small clickable dots alongside the native scrollbar — one per
// .msg-user element — so the user can jump directly to any user turn.

// --- Props -----------------------------------------------------------
// All optional; defaults match the original plugin behaviour.
interface Props {
  /** CSS selector for the scrollable chat container. */
  chatSelector?: string;
  /** CSS selector for the message elements to mark. */
  msgSelector?: string;
  /** Debounce delay (ms) before redrawing after a mutation / resize. */
  debounceMs?: number;
}

let {
  chatSelector = '#chat-history',
  msgSelector = '.msg-user',
  debounceMs = 300,
}: Props = $props();

// --- DOM refs --------------------------------------------------------
let trackEl = $state<HTMLDivElement | null>(null);

onMount(async () => {
  if (!trackEl) return;
  init(trackEl);
});

// --- Lifecycle -------------------------------------------------------
$effect(() => {
  // Reveal the host element (hidden until widget is ready, matching
  // the ThemeToggle pattern).
  const host = document.querySelector('[data-svelte="scroll-marker"]');
  if (host) host.removeAttribute('hidden');

  // Wait until the track div is in the DOM before initialising.
  if (!trackEl) return;

  return init(trackEl);
});

// --- Core logic (mirrors the original plugin) -----------------------

function positionTrack(track: HTMLDivElement): void {
  const chat = document.querySelector<HTMLElement>(chatSelector);
  if (!chat) return;

  const trackHeight = track.clientHeight || chat.clientHeight;
  const thumbHeight = (chat.clientHeight / chat.scrollHeight) * trackHeight;

  const ua = navigator.userAgent.toLowerCase();
  const hasNoArrows = true;//- use first/last markers//
    // ua.includes('macintosh') ||
    // ua.includes('ipad') ||
    // ua.includes('iphone') ||
    // ua.includes('android');

  const yMargin = (hasNoArrows ? 0 : 16) + thumbHeight / 2;
  const xMargin = 6;
  const rect = chat.getBoundingClientRect();

  track.style.position = 'fixed';
  track.style.top = `${rect.top + yMargin}px`;
  track.style.left = `${rect.right - xMargin}px`;
  track.style.width = '20px';
  track.style.height = `${rect.height - 2 * yMargin}px`;
}

function drawMarkers(root: Element | ShadowRoot, track: HTMLDivElement): void {
  if (!root || !track) return;

  positionTrack(track);

  const chat = document.querySelector<HTMLElement>(chatSelector);
  if (!chat) return;

  const scrollRange = chat.scrollHeight - chat.clientHeight;
  if (scrollRange <= 0) {
    track.innerHTML = '';
    return;
  }

  const trackHeight = track.clientHeight || chat.clientHeight;
  const thumbHeight = (chat.clientHeight / chat.scrollHeight) * trackHeight;
  const usableTrack = trackHeight;

  track.innerHTML = '';

  const msgs = root.querySelectorAll<HTMLElement>(msgSelector);
  msgs.forEach((msg) => {
    const chatRect = chat.getBoundingClientRect();
    const msgRect = msg.getBoundingClientRect();

    const msgTopInScrollSpace = msgRect.top - chatRect.top + chat.scrollTop;

    let desiredScrollTop = msgTopInScrollSpace - chat.clientHeight / 2;
    desiredScrollTop = Math.max(0, Math.min(desiredScrollTop, scrollRange));

    const thumbTop = (desiredScrollTop / scrollRange) * usableTrack;
    const markerY = (msgTopInScrollSpace / scrollRange) * usableTrack - thumbHeight / 2;

    const marker = document.createElement('div');
    marker.className = 'scroll-marker';
    marker.style.top = `${markerY}px`;
    marker.onclick = () => {
      chat.scrollTo({ top: desiredScrollTop, behavior: 'instant' });
    };

    track.appendChild(marker);
  });
}

/**
 * Attach all observers and return a cleanup function so that
 * Svelte's $effect can tear everything down when the component unmounts.
 */
function init(track: HTMLDivElement): () => void {
  const chat = document.querySelector<HTMLElement>(chatSelector);
  if (!chat) return () => {};

  // Ensure the chat element is positioned so child markers can use
  // position:absolute if needed (mirrors the original plugin guard).
  const cs = getComputedStyle(chat);
  if (cs.position === 'static') chat.style.position = 'relative';

  const root: Element | ShadowRoot = chat.shadowRoot ?? chat;

  let redrawTimeout: ReturnType<typeof setTimeout> | null = null;

  const scheduleDraw = (includePosition = false) => {
    if (redrawTimeout !== null) clearTimeout(redrawTimeout);
    redrawTimeout = setTimeout(() => {
      if (includePosition) positionTrack(track);
      drawMarkers(root, track);
    }, debounceMs);
  };

  // --- Container resize ---
  const container = document.querySelector('#chat-container');
  let resizeObserver: ResizeObserver | null = null;
  if (container) {
    resizeObserver = new ResizeObserver(() => scheduleDraw(true));
    resizeObserver.observe(container);
  }

  // --- Window resize ---
  const onWindowResize = () => scheduleDraw(true);
  window.addEventListener('resize', onWindowResize);

  // --- Content mutations ---
  const mutationObserver = new MutationObserver(() => scheduleDraw());
  mutationObserver.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Initial draw.
  drawMarkers(root, track);

  return () => {
    if (redrawTimeout !== null) clearTimeout(redrawTimeout);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', onWindowResize);
    mutationObserver.disconnect();
  };
}
</script>

<!--
  The track div is appended to #chat-container in the legacy shell.
  bind:this hands the reference to $effect so the imperative logic
  can use it without querySelector('#scroll-marker-track').
-->
<div bind:this={trackEl} id="scroll-marker-track" aria-hidden="true">
  <div hidden class="scroll-marker"></div>
</div>

<style>
  #scroll-marker-track {
    /* Positioned dynamically by positionTrack(); base styles only. */
    pointer-events: none;
    z-index: 9999;
    display:block;
    transition: transform 0.3s ease, opacity 0.35s ease;
  }

  /* Markers themselves need pointer-events to be clickable. */
  :global(#scroll-marker-track .scroll-marker)  {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 17px;
    height: 8px;
    border-radius: 20%;
    background: var(--red, #4f8ef7);
    opacity: 0.7;
    cursor: pointer;
    pointer-events: auto;
    transition: opacity 0.35s ease, transform 0.3s ease;
  }

  :global(#scroll-marker-track .scroll-marker:hover) {
    opacity: 1;
    transform: translateX(-50%) scale(1.35, 2);
    background: color-mix(in srgb, var(--red) 80%, var(--fg) 20%)
  }
</style>
