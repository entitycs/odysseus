<script nonce="{{{CSP_NONCE}}}" lang="ts">
import {
  applyTheme,
  getSavedTheme,
  THEMES,
  type ThemeColors,
} from '$lib/themes';

// A self-contained theme switcher widget. Mounted into the legacy
// index.html shell via web/entries/theme-toggle.ts. Reads/writes the same
// 'odysseus-theme' localStorage key the vanilla-JS app uses, so the two
// stay in lockstep.

const themeNames = Object.keys(THEMES);

let current = $state(getSavedTheme()?.name ?? 'dark');

// The mount point in index.html starts hidden so an unbuilt/missing widget
// leaves no empty gap. Reveal it once we actually render.
$effect(() => {
  const host = document.querySelector('[data-svelte="theme-toggle"]');
  if (host) host.removeAttribute('hidden');
});

function cycle(): void {
  const idx = themeNames.indexOf(current);
  const next = themeNames[(idx + 1) % themeNames.length];
  current = next;
  applyTheme(next);
}

const colors = $derived<ThemeColors>(THEMES[current] ?? THEMES.dark);
</script>

<button
	type="button"
	onclick={cycle}
	title="Cycle theme (currently: {current})"
	style:background={colors.panel}
	style:color={colors.fg}
	style:border-color={colors.border}
>
	<span class="swatch" style:background={colors.bg} style:border-color={colors.red}></span>
	<span class="label">{current}</span>
</button>

<style>
	button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid;
		border-radius: 6px;
		font-size: 1.85rem !important;
		font-family: inherit;
		cursor: pointer;
		transition: opacity 0.12s ease;
	}
	button:hover {
		opacity: 0.85;
	}
	.swatch {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 3px;
		border: 1px solid;
		display: inline-block;
	}
	.label {
		text-transform: capitalize;
	}
</style>
