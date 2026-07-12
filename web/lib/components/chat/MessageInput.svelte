<script lang="ts">
  import { onMount } from 'svelte';
  import { el } from '$lib/input/textareaUtils.js';
  import { autoResize, isLineBreakInputEvent, countLineBreaks, isMobileChatInput } from '$lib/input/textareaUtils.js';
  import { 
    handleMobileLineBreak, 
    shouldQueueFromMobileEnter, 
    handleGhostAutocomplete,
    isForegroundChatBusy
  } from '$lib/input/mobileHandlers.js';
  import { handleEnterKey, handleEscapeKey } from '$lib/input/keyboardHandlers.js';
  import ModelPicker from '$lib/components/chat/ModelPicker.svelte';
  import { type Toast } from '$lib/components/toast/store.js';

  // Props
  export let onSubmit: (message: string, files: any[]) => void = () => {};
  export let onModelChange?: (model: any) => void;
  export let placeholder: string = "Message Odysseus...";
  export let disabled: boolean = false;

  // Runes
  let message = $state('');
  let ghostText = $state('');
  let isModelPickerOpen = $state(false);
  let isTextareaFocused = $state(false);
  let isQueueActive = $state(false);
  let mobileLineBreakCount = $state(0);
  let toast = $state<Toast | null>(null);
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Refs
  let textareaElement: HTMLTextAreaElement;
  let ghostElement: HTMLElement;
  let modelPickerElement: HTMLElement;
  let messageForm: HTMLFormElement;
  let attachStripElement: HTMLElement;
  let fileInputElement: HTMLInputElement;

  // Helpers
  function show(message: string, duration: number = 2000) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage = message;
    toastVisible = true;
    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastMessage = '';
    }, duration);
  }

  function submitMessage() {
    if (!message.trim() && (!fileInputElement?.files?.length || fileInputElement.files.length === 0)) {
      show('Please enter a message');
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
    message = '';
    if (fileInputElement) {
      fileInputElement.value = '';
    }
    if (attachStripElement) {
      attachStripElement.innerHTML = '';
    }
  }

  function handleTextareaInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    message = target.value;
    
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

  function toggleModelPicker() {
    isModelPickerOpen = !isModelPickerOpen;
    if (isModelPickerOpen && window.innerWidth >= 768) {
      const searchInput = el('model-picker-search') as HTMLInputElement;
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  }

  function handleModelSelected(model: any) {
    if (onModelChange) {
      onModelChange(model);
    }
    show(`Using ${model.display}`);
  }

  function handleModelPicked(model: any) {
    // Model picker emits this event when a model is selected
    show(`Using ${model.display}`);
    isModelPickerOpen = false;
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
      attachStripElement.innerHTML = '';
      for (const file of input.files) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'attached-file';
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
    if (e.target.closest('button, input, textarea, select, label')) {
      return;
    }
    if (document.activeElement === textareaElement) {
      // We're in the input area, don't interfere
      return;
    }
    // Don't refocus if clicking attach button
    if (e.target.closest('.overflow-plus-btn')) {
      return;
    }
    // Don't refocus if clicking model picker button
    if (e.target.closest('.model-picker-btn')) {
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
    
    messageForm.addEventListener('submit', handleSubmit);
    
    return () => {
      messageForm.removeEventListener('submit', handleSubmit);
    };
  });

  // Keyboard navigation for model picker
  $effect(() => {
    if (isModelPickerOpen) {
      const searchInput = el('model-picker-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  });

  // Mobile keyboard refocus
  $effect(() => {
    if (isTextareaFocused) {
      textareaElement?.focus();
    }
  });

  onMount(() => {
    // Sync ghost text on mount
    syncGhostText(textareaElement);
    
    // Mobile enter key hint
    if (isMobileChatInput()) {
      const ta = textareaElement;
      if (ta) {
        ta.setAttribute('aria-label', 'Message input (newline sends message)');
        ta.setAttribute('placeholder', 'Message Odysseus... (newline sends)');
      }
    }
    
    // Global keyboard handlers
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    // Close picker on click outside
    document.addEventListener('click', (e) => {
      if (isModelPickerOpen) {
        const menu = modelPickerElement;
        const btn = el('model-picker-btn');
        if (menu && !menu.contains(e.target) && e.target !== btn) {
          isModelPickerOpen = false;
        }
      }
    });
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (isModelPickerOpen) {
        isModelPickerOpen = false;
      }
    }
  }

  // Expose submit function
  let submit = $derived.by(() => submitMessage);
  
  // Expose message state
  let clearMessage = $derived.by(() => {
    message = '';
    if (textareaElement) {
      textareaElement.focus();
    }
  });
  
  let focusMessage = $derived.by(() => {
    textareaElement.focus();
  });
</script>

<div class="chat-input-top">
  <div 
    class="ghost-text-overlay" 
    {ariaHidden: true}
    bind:this={ghostElement}
  >
    {ghostText}
  </div>
  
  <textarea
    bind:this={textareaElement}
    bind:value={message}
    {placeholder}
    {disabled}
    rows="1"
    aria-label={isMobileChatInput() ? 'Message input (newline sends message)' : 'Message input'}
    use:autoResize
    on:input={handleTextareaInput}
    on:beforeinput={handleTextareaBeforeInput}
    on:keydown={handleTextareaKeyDown}
    on:paste={handleTextareaPaste}
    on:focus={() => isTextareaFocused = true}
    on:blur={() => isTextareaFocused = false}
    class:mobile-mode={isMobileChatInput()}
  />
  
  <!-- Model picker -->
  <div class="model-picker-wrap">
    <button 
      type="button" 
      class="model-picker-btn" 
      onclick={toggleModelPicker}
      aria-label="Switch model"
      aria-expanded={isModelPickerOpen}
    >
      <span id="model-picker-label">
        {selectedModelName}
      </span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 15 12 9 18 15"/>
      </svg>
    </button>
    
    <ModelPicker
      bind:isOpen={isModelPickerOpen}
      on:modelselected={handleModelSelected}
      on:odysseus:model-picked={handleModelPicked}
    />
  </div>
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 15 12 9 18 15"/>
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="send-btn-label">+ New</span>
    </button>
  </div>
</div>

<form id="chat-form" class="hidden">
  <input type="hidden" name="message" value={message}>
</form>

<!-- Hidden file input -->
<input 
  type="file" 
  id="file-input" 
  class="hidden" 
  multiple 
  bind:this={fileInputElement}
  on:change={handleFileChange}
/>

<!-- Attachments strip -->
<div 
  id="attach-strip" 
  class="attach-strip" 
  bind:this={attachStripElement}
></div>

<!-- Hidden elements for state -->
<input type="checkbox" id="research-toggle" class="hidden">
<input type="checkbox" id="rag-toggle" class="hidden">
<input type="checkbox" id="incognito-toggle" class="hidden">

<!-- Toast notification -->
{#if toastVisible}
  <div class="toast {toastError ? 'error' : ''}">
    {toastMessage}
  </div>
{/if}