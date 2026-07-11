<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import {
    isLoading,
    type ModelItem,
    modelItems,
    refreshModels,
  } from "$lib/components/chat/models/modelItemStore.svelte";
  import helper from "$lib/components/chat/models/picker/helpers.svelte";
  import ModelRow from "$lib/components/chat/models/picker/ModelRow.svelte";
  import { providerLogo } from "$lib/legacy/providers";
  import sessionModule, * as _deps from "$lib/legacy/sessions";

  let modelPickerElement: HTMLElement;
  let label: HTMLElement;
  interface Props {
    sessionId?: string | null;
    isOpen?: boolean;
    selectedModelId?: string | null;
    placeholder?: string;
    onModelChange?: (modelItem: ModelItem) => void;
  }

  let {
    sessionId = null,
    isOpen = $bindable(false),
    selectedModelId = $bindable(null),
    placeholder = "Search models...",
    onModelChange = (modelItem: ModelItem) => {
      console.log("made it");
    },
  }: Props = $props();

  let searchQuery = $state("");
  let _modelList: any[] = [];
  let unsubscribeModelItems;

  // Store for models and favorites
  let models = $state([]);
  let favorites = $state([]);
  let recent = $state([]);
  let allModels: ModelItem[] = $state([]);
  let pointer = $state({ x: 0, y: 0 });

  let isModelPickerOpen = $state(true);
  let shouldUpdatePicker = $state(false);
  let currentModelId = $state("");
  let currentModelLogo: string | RegExp | null = $state("");

  $effect(() => {
    if (shouldUpdatePicker) {
      updateModelPicker();
      shouldUpdatePicker = false;
    }
  });

  $inspect(currentModelId);
  $inspect(selectedModelId);

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (isModelPickerOpen) {
        isModelPickerOpen = false;
      }
    }
  }

  onMount(() => {
    // modelsModule.init();
    // modelsModule.refreshModels();
    refreshModels();
    unsubscribeModelItems = modelItems.subscribe(async (value) => {
      _modelList = value;
      allModels = helper.getAllModels();
      isModelPickerOpen = false;
      await sessionModule.loadSessions();
      sessionId = sessionModule.getCurrentSessionId();
      shouldUpdatePicker = true;
      // updateModelPicker();
    });
    models = helper.loadModels();
    favorites = helper.loadFavorites();
    recent = helper.loadRecent();
    allModels = helper.getAllModels();

    // Global keyboard handlers
    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  });
  //---------------------------------------------------------------------------

  export function updateModelLabel(modelId: string) {
    console.log("updating model label: " + modelId)
    const displayName = modelId
      ? (modelId.split("/").pop() ?? null)
      : "Select model";
    // The header indicator clips long names with ellipsis; show the full model
    // identifier on hover (#1982). No tooltip on the "Select model" placeholder.
    label.title = modelId || "";
    const logo = modelId ? providerLogo(modelId) : null;
    currentModelId = modelId;
    currentModelLogo = logo;
    // if (logo) {
    //   // label.innerHTML =
    //   //   '<span class="model-picker-logo">' + logo + "</span> " + displayName;
    // } else {
    //   label.textContent = displayName;
    // }
    console.log("model id: " + currentModelId);
  }

  /**
   * Update the model picker label to show the current model.
   * Always visible — shows current model name or "Select model" if none.
   * Called after selectSession, createDirectChat, and model switch.
   */
  export function updateModelPicker() {
    // if (!_deps) return;
    // const label = document.getElementById("model-picker-label");
    // if (!label) return;
    // // Hide model picker when group chat is active
    // const wrap = document.getElementById('model-picker-wrap');
    // if (window.groupModule && window.groupModule.isActive()) {
    //   if (wrap) {
    //     wrap.style.display = 'none';
    //   }
    //   return;
    // }
    // // Reset inline visibility (may have been hidden by typing in previous session)
    // if (wrap) {
    //   wrap.style.display = '';
    //   wrap.style.opacity = '';
    //   wrap.style.pointerEvents = '';
    // }
    const currentSessionId = sessionId;
    const sessions = _deps.getSessions();
    const _pendingChat = _deps.getPendingChat();
    const s = sessions.find((x) => x.id === currentSessionId);
    let modelId = null;
    if (s && s.model) {
      modelId = s.model;
      if (!helper.modelExists(modelId, s.endpoint_url || "")) {
        modelId = null;
      }
    } else if (_pendingChat && _pendingChat.modelId) {
      modelId = _pendingChat.modelId;
      if (!helper.modelExists(modelId, _pendingChat.url || "")) {
        // _deps.setPendingChat(null);
        modelId = null;
      }
    }
    // SECURITY: deliberately NOT auto-injecting `odysseus-model-favorites[0]`
    // here. localStorage favorites are per-browser, not per-user, so on a
    // shared browser the previous account's first favorited model would
    // silently pre-populate the chatbox of the next user that signed in. If
    // we have no session model and no pending-chat pick, fall through to
    // the "Select model" placeholder below.
    //
    // Check if selected model is still available — fall back ONLY for pending chats with no user selection
    // Never override an existing session's model — the user explicitly chose it
    if (modelId && !currentSessionId && _pendingChat && _modelList) {
      const items = _modelList;
      const allAvailable: ModelItem[] = [];
      items.forEach((item) => {
        if (item.offline) return;
        (item.models || [])
          .concat(item.models_extra || [])
          .forEach((m: ModelItem) => allAvailable.push(m));
      });
      if (allAvailable.length > 0 && !allAvailable.includes(modelId)) {
        // Model no longer available — switch to first available
        const fallback = items.find(
          (item) => !item.offline && (item.models || []).length > 0,
        );
        if (fallback) {
          modelId = fallback.models[0];
          // TODO safe setPendingChat method replacement
          // _deps.setPendingChat({
          //   url: fallback.url,
          //   modelId,
          //   endpointId: fallback.endpoint_id,
          //   source: 'fallback',
          // });
        }
      }
    }
    const latestPending = _deps.getPendingChat && _deps.getPendingChat();
    if (
      !currentSessionId &&
      // !_autoSelectingDefault && // useless
      _modelList &&
      // window.modelsModule &&
      // window.modelsModule.getCachedItems &&
      (!modelId || (latestPending && latestPending.source === "fallback"))
    ) {
      // _ensureDefaultPendingChat();// TODO
    }
    updateModelLabel(modelId);
  }

  function toggleModelPicker() {
    isModelPickerOpen = !isModelPickerOpen;
    if (isModelPickerOpen && window.innerWidth >= 768) {
      const searchInput = document.getElementById(
        "model-picker-search",
      ) as HTMLInputElement;
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  }
  //---------------------------------------------------------------------------

  function onpointermove(event: PointerEvent): void {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }

  function _pushRecent(modelId: string): void {
    if (!modelId) return;
    const next = helper.loadRecent().filter((x) => x !== modelId);
    next.unshift(modelId);
    helper.saveRecent(next.slice(0, 5));
  }

  function _pick(m: ModelItem): void {
    currentModelId = m.mid;
    currentModelLogo = currentModelId ? providerLogo(currentModelId) : null
    _pushRecent(m.mid);
    console.log("made it");
    document.dispatchEvent(
      new CustomEvent("odysseus:model-picked", { detail: m }),
    );

    if (document.activeElement) {
      let e = document.activeElement as HTMLInputElement;
      e.blur();
    }

    // Refocus main textarea
    if (window.innerWidth >= 768) {
      const _ta = document.getElementById("message") as HTMLTextAreaElement;
      if (_ta) setTimeout(() => _ta.focus(), 50);
    }
    isModelPickerOpen = false;
    isOpen = false;
    searchQuery = "";

    // Update selected model
    if (selectedModelId !== m.mid) {
      selectedModelId = m.mid;
      console.log("made it 2");
      onModelChange(m);
      isOpen = false;
    }
  }
</script>

<div class="model-picker-wrap" bind:this={modelPickerElement}>
  <button
    type="button"
    class="model-picker-btn"
    onclick={toggleModelPicker}
    aria-label="Switch model"
    aria-expanded={isModelPickerOpen}
  >
    <span id="model-picker-label" bind:this={label}>
      <!-- test: assure currentModelLogo does not come from LLM output or user input -->
      {#if currentModelLogo}
      <span class="model-picker-logo">{@html currentModelLogo}</span>
      {/if}
      {currentModelId}
    </span>
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="6 15 12 9 18 15" />
    </svg>
  </button>
  {#if isModelPickerOpen}
    <div class="model-picker-menu {isOpen ? 'show' : ''}" class:show={isOpen}>
      <div class="model-picker-search-row">
        <input
          id="model-picker-search"
          type="text"
          {placeholder}
          bind:value={searchQuery}
          autocomplete="off"
          aria-label={placeholder}
        />
      </div>

      <div class="model-picker-list" id="model-picker-list">
        {#if allModels.length === 0}
          <div class="model-switch-empty">No models connected</div>
        {:else}
          {#each allModels as model (model.mid)}
            <ModelRow {model} {favorites} onPick={_pick} />
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
