/**
 * Blog post renderer — loads posts from blog/posts.json
 * and renders them as news cards with filtering and pagination.
 */
(function () {
  const POSTS_PER_PAGE = 12;
  let allPosts = [];
  let displayedCount = 0;
  let activeFilter = 'all';

  const grid = document.getElementById('blog-posts');
  const loadMoreBtn = document.getElementById('load-more');
  const emptyState = document.getElementById('blog-empty');

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function categoryClass(cat) {
    const map = {
      discovery: 'cat-discovery',
      crisis: 'cat-crisis',
      space: 'cat-space',
      crime: 'cat-crime',
      volcanic: 'cat-volcanic',
      science: 'cat-science',
      culture: 'cat-culture',
    };
    return map[cat] || 'cat-science';
  }

  function createCard(post) {
    const card = document.createElement('article');
    card.className = 'news-card fade-in';
    card.dataset.category = post.category;
    card.id = post.id;

    card.innerHTML =
      '<div class="news-card-top">' +
        '<span class="news-category ' + categoryClass(post.category) + '">' +
          post.category.charAt(0).toUpperCase() + post.category.slice(1) +
        '</span>' +
        '<h3>' + escapeHtml(post.headline) + '</h3>' +
        '<div class="news-source">' +
          escapeHtml(post.source) + ' &bull; ' + formatDate(post.date) +
        '</div>' +
      '</div>' +
      '<div class="news-card-body">' +
        '<p class="news-summary">' + escapeHtml(post.summary) + '</p>' +
        '<div class="news-take">' +
          '<strong>Our Take:</strong> &ldquo;' + escapeHtml(post.take) + '&rdquo;' +
        '</div>' +
        '<a href="' + escapeHtml(post.sourceUrl) + '" class="news-link" target="_blank" rel="noopener">Read Original</a>' +
      '</div>';

    return card;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getFilteredPosts() {
    if (activeFilter === 'all') return allPosts;
    return allPosts.filter(function (p) { return p.category === activeFilter; });
  }

  function renderBatch() {
    var filtered = getFilteredPosts();
    var end = Math.min(displayedCount + POSTS_PER_PAGE, filtered.length);

    for (var i = displayedCount; i < end; i++) {
      var card = createCard(filtered[i]);
      grid.appendChild(card);
      // Trigger fade-in
      requestAnimationFrame(function (c) {
        return function () { c.classList.add('visible'); };
      }(card));
    }

    displayedCount = end;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = displayedCount >= filtered.length ? 'none' : '';
    }

    if (emptyState) {
      emptyState.style.display = filtered.length === 0 ? '' : 'none';
    }
  }

  function resetAndRender() {
    grid.innerHTML = '';
    displayedCount = 0;
    renderBatch();
  }

  // Category filter buttons
  document.querySelectorAll('.news-filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.news-filter-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      resetAndRender();
    });
  });

  // Load more button
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', renderBatch);
  }

  // Fetch posts
  fetch('blog/posts.json')
    .then(function (r) { return r.json(); })
    .then(function (posts) {
      allPosts = posts;
      if (posts.length === 0) {
        if (emptyState) emptyState.style.display = '';
        return;
      }
      renderBatch();

      // Scroll to hash target if present
      if (window.location.hash) {
        var target = document.getElementById(window.location.hash.slice(1));
        if (target) {
          // May need to load more posts first
          while (!target && displayedCount < getFilteredPosts().length) {
            renderBatch();
            target = document.getElementById(window.location.hash.slice(1));
          }
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    })
    .catch(function (err) {
      console.error('Failed to load blog posts:', err);
      if (emptyState) emptyState.style.display = '';
    });
})();
