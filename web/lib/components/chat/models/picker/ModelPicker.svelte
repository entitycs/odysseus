<script lang="ts">
  import { onMount } from "svelte";
  import {
    isLoading,
    type ModelItem,
    modelItems,
  } from "$lib/components/chat/models/modelItemStore.svelte";
  import helper from "$lib/components/chat/models/picker/helpers.svelte";
  import ModelRow from "$lib/components/chat/models/picker/ModelRow.svelte";
  import ModelSection from "$lib/components/chat/models/picker/ModelSection.svelte";
  import { shortModel } from "$lib/legacy/model/models";
  import { refreshModels } from "$lib/legacy/models.js";
  import { providerLogo } from "$lib/legacy/providers";
  import sessionModule, * as _deps from "$lib/legacy/sessions";
  import uiModule from "$lib/legacy/ui";

  let modelPickerElement: HTMLElement;
  let label: HTMLElement;
  let search: HTMLInputElement;

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
  let searchedModels: ModelItem[] = $derived(
    searchQuery == ""
      ? []
      : allModels.filter((m) => {
          const res = [m.mid, m.display, m.epName] // m.providerText, provName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(searchQuery);
          return res;
        }),
  );
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

  // $inspect(currentModelId);
  // $inspect(selectedModelId);
  // $inspect(_modelList);
  $inspect(searchQuery);
  $inspect(searchedModels);
  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (isModelPickerOpen) {
        isModelPickerOpen = false;
      }
    }
  }

  onMount(async () => {
    // modelsModule.init();
    // modelsModule.refreshModels();
    await refreshModels();
    unsubscribeModelItems = modelItems.subscribe(async (value) => {
      _modelList = value;
      allModels = _modelList[0]?.models;
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
    if (_modelList[0]?.models?.length > 0) allModels = helper.getAllModels();

    // Global keyboard handlers
    document.addEventListener("keydown", handleGlobalKeyDown);

    console.log(allModels);
    // return () => {
    //   document.removeEventListener("keydown", handleGlobalKeyDown);
    // };
  });
  //---------------------------------------------------------------------------

  export function updateModelLabel(modelId: string) {
    console.log("updating model label: " + modelId);
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

  function toggleModelPicker(e: Event) {
    e.stopPropagation();
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
  function _pickerModelKey(m) {
    if (!m) return "";
    return `${m.endpointId || m.url || m.epName || "model"}::${m.mid || ""}`;
  }
  let _defaultPendingSeq = 0;
  async function _pick(m: ModelItem): Promise<void> {
    _defaultPendingSeq++;
    try {
      window.__odysseusLastPickedRoute = {
        model: m.mid || "",
        endpoint_url: m.url || "",
        endpoint_id: m.endpointId || "",
        display: m.display || m.mid || "",
        picked_at: Date.now(),
      };
    } catch (_) {}
    let switchDone = null;
    const switchPromise = new Promise((resolve) => {
      switchDone = resolve;
    });
    try {
      window.__odysseusModelSwitchPromise = switchPromise;
    } catch (_) {}
    const finishSwitch = () => {
      try {
        if (switchDone) switchDone();
        if (window.__odysseusModelSwitchPromise === switchPromise)
          delete window.__odysseusModelSwitchPromise;
      } catch (_) {}
    };
    const currentSessionId = _deps.getCurrentSessionId();
    const _pendingChat = _deps.getPendingChat();

    // Remember this pick so it surfaces under "Recent" next time the picker
    // opens — the whole point of quick-switch.
    if (m && m.mid) _pushRecent(_pickerModelKey(m) || m.mid);

    // Broadcast immediately so listeners (e.g. the tour) can advance without
    // waiting for the async session-create/PATCH that follows.
    try {
      document.dispatchEvent(
        new CustomEvent("odysseus:model-picked", { detail: m }),
      );
    } catch {}

    // Blur search input before closing to dismiss keyboard on mobile
    if (document.activeElement) document.activeElement.blur();
    isModelPickerOpen = false;
    // Refocus main textarea — skip on mobile to avoid keyboard bounce
    if (window.innerWidth >= 768) {
      const _ta = document.getElementById("message");
      if (_ta) setTimeout(() => _ta.focus(), 50);
    }
    if (!currentSessionId && _pendingChat) {
      // Already have a deferred session — just update the model
      _deps.setPendingChat({
        url: m.url,
        modelId: m.mid,
        endpointId: m.endpointId,
        source: "manual",
      });
      // Header stays as session name — model switch only updates picker
      updateModelPicker();
      uiModule.showToast(`Using ${m.display}`);
      finishSwitch();
      return;
    } else if (!currentSessionId) {
      // No session yet — create one with this model
      try {
        await _deps.createDirectChat(m.url, m.mid, m.endpointId);
      } catch (e) {
        uiModule.showError("Failed to start chat: " + e);
        finishSwitch();
        return;
      }
    } else {
      // Existing session with no model — PATCH it
      const sessions = _deps.getSessions();
      const s = sessions.find((x) => x.id === currentSessionId);
      if (s) {
        s.model = m.mid;
        s.endpoint_url = m.url;
        s.endpoint_id = m.endpointId || s.endpoint_id || "";
      }
      updateModelPicker();
      const fd = new FormData();
      fd.append("model", m.mid);
      fd.append("endpoint_url", m.url);
      if (m.endpointId) fd.append("endpoint_id", m.endpointId);
      try {
        const res = await fetch(`/api/session/${currentSessionId}`, {
          method: "PATCH",
          body: fd,
        });
        if (!res.ok) {
          uiModule.showError("Failed to set model");
          finishSwitch();
          return;
        }
        // Header stays as session name — model info shown in picker only
      } catch (e) {
        uiModule.showError("Failed to set model: " + e);
        finishSwitch();
        return;
      }
    }
    // Update picker visibility — model is now set
    updateModelPicker();
    if (window.refreshChatContextHeader)
      window.refreshChatContextHeader("model-pick");
    uiModule.showToast(`Using ${m.display}`);
    finishSwitch();
  }
</script>

<svelte:body
  onclick={(e) => {
    if (e.target !== e.currentTarget) return; // click did not start on body
    if (isModelPickerOpen) isModelPickerOpen = false;
  }}
/>

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
    <div
      class="model-picker-menu {isOpen ? 'show' : ''}"
      class:show={isOpen}
    >
      <div class="model-picker-search-row">
        <input
          id="model-picker-search"
          bind:this={search}
          type="text"
          {placeholder}
          bind:value={searchQuery}
          autocomplete="off"
          aria-label={placeholder}
          onclick={(e) => e.stopPropagation()}
          oninput={() => {
            searchQuery = search.value;
          }}
        />
      </div>

      <div  id="model-picker-list" class="model-picker-list {searchQuery == ''
        ? ''
        : 'min-h-[280px]'}">
        <!-- Active Search -->
        {#if searchedModels.length}
          <ModelSection label="{searchedModels.length} Results" />
        {/if}
        {#each searchedModels as model (model)}
          <hr />
          <hr />
          <ModelRow
            {model}
            {favorites}
            onPick={_pick}
            onToggleFavorite={helper.toggleFavorite}
          />
          <hr />
        {:else}
          {#if searchQuery != ""}
            <ModelSection label="0 Search Results" />
          {/if}
          <!-- Empty Search -->
          {#if favorites.length}
            <ModelSection label="Favorites" />
            {#each favorites as model (model)}
              <ModelRow {model} {favorites} />
            {/each}
          {/if}
          {#if recent.length}
            <ModelSection label="Recent" />
            {#each recent as model (model)}
              <ModelRow model={{ display: shortModel(model) }} {favorites} />
            {/each}
          {/if}
          {#each allModels as model (model)}
            <ModelRow
              {model}
              {favorites}
              onPick={_pick}
              onToggleFavorite={helper.toggleFavorite}
            />
          {:else}
            <div class="model-switch-empty">No models connected</div>
          {/each}
        {/each}
      </div>
    </div>
  {/if}
</div>
