/* ============================================
   STOP ROCK ABUSE - Site Search
   Client-side fuzzy search using Fuse.js
   ============================================ */

(function () {
  let fuse = null;
  let overlay, input, resultsEl;
  let activeIndex = -1;

  // Determine base path (handles subdirectory deploys like github.io/stop-rock-abuse/)
  const basePath = document.querySelector('script[src*="search.js"]')?.src
    .replace(/js\/search\.js.*$/, '') || '';

  function getBasePath() {
    // Find the path to search-index.json relative to current page
    const scripts = document.querySelectorAll('script[src*="search.js"]');
    for (const s of scripts) {
      return s.src.replace(/js\/search\.js.*$/, '');
    }
    return '';
  }

  async function loadIndex() {
    if (fuse) return;
    try {
      const base = getBasePath();
      const resp = await fetch(base + 'search-index.json');
      const data = await resp.json();
      fuse = new Fuse(data, {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'section', weight: 0.2 },
          { name: 'content', weight: 0.25 },
          { name: 'tags', weight: 0.15 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        includeMatches: true,
        minMatchCharLength: 2
      });
    } catch (e) {
      console.error('Search index load failed:', e);
    }
  }

  function highlightMatch(text, query) {
    if (!query || !text) return text || '';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escaped.split(/\s+/).join('|') + ')', 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function renderResults(query) {
    if (!fuse || !query || query.length < 2) {
      resultsEl.innerHTML = '';
      activeIndex = -1;
      return;
    }

    const results = fuse.search(query, { limit: 12 });

    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="search-no-results">No rocks found matching &ldquo;' +
        query.replace(/</g, '&lt;') + '&rdquo;. Try a different geological query.</div>';
      activeIndex = -1;
      return;
    }

    resultsEl.innerHTML = results.map((r, i) => {
      const item = r.item;
      return '<a href="' + item.url + '" class="search-result' + (i === 0 ? ' active' : '') + '">' +
        '<div class="search-result-section">' + (item.tags || []).join(' &middot; ') + '</div>' +
        '<div class="search-result-title">' + highlightMatch(item.title, query) + '</div>' +
        '<div class="search-result-snippet">' + highlightMatch(item.content, query) + '</div>' +
        '</a>';
    }).join('');

    activeIndex = 0;
  }

  function updateActive() {
    const items = resultsEl.querySelectorAll('.search-result');
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function openSearch() {
    loadIndex();
    overlay.classList.add('active');
    // Force reflow then set opacity for animation
    overlay.offsetHeight;
    input.value = '';
    resultsEl.innerHTML = '';
    activeIndex = -1;
    setTimeout(() => input.focus(), 50);
  }

  function closeSearch() {
    overlay.classList.remove('active');
  }

  function init() {
    // Create overlay HTML
    overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.innerHTML =
      '<div class="search-container">' +
        '<div class="search-input-wrap">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>' +
          '<input type="text" class="search-input" placeholder="Search rocks, articles, facts..." autocomplete="off" spellcheck="false">' +
        '</div>' +
        '<div class="search-hint"><kbd>Esc</kbd> to close &middot; <kbd>&uarr;&darr;</kbd> to navigate &middot; <kbd>Enter</kbd> to open</div>' +
        '<div class="search-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    input = overlay.querySelector('.search-input');
    resultsEl = overlay.querySelector('.search-results');

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSearch();
    });

    // Input handler
    let debounceTimer;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderResults(input.value.trim()), 150);
    });

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
      const items = resultsEl.querySelectorAll('.search-result');

      if (e.key === 'Escape') {
        closeSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive();
      } else if (e.key === 'Enter' && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      }
    });

    // Global keyboard shortcut: Ctrl+K or /
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === '/' && !overlay.classList.contains('active') &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        openSearch();
      }
    });

    // Wire up all search buttons
    document.querySelectorAll('.search-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openSearch();
      });
    });
  }

  // Load Fuse.js from CDN, then init
  if (!window.Fuse) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
    script.onload = init;
    document.head.appendChild(script);
  } else {
    init();
  }
})();
