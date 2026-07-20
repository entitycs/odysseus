<script lang="ts">
  import { springSlide } from "$lib/transitions/springSlide";
  export interface Props {
    message: HTMLElement | null;
    className?: string;
    dataMarkerId: number;
    top: number;
    scrollTop: number;
    isVisible: boolean;
    onclick: (e: Event, top: number) => void;
  }

  let {
    message = null,
    className = ".scrollMarker",
    dataMarkerId = 0,
    top = 0,
    scrollTop = 0,
    isVisible = false,
    onclick = () => {},
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  role="button"
  transition:springSlide={{ duration: 600, overshoot: 45 }}
  tabindex="0"
  class="{className}{isVisible ? ' active' : ''}"
  data-marker-id={`msg-${dataMarkerId}`}
  style="top:{top}px"
  onclick={(e) => onclick(e, scrollTop)}
  onkeydown={(e) => {if(e.key ==  'Enter' || e.key === ' ') onclick(e, scrollTop)}}
></div>
