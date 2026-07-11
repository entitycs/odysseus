<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import ModelPicker from "$lib/components/chat/models/picker/ModelPicker.svelte";
  import Toast from "$lib/components/toast/Toast.svelte";
  import {
    handleEnterKey,
    handleEscapeKey,
  } from "$lib/input/keyboardHandlers.js";
  import {
    handleGhostAutocomplete,
    handleMobileLineBreak,
    isForegroundChatBusy,
    shouldQueueFromMobileEnter,
  } from "$lib/input/mobileHandlers.js";
  import {
    autoResize,
    countLineBreaks,
    el,
    isLineBreakInputEvent,
    isMobileChatInput,
  } from "$lib/input/textareaUtils.js";
  import chatModule from "$lib/legacy/chat";
    import { isOpen } from "$lib/legacy/emailLibrary";
  import fileHandlerModule from "$lib/legacy/fileHandler";
  import sessionModule from "$lib/legacy/sessions";
    import { modelItems, refreshModels } from "./models/modelItemStore.svelte";
  import QueuedMessageItem from "./QueuedMessageItem.svelte";

  // Props
  interface Props {
    sessionId: string | null;
    onSubmit?: (message: string, files: any[]) => void;
    onModelChange?: (model: any) => void;
    placeholder?: string;
    disabled?: boolean;
  }

  let {
    sessionId = null,
    onSubmit = () => {},
    onModelChange = handleModelPicked,
    placeholder = "Message Odysseus...",
    disabled = false,
  }: Props = $props();

  // Runes

  let message = $state("");
  let ghostText = $state("");
  let isTextareaFocused = $state(false);
  let isQueueActive = $state(false);
  let mobileLineBreakCount = $state(0);
  let toast = $state<Toast | null>(null);
  let toastVisible = $state(false);
  let toastMessage = $state("");
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Refs
  let textareaElement: HTMLTextAreaElement;
  let ghostElement: HTMLElement;
  // let modelPickerElement: HTMLElement;
  let messageForm: HTMLFormElement;
  let attachStripElement: HTMLElement;
  let fileInputElement: HTMLInputElement;

  //----------------------------------------------------------------------------
  function generateId() {
    return Math.random().toString(36).substring(2, 9);
  }
  let messageQueue: Array<{ id: string; prompt: string; files: any[] }> =
    $state([]);
  let editingMessageId: string | null = null;

  function onQueueSendNow(id: string) {
    const idx = messageQueue.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const msg = messageQueue[idx];
    messageQueue.splice(idx, 1);
    messageQueue = messageQueue;

    const ta = document.getElementById("message") as HTMLTextAreaElement;
    if (ta) {
      ta.value = msg.prompt;
      if (msg.files && msg.files.length > 0 && fileHandlerModule) {
        fileHandlerModule.clearPending();
        fileHandlerModule.addFiles(msg.files);
        fileHandlerModule.renderAttachStrip();
      }
      if (chatModule && chatModule.handleChatSubmit) {
        // TODO - this will cancel the current submission if called once
        chatModule.handleChatSubmit(new Event("submit"));
      }
    }
  }

  function onQueueEdit(id: string) {
    const idx = messageQueue.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const msg = messageQueue[idx];
    // messageQueue.splice(idx, 1);
    // messageQueue = messageQueue;

    const ta = document.getElementById("message") as HTMLTextAreaElement;
    if (ta) {
      ta.value = msg.prompt;
      if (msg.files && msg.files.length > 0 && fileHandlerModule) {
        fileHandlerModule.clearPending();
        fileHandlerModule.addFiles(msg.files);
        fileHandlerModule.renderAttachStrip();
      }
      ta.focus();
      // Mark this message as being edited
      editingMessageId = id;
    }
  }

  function onQueueDelete(id: string) {
    messageQueue = messageQueue.filter((m) => m.id !== id);
  }

  function handleChatSubmitWithQueue(e: Event) {
    e.preventDefault();

    const sid = sessionId;//sessionModule ? sessionModule.getCurrentSessionId() : null;
    const isStreaming =
      chatModule && chatModule.hasActiveStream
        ? chatModule.hasActiveStream(sid)
        : false;

    if (isStreaming) {
      const ta = document.getElementById("message") as HTMLTextAreaElement;
      const prompt = ta ? ta.value.trim() : "";

      if (
        !prompt &&
        (!fileHandlerModule || fileHandlerModule.getPendingCount() === 0)
      ) {
        console.log("empty message");
        return;
      }

      const files =
        fileHandlerModule &&
        typeof fileHandlerModule.getPendingRaw === "function"
          ? [...fileHandlerModule.getPendingRaw()]
          : [];

      console.log("adding message to queue");

      if (editingMessageId) {
        // Update existing queued message
        const idx = messageQueue.findIndex((m) => m.id === editingMessageId);
        if (idx !== -1) {
          messageQueue[idx].prompt = prompt;
          messageQueue[idx].files = files;
        }
        editingMessageId = null; // clear edit mode
      } else {
        // Normal behavior: push new message
        messageQueue.push({
          id: generateId(),
          prompt,
          files,
        });
      }

      if (ta) ta.value = "";
      if (fileHandlerModule) {
        fileHandlerModule.clearPending();
      }

      console.log("checking streaming status for dequeuing");
      checkQueueDrain();
    } else {
      console.log("not streaming");
      handleSubmit(e);
    }
  }

  let drainInterval: any;
  function checkQueueDrain() {
    if (drainInterval) return;
    drainInterval = setInterval(() => {
      const sid = sessionId;//sessionModule ? sessionModule.getCurrentSessionId() : null;
      const isStreaming =
        chatModule && chatModule.hasActiveStream
          ? chatModule.hasActiveStream(sid)
          : false;

      if (!isStreaming) {
        clearInterval(drainInterval);
        drainInterval = null;

        if (messageQueue.length > 0) {
          const next = messageQueue[0];
          onQueueSendNow(next.id);
          setTimeout(checkQueueDrain, 1000);
        }
      }
    }, 500);
  }

  //----------------------------------------------------------------------------
  // Helpers
  function show(message: string, duration: number = 2000) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage = message;
    toastVisible = true;
    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastMessage = "";
    }, duration);
  }

  function submitMessage() {
    if (
      !message.trim() &&
      (!fileInputElement?.files?.length || fileInputElement.files.length === 0)
    ) {
      show("Please enter a message");
      return;
    }

    const files: any[] = [];
    if (fileInputElement && fileInputElement.files?.length > 0) {
      for (const file of fileInputElement.files) {
        files.push(file);
      }
    }

    onSubmit(message.trim(), files);

    // Reset message
    message = "";
    if (fileInputElement) {
      fileInputElement.value = "";
    }
    if (attachStripElement) {
      attachStripElement.innerHTML = "";
    }
  }

  function handleTextareaInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    message = target.value;
    let previousValue = ghostText;
    // Auto-resize
    autoResize(target);

    // Update ghost text
    ghostText = target.value;

    // Mobile line break handling
    if (handleMobileLineBreak(e as InputEvent, previousValue)) {
      return;
    }
  }

  function handleTextareaBeforeInput(e: InputEvent) {
    // Mobile line break detection
    if (handleMobileLineBreak(e, message)) {
      return;
    }
  }

  function handleTextareaKeyDown(e: KeyboardEvent) {
    const ta = textareaElement;
    if (!ta) return;

    // Ghost autocomplete
    if (handleGhostAutocomplete(e)) {
      return;
    }

    // Enter key handling
    if (handleEnterKey(e, message)) {
      return;
    }

    // Escape key
    if (handleEscapeKey(e)) {
      return;
    }
  }

  function handleTextareaPaste(e: ClipboardEvent) {
    // Auto-resize after paste
    setTimeout(() => {
      if (textareaElement) {
        autoResize(textareaElement);
      }
    }, 1);
  }



  function handleModelSelected(model: any) {
    if (onModelChange) {
      onModelChange(model);
    }
    show(`Using ${model.display}`);
  }

  function handleModelPicked(model: any) {
    console.log("made it 3");
    console.log(model);
    // if (onModelChange) {
    //   onModelChange(model);
    // }
    // Model picker emits this event when a model is selected
    show(`Using ${model.display}`);
    // currentModelId = model.mid
    // isModelPickerOpen = false;
  }

  function handleAttachFiles() {
    if (fileInputElement) {
      fileInputElement.click();
    }
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length > 0 && attachStripElement) {
      // Render attach strip
      attachStripElement.innerHTML = "";
      for (const file of input.files) {
        const fileDiv = document.createElement("div");
        fileDiv.className = "attached-file";
        fileDiv.textContent = file.name;
        attachStripElement.appendChild(fileDiv);
      }
      // Focus textarea
      setTimeout(() => textareaElement.focus(), 100);
    }
  }

  // Sync ghost text with textarea
  function syncGhostText(textarea: HTMLTextAreaElement) {
    ghostElement.textContent = textarea.value;
  }

  // Form submission
  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isQueueActive) {
      submitMessage();
    }
  }

  // Mobile touch handlers
  function handleTouchStart(e: TouchEvent) {
    if (e.target.closest("button, input, textarea, select, label")) {
      return;
    }
    if (document.activeElement === textareaElement) {
      // We're in the input area, don't interfere
      return;
    }
    // Don't refocus if clicking attach button
    if (e.target.closest(".overflow-plus-btn")) {
      return;
    }
    // Don't refocus if clicking model picker button
    if (e.target.closest(".model-picker-btn")) {
      return;
    }
  }

  function handleTouchEnd() {
    // Handle the refocus logic on mobile
    if (isMobileChatInput()) {
      if (document.activeElement === textareaElement) {
        textareaElement.focus();
      }
    }
  }

  // Form reference
  $effect(() => {
    if (!messageForm) return;

    messageForm.addEventListener("submit", handleSubmit);

    return () => {
      messageForm.removeEventListener("submit", handleSubmit);
    };
  });

  // Keyboard navigation for model picker
  // $effect(() => {
  //   if (isModelPickerOpen) {
  //     const searchInput = el("model-picker-search") as HTMLInputElement;
  //     if (searchInput) {
  //       searchInput.focus();
  //     }
  //   }
  // });

  // Mobile keyboard refocus
  $effect(() => {
    if (isTextareaFocused) {
      textareaElement?.focus();
    }
  });
  let unsubscribeModelItems;
  let _modelList;
  // let sessionId: string = $state('');
  let modelPicker;
  onMount(() => {

      // refreshModels();
      unsubscribeModelItems = modelItems.subscribe(async (value) => {

         _modelList = value;
       });

    // Sync ghost text on mount
    syncGhostText(textareaElement);

    // Mobile enter key hint
    if (isMobileChatInput()) {
      const ta = textareaElement;
      if (ta) {
        ta.setAttribute("aria-label", "Message input (newline sends message)");
        ta.setAttribute("placeholder", "Message Odysseus... (newline sends)");
      }
    }

    // // Global keyboard handlers
    // document.addEventListener("keydown", handleGlobalKeyDown);

    // // Close picker on click outside
    // document.addEventListener("click", (e) => {
    //   if (isModelPickerOpen) {
    //     const menu = modelPickerElement;
    //     const btn = el("model-picker-btn");
    //     if (menu && !menu.contains(e.target) && e.target !== btn) {
    //       isModelPickerOpen = false;
    //     }
    //   }
    // });

    // return () => {
    //   document.removeEventListener("keydown", handleGlobalKeyDown);
    // };
  });



  // Expose submit function
  let submit = $derived.by(() => submitMessage);

  // Expose message state
  let clearMessage = $derived.by(() => {
    message = "";
    if (textareaElement) {
      textareaElement.focus();
    }
  });

  let focusMessage = $derived.by(() => {
    textareaElement.focus();
  });

</script>

<div class="chat-input-bar">
  {#if messageQueue.length > 0}
    <div
      class="message-queue-panel"
      style="max-height: 25vh; overflow-y: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; margin: 0 8px 8px 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
    >
      {#each messageQueue as queuedMessage (queuedMessage.id)}
        <QueuedMessageItem
          id={queuedMessage.id}
          content={queuedMessage.prompt}
          files={queuedMessage.files}
          onSendNow={onQueueSendNow}
          onEdit={onQueueEdit}
          onDelete={onQueueDelete}
        />
      {/each}
    </div>
  {/if}
  <div class="chat-input-top">
    <div class="ghost-text-overlay" bind:this={ghostElement}>
      {ghostText}
    </div>

    <textarea
      bind:this={textareaElement}
      bind:value={message}
      id="message"
      class="message"
      {placeholder}
      {disabled}
      rows="1"
      aria-label="Message input"
      use:autoResize
      oninput={handleTextareaInput}
      onbeforeinput={handleTextareaBeforeInput}
      onsubmit={handleChatSubmitWithQueue}
      onkeydown={handleTextareaKeyDown}
      onpaste={handleTextareaPaste}
      onfocus={() => (isTextareaFocused = true)}
      onblur={() => (isTextareaFocused = false)}
    ></textarea>

    <!-- Model picker -->

      <ModelPicker
        bind:this={modelPicker}
        {sessionId}
        // bind:isOpen={isModelPickerOpen}
        // bind:selectedModelId={currentModelId}
        placeholder="Select Model..."
        onModelChange={handleModelPicked}
      />

  </div>

  <div class="chat-input-bottom">
    <div class="chat-input-left">
      <!-- Overflow menu (+) -->
      <button
        type="button"
        class="input-icon-btn overflow-plus-btn"
        onclick={handleAttachFiles}
        aria-label="Attach files"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 15 12 9 18 15" />
        </svg>
        <span class="plus-active-dot"></span>
      </button>
    </div>

    <div class="chat-input-right">
      <button
        type="submit"
        form="chat-form"
        class="send-btn newchat-mode"
        data-mode="newchat"
        aria-label="Send message"
        disabled={disabled || !message?.trim()}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span class="send-btn-label">+ New</span>
      </button>
    </div>
  </div>
</div>
<form id="chat-form" class="hidden" bind:this={messageForm}>
  <input type="hidden" name="message" value={message} />
</form>

<!-- Hidden file input -->
<input
  type="file"
  id="file-input"
  class="hidden"
  multiple
  bind:this={fileInputElement}
  onchange={handleFileChange}
/>

<!-- Attachments strip -->
<div
  id="attach-strip"
  class="attach-strip"
  bind:this={attachStripElement}
></div>

<!-- Hidden elements for state -->
<input type="checkbox" id="research-toggle" class="hidden" />
<input type="checkbox" id="rag-toggle" class="hidden" />
<input type="checkbox" id="incognito-toggle" class="hidden" />

<!-- Toast notification -->
{#if toastVisible}
  <div in:fly={{ y: 200, duration: 2000 }} out:fade class="svelte-toast">
    {toastMessage}
  </div>
{/if}

<style>
  .svelte-toast {
    position: fixed;
    top: 113px;
    right: 27rem;
    left: auto;
    bottom: auto;
    background: var(--panel);
    color: var(--fg);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-left: 3px solid var(--accent);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    opacity: 100%;
    transform: translateX(120%);
    transition:
      opacity 1.35s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.45s cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(12px);
    max-width: min(360px, calc(100vw - 32px));
    min-width: min(220px, calc(100vw - 32px));
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    z-index: 9999999999999999999999;
    display: block;
    width: 20rem;
    height: 3rem;
  }
</style>
