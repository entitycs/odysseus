<script lang="ts">
    import { springSlide } from "$lib/transitions/springSlide";
    import { onMount } from "svelte";
    import type {
        HTMLStyleAttributes,
        PointerEventHandler,
    } from "svelte/elements";

    export interface Props {
        message: HTMLElement | null;
        className?: string;
        dataMarkerId: number;
        style?: HTMLStyleAttributes | null;
        top: number;
        scrollTop: number;
        isVisible: boolean;
        onclick: (e: Event, top: number) => void;
    }

    let {
        message = null,
        className = ".scrollMarker",
        style = null,
        dataMarkerId = 0,
        top = 0,
        scrollTop = 0,
        isVisible = false,
        onclick = () => {},
    }: Props = $props();

    onMount(() => {

    });
</script>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    transition:springSlide={{ duration: 600, overshoot: 45 }}
    class="scroll-marker{isVisible ? ' active' : ''}"
    data-marker-id={`msg-${dataMarkerId}`}
    style="top:{top}px"
    onclick={ e=> onclick(e, scrollTop)}
></div>
