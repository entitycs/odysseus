<script lang="ts">
  import { onMount } from "svelte";
  import ScrollMarker, { type Props as ScrollMarkerProps } from "$lib/components/ScrollMarker.svelte";
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
    chat: HTMLElement | null;
    /** CSS selector for the scrollable chat container. */
    chatSelector?: string;
    /** CSS selector for the message elements to mark. */
    msgSelector?: string;
    /** Debounce delay (ms) before redrawing after a mutation / resize. */
    debounceMs?: number;
  }

  let {
    chat = null,
    chatSelector = "#chat-history",
    msgSelector = ".msg-user",
    debounceMs = 300,
  }: Props = $props();

  // --- DOM refs --------------------------------------------------------
  let trackEl = $state<HTMLDivElement | null>(null);
  let msgs = $state<NodeListOf<HTMLElement>>();
  let markers = $state<ScrollMarkerProps[]>([]);
  import { springSlide } from "$lib/transitions/springSlide.js";
    import { createMsgFooter } from "$lib/legacy/chatRenderer";

  // --- Marker state ----------------------------------------------------
  // Track which marker has active hover class based on scroll position
  let activeMarkerId: string | null = $state(null);
  // let chat: HTMLElement | null = null;
  onMount(async () => {
    if (!trackEl) return;
    init(trackEl);
    // chat = document.querySelector<HTMLElement>(chatSelector);
    // Reveal the host element (hidden until widget is ready, matching
    // the ThemeToggle pattern).
    const host = document.querySelector('[data-svelte="scroll-marker"]');
    if (host) host.removeAttribute("hidden");
  });

  // --- Lifecycle -------------------------------------------------------
  $effect(() => {});

  const onMarkerClick = (e: Event, top: number) => {
    if (!chat) return;
    chat.scrollTo({ top: top, behavior: "instant" });
  };

  // --- Core logic (mirrors the original plugin) -----------------------

  function positionTrack(): void {
    if (!chat || !trackEl) return;

    const trackHeight = trackEl.clientHeight || chat.clientHeight;
    const thumbHeight = (chat.clientHeight / chat.scrollHeight) * trackHeight;

    const ua = navigator.userAgent.toLowerCase();
    const hasNoArrows = true; //- use first/last markers//
    // ua.includes('macintosh') ||
    // ua.includes('ipad') ||
    // ua.includes('iphone') ||
    // ua.includes('android');

    const yMargin = (hasNoArrows ? 0 : 16) + thumbHeight / 2;
    const xMargin = 6;
    const rect = chat.getBoundingClientRect();

    trackEl.style.position = "fixed";
    trackEl.style.top = `${rect.top + yMargin}px`;
    trackEl.style.left = `${rect.right - xMargin}px`;
    trackEl.style.width = "20px";
    trackEl.style.height = `${rect.height - 2 * yMargin}px`;
  }
  let _scrollHandler: (() => void) | null = null;
  /**
   * Add scroll handler to chat container to detect when markers come into view
   */
  function addScrollHandler(): () => void {
    if (!chat || !trackEl) return () => {};
    const handleScroll = () => {
      if (!chat || !trackEl) return;
      // Clear any previously active marker
      activeMarkerId = null;

      // Find which marker is currently within viewport (threshold: 15% from edges)
      const visibleThreshold = chat.clientHeight * 0.1;
      const chatRect = chat.getBoundingClientRect();

      // markers = trackEl.querySelectorAll<HTMLDivElement>(".scroll-marker");
      const msgs = chat.querySelectorAll<HTMLElement>(msgSelector);
      markers.forEach((marker, index) => {
        const markedEl = msgs[index];
        const markerRect = markedEl.getBoundingClientRect(); //marker.getBoundingClientRect();
        const isVisible =
          (markerRect.top <= chatRect.top &&
            markerRect.bottom >= chatRect.bottom) ||
          (markerRect.top >= chatRect.top + visibleThreshold &&
            markerRect.top <= chatRect.bottom - visibleThreshold) ||
          (markerRect.bottom >= chatRect.top + visibleThreshold &&
            markerRect.bottom <= chatRect.bottom - visibleThreshold);
        marker.isVisible = isVisible;
      });
    };

    chat.addEventListener("scrollend", handleScroll, { passive: true });

    return () => chat?.removeEventListener("scrollend", handleScroll);
  }

  function drawMarkers( ): void {
    if (!chat || !trackEl) return;

    positionTrack();


    const scrollRange = chat.scrollHeight - chat.clientHeight;
    if (scrollRange <= 0) {
      markers.splice(0, markers.length);
      return;
    }

    const trackHeight = trackEl.clientHeight || chat.clientHeight;
    const thumbHeight = (chat.clientHeight / chat.scrollHeight) * trackHeight;
    const usableTrack = trackHeight;

    // track.innerHTML = "";

    msgs = chat.querySelectorAll<HTMLElement>(msgSelector);
    markers.splice(0, markers.length);
    msgs.forEach((msg, index) => {
      if (!chat) return;
      const chatRect = chat.getBoundingClientRect();
      const msgRect = msg.getBoundingClientRect();

      const msgTopInScrollSpace = msgRect.top - chatRect.top + chat.scrollTop;

      let desiredScrollTop = msgTopInScrollSpace - chat.clientHeight / 2;
      desiredScrollTop = Math.max(0, Math.min(desiredScrollTop, scrollRange));

      const thumbTop = (desiredScrollTop / scrollRange) * usableTrack;
      const markerY =
        (msgTopInScrollSpace / scrollRange) * usableTrack - thumbHeight / 2;

      const marker: ScrollMarkerProps = {
        message: msg,
        style: {},
        dataMarkerId: index,
        className: "scroll-marker",
        top: markerY,
        scrollTop: desiredScrollTop,
        onclick: (e) => onMarkerClick(e, desiredScrollTop),
        isVisible: false
      };
      markers.push(marker);
      // track.appendChild(marker);
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
    if (cs.position === "static") chat.style.position = "relative";

    const root: Element | ShadowRoot = chat.shadowRoot ?? chat;

    let redrawTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleDraw = (includePosition = false) => {
      if (redrawTimeout !== null) clearTimeout(redrawTimeout);
      redrawTimeout = setTimeout(() => {
        if (includePosition) positionTrack();
        drawMarkers( );
      }, debounceMs);
    };

    // --- Container resize ---
    const container = document.querySelector("#chat-container");
    let resizeObserver: ResizeObserver | null = null;
    if (container) {
      resizeObserver = new ResizeObserver(() => scheduleDraw(true));
      resizeObserver.observe(container);
    }

    // --- Window resize ---
    const onWindowResize = () => scheduleDraw(true);
    window.addEventListener("resize", onWindowResize, { passive: true });

    // --- Content mutations ---
    const mutationObserver = new MutationObserver(() => scheduleDraw(true));
    mutationObserver.observe(chat, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // --- Scroll handler for hover effect ---
    if (!_scrollHandler) _scrollHandler = addScrollHandler();

    // Initial draw.
    drawMarkers( );

    return () => {
      if (redrawTimeout !== null) clearTimeout(redrawTimeout);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      mutationObserver.disconnect();
      // scrollCleanup();
    };
  }
</script>

<!--
  The track div is appended to #chat-container in the legacy shell.
  bind:this hands the reference to $effect so the imperative logic
  can use it without querySelector('#scroll-marker-track').
-->
<div
  bind:this={trackEl}
  id="scroll-marker-track"
  aria-hidden="true"
>
  {#each markers as marker, index}
    <ScrollMarker
      {...marker}
      // className=".scroll-marker"
      // dataMarkerId={index}
      // style={{ top: marker.top }}
      // onclick={(e) => onMarkerClick(e, marker.scroll.top)}
    />
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- <div
      transition:springSlide={{ duration: 600, overshoot: 45 }}
      class="scroll-marker{marker.isVisible ? ' active' : ''}"
      data-marker-id={`msg-${marker.dataMarkerId}`}
      style="top:{marker.top}px"
      onclick={(e) => onMarkerClick(e, marker.scrollTop)}
    ></div> -->
  {/each}
</div>

<style>
  #scroll-marker-track {
    /* Positioned dynamically by positionTrack(); base styles only. */
    pointer-events: none;
    z-index: 9999;
    display: block;
    transition:
      transform 0.3s ease,
      opacity 0.35s ease;
  }

  /* Markers themselves need pointer-events to be clickable. */
  :global(#scroll-marker-track .scroll-marker) {
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
    transition:
      opacity 0.35s ease,
      transform 0.3s ease;
  }

  /* Active/hover state via JavaScript - markers scroll into view */
  :global(#scroll-marker-track .scroll-marker.active) {
    opacity: 1;
    transform: translateX(-50%) scale(1.35, 2);
    background: color-mix(in srgb, var(--red) 80%, var(--fg) 20%);
  }
</style>
