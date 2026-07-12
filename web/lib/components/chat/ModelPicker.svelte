<script lang="ts">
  import { writable } from 'svelte/store';
  import { sortModelObjects } from '$lib/legacy/modelSort.js';
  import { providerLogo } from '$lib/legacy/providers.js';

  interface Props {
    isOpen?: boolean;
    selectedModelId?: string | null;
    placeholder?: string;
  }

  let {
    isOpen = false,
    selectedModelId = null,
    placeholder = 'Search models...',
  } : Props = $props();

  let searchQuery = $state('');

  // Store for models and favorites
  let models = $derived(loadModels());
  let favorites = $derived(loadFavorites());
  let recent = $derived(loadRecent());
  let allModels = $derived(getAllModels());

  // Local state
  let _isAnimating = $state(false);

  // Provider display names
  const PROVIDER_NAMES: Record<string, string> = {
    '01-ai': 'Yi',
    abacusai: 'Abacus AI',
    adept: 'Adept',
    ai21: 'AI21 Labs',
    'aion-labs': 'Aion Labs',
    aisingapore: 'AI Singapore',
    allenai: 'Allen AI',
    amazon: 'Amazon',
    'anthracite-org': 'Anthracite',
    anthropic: 'Anthropic',
    'arcee-ai': 'Arcee AI',
    baai: 'BAAI',
    baidu: 'Baidu',
    bigcode: 'BigCode',
    'black-forest-labs': 'Black Forest Labs',
    bytedance: 'ByteDance',
    'bytedance-seed': 'ByteDance',
    cognitivecomputations: 'Cognitive Computations',
    cohere: 'Cohere',
    databricks: 'Databricks',
    deepcogito: 'DeepCogito',
    deepseek: 'DeepSeek',
    'deepseek-ai': 'DeepSeek',
    essentialai: 'Essential AI',
    google: 'Google',
    gryphe: 'Gryphe',
    ibm: 'IBM',
    'ibm-granite': 'IBM Granite',
    inception: 'Inception',
    inclusionai: 'Inclusion AI',
    inflection: 'Inflection',
    kwaipilot: 'KwaiPilot',
    liquid: 'Liquid AI',
    mancer: 'Mancer',
    meta: 'Llama',
    'meta-llama': 'Llama',
    microsoft: 'Microsoft',
    minimax: 'MiniMax',
    minimaxai: 'MiniMax',
    mistralai: 'Mistral',
    moonshotai: 'Moonshot',
    morph: 'Morph',
    'nex-agi': 'Nex AGI',
    nousresearch: 'Nous Research',
    'nv-mistralai': 'NVIDIA x Mistral',
    nvidia: 'NVIDIA',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    perceptron: 'Perceptron',
    perplexity: 'Perplexity',
    poolside: 'Poolside',
    'prime-intellect': 'Prime Intellect',
    qwen: 'Qwen',
    rekaai: 'Reka',
    relace: 'Relace',
    sao10k: 'Sao10k',
    sarvamai: 'Sarvam AI',
    snowflake: 'Snowflake',
    stepfun: 'StepFun',
    'stepfun-ai': 'StepFun',
    stockmark: 'Stockmark',
    switchpoint: 'SwitchPoint',
    tencent: 'Tencent',
    thedrummer: 'TheDrummer',
    undi95: 'Undi95',
    upstage: 'Upstage',
    writer: 'Writer',
    'x-ai': 'xAI',
    xiaomi: 'Xiaomi',
    'z-ai': 'Zhipu',
    zyphra: 'Zyphra',
    '~anthropic': 'Anthropic',
    '~google': 'Google',
    '~moonshotai': 'Moonshot',
    '~openai': 'OpenAI',
  };

  const PROVIDER_ALIAS: Record<string, string> = {
    'meta-llama': 'meta',
    deepseek: 'deepseek-ai',
    minimaxai: 'minimax',
    'stepfun-ai': 'stepfun',
    ai21labs: 'ai21',
    'ibm-granite': 'ibm',
    'bytedance-seed': 'bytedance',
    '~anthropic': 'anthropic',
    '~google': 'google',
    '~moonshotai': 'moonshotai',
    '~openai': 'openai',
  };

  function providerDisplayName(slug: string): string {
    return (
      PROVIDER_NAMES[slug] ||
      slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    );
  }

  function providerSlug(mid: string): string {
    const slash = mid.indexOf('/');
    let slug = slash > 0 ? mid.substring(0, slash) : 'other';
    return PROVIDER_ALIAS[slug] || slug;
  }

  function _loadList(key: string): any[] {
    try {
      const a = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }

  function _saveList(key: string, list: any[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* quota / private mode */
    }
  }

  function _loadFavorites(): string[] {
    return _loadList('odysseus-model-favorites');
  }

  function _toggleFavorite(mid: string): boolean {
    const favs = _loadFavorites();
    const i = favs.indexOf(mid);
    if (i >= 0) favs.splice(i, 1);
    else favs.push(mid);
    _saveList('odysseus-model-favorites', favs);

    // Refresh favorites
    favorites = _loadFavorites();

    return i < 0; // true when now favorited
  }

  function _loadRecent(): string[] {
    return _loadList('odysseus-model-recent');
  }

  function _pushRecent(mid: string): void {
    if (!mid) return;
    const next = _loadRecent().filter((x) => x !== mid);
    next.unshift(mid);
    _saveList('odysseus-model-recent', next.slice(0, 5));
  }

  function loadModels(): any[] {
    return window.modelsModule?.getCachedItems?.() || [];
  }

  function loadFavorites(): string[] {
    return _loadFavorites();
  }

  function loadRecent(): string[] {
    return _loadRecent();
  }

  function getAllModels(): any[] {
    const items = loadModels();
    const result: any[] = [];
    const seen = new Set();

    items.forEach((item) => {
      const epOffline = !!item.offline;
      const allModels = (item.models || []).concat(item.models_extra || []);
      const allDisplay = (item.models_display || []).concat(
        item.models_extra_display || []
      );

      const probeResult = item.endpoint_id
        ? { alive: !item.ping_error, latency_ms: 0, error: item.ping_error }
        : null;
      const isLocalDead = !!(probeResult && probeResult.alive === false);

      allModels.forEach((mid, i) => {
        if (seen.has(mid)) return;
        seen.add(mid);
        result.push({
          mid,
          display: (allDisplay[i] || mid).split('/').pop(),
          url: item.url,
          endpointId: item.endpoint_id,
          epName: item.endpoint_name || '',
          providerText: [
            item.endpoint_name || '',
            item.category || '',
            item.host || '',
            item.url || '',
          ]
            .filter(Boolean)
            .join(' '),
          stale: isLocalDead || epOffline,
          staleReason: epOffline
            ? item.ping_error || 'endpoint offline'
            : isLocalDead
              ? probeResult.error || 'not responding'
              : '',
          offline: epOffline,
        });
      });
    });

    return sortModelObjects(result);
  }

  function _populate() {
    const listEl = document.getElementById('model-picker-list');
    const search = document.getElementById('model-picker-search') as HTMLInputElement;
    if (!listEl) return;

    listEl.innerHTML = '';

    const all = allModels;
    const q = search?.value.trim().toLowerCase() || '';
    const hasAnyModel = all.length > 0;

    listEl.classList.toggle('is-empty', !hasAnyModel);

    if (search) {
      search.placeholder = hasAnyModel ? 'Search models…' : 'No models connected';
    }

    if (!hasAnyModel) return;

    const byId = new Map();
    all.forEach((m) => {
      if (!byId.has(m.mid)) byId.set(m.mid, m);
    });

    const favs = favorites;
    const seen = new Set<string>();

    function _addSection(label: string): void {
      const el = document.createElement('div');
      el.className = 'mp-section-label';
      el.textContent = label;
      listEl.appendChild(el);
    }

    function _addEmpty(text: string): void {
      const empty = document.createElement('div');
      empty.className = 'model-switch-empty';
      empty.textContent = text;
      listEl.appendChild(empty);
    }

    function _addRow(m: any): void {
      const row = document.createElement('div');
      row.className = 'model-switch-item';
      if (m.stale) {
        row.classList.add('model-switch-stale');
        row.style.opacity = '0.45';
        row.title = `Local server appears offline: ${m.staleReason}. Click to try anyway, or relaunch in Cookbook.`;
      }

      const _mlogo = providerLogo(m.mid);
      if (_mlogo) {
        const logoSpan = document.createElement('span');
        logoSpan.className = 'provider-logo';
        logoSpan.style.opacity = '0.6';
        logoSpan.innerHTML = _mlogo;
        row.appendChild(logoSpan);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'mp-model-name';
      nameSpan.textContent = m.display;
      nameSpan.title = m.display;
      row.appendChild(nameSpan);

      const epSpan = document.createElement('span');
      epSpan.className = 'model-switch-ep';
      const _epDisplay =
        m.epName &&
        !m.display.toLowerCase().includes(m.epName.toLowerCase().split('/').pop())
          ? m.epName
          : '';
      epSpan.textContent = _epDisplay;
      row.appendChild(epSpan);

      const favDot = document.createElement('button');
      favDot.type = 'button';
      favDot.className = 'mp-fav-dot' + (favs.includes(m.mid) ? ' active' : '');
      favDot.textContent = '●';
      favDot.addEventListener('click', (e) => {
        e.stopPropagation();
        const nowFav = _toggleFavorite(m.mid);
        favDot.classList.toggle('active', nowFav);
        favDot.classList.remove('pulse');
        void favDot.offsetWidth;
        favDot.classList.add('pulse');
      });
      row.appendChild(favDot);

      row.addEventListener('click', () => _pick(m));
      listEl.appendChild(row);
    }

    // Search mode
    if (q) {
      const matches = all.filter((m) => {
        const provName = providerDisplayName(providerSlug(m.mid)).toLowerCase();
        return [m.mid, m.display, m.epName, m.providerText, provName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
      if (matches.length === 0) _addEmpty('No matching models');
      else matches.forEach(_addRow);
      return;
    }

    // Browse mode
    const BROWSE_ALL_LIMIT = 12;
    const favModels = favs.map((id) => byId.get(id)).filter(Boolean);

    if (favModels.length) {
      _addSection('Favorites');
      favModels.forEach((m) => {
        if (seen.has(m.mid)) return;
        seen.add(m.mid);
        _addRow(m);
      });
    }

    if (all.length > BROWSE_ALL_LIMIT) {
      const recentModels = _loadRecent()
        .map((id) => byId.get(id))
        .filter(Boolean)
        .filter((m) => !seen.has(m.mid))
        .slice(0, 5);

      if (recentModels.length) {
        _addSection('Recent');
        recentModels.forEach((m) => {
          if (seen.has(m.mid)) return;
          seen.add(m.mid);
          _addRow(m);
        });
      }
    }

    if (all.length <= BROWSE_ALL_LIMIT) {
      const rest = all.filter((m) => !seen.has(m.mid));
      if (rest.length) {
        if (seen.size) _addSection('All models');
        rest.forEach(_addRow);
      }
    }
  }

  function _pick(m: any): void {
    _pushRecent(m.mid);
    document.dispatchEvent(new CustomEvent('odysseus:model-picked', { detail: m }));

    if (document.activeElement) {
      document.activeElement.blur();
    }

    // Refocus main textarea
    if (window.innerWidth >= 768) {
      const _ta = document.getElementById('message') as HTMLTextAreaElement;
      if (_ta) setTimeout(() => _ta.focus(), 50);
    }

    isOpen = false;
    searchQuery = '';

    // Update selected model
    if (selectedModelId !== m.mid) {
      selectedModelId = m.mid;
      dispatchEvent(new CustomEvent('modelchange', { detail: m }));
    }
  }

  // Watch for search changes
  $effect(() => {
    if (isOpen) {
      _populate();
    }
  });

  // Watch for model selection changes
  $effect(() => {
    if (selectedModelId) {
      dispatchEvent(new CustomEvent('modelselected', { detail: selectedModelId }));
    }
  });

  // Listen for refresh events
  $effect(() => {
    const handler = () => {
      allModels = getAllModels();
      if (isOpen) _populate();
    };

    if (window.modelsModule?.refreshModels) {
      window.addEventListener('modelsrefreshed', handler);
    }

    return () => {
      window.removeEventListener('modelsrefreshed', handler);
    };
  });
</script>

<div
  class="model-picker-menu {isOpen ? 'show' : ''} {_isAnimating ? 'closing' : ''}"
  class:show={isOpen}
>
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
        <div
          class="model-switch-item {model.stale ? 'model-switch-stale' : ''}"
          onclick={() => _pick(model)}
          class:fav-active={favorites.includes(model.mid)}
          data-model-id={model.mid}
        >
          <span class="provider-logo">{providerLogo(model.mid)}</span>
          <span class="mp-model-name">{model.display}</span>
          <span class="model-switch-ep">{model.epName}</span>
          <button type="button" class="mp-fav-dot {favorites.includes(model.mid) ? 'active' : ''}" aria-label="Toggle favorite">
            ●
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>
