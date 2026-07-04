<script lang="ts">
// --- Props -----------------------------------------------------------
// All optional; defaults match the original plugin behaviour.
interface Props {
  id: string;
  name?: string;
  /** Debounce delay (ms) before redrawing after a mutation / resize. */
  label?: string;
}

let {
  id = 'password',
  name = id,
  label = id.charAt(0).toUpperCase() + id.slice(1),
}: Props = $props();

const showState = $state({ showing: false });
// Password show/hide toggles
const eyeOpen =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeClosed =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><line x1="8" y1="16" x2="16" y2="8"/><line x1="8" y1="8" x2="16" y2="16"/></svg>';

const type = $derived(showState.showing ? 'text' : 'password');
const aria = $derived(showState.showing ? 'Hide password' : 'Show password');

let inp: HTMLInputElement;

function toggle(e: Event) {
  e.preventDefault();
  showState.showing = !showState.showing;
}

$effect(() => {
  inp?.focus();
});
</script>
<!--
<label for={id}>{label}</label> -->

<div class="pw-wrapper">
  <input
    id={id}
    name={name || id}
    type={type}
    autocomplete="current-password"
    bind:this={inp}
  />

  <button
    type="button"
    class="pw-toggle"
    aria-label={aria}
    onclick={(e: Event) =>  toggle(e)}
    tabindex="-1"
  >
    {@html showState
      ? eyeOpen
      : eyeClosed}
  </button>
</div>
