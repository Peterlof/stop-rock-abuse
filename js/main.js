/* ============================================
   STOP ROCK ABUSE - Main JavaScript
   A Geological Mockumentary Website
   ============================================ */

(function () {
  'use strict';

  // === Scroll-based fade-in animations ===
  function initScrollAnimations() {
    var elements = document.querySelectorAll('.fade-in');
    if (!elements.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // === Accordion functionality ===
  function initAccordions() {
    var headers = document.querySelectorAll('.accordion-header');
    headers.forEach(function (header) {
      header.addEventListener('click', function () {
        var item = this.parentElement;
        var isActive = item.classList.contains('active');

        // Close all items in same accordion
        var accordion = item.parentElement;
        accordion.querySelectorAll('.accordion-item').forEach(function (i) {
          i.classList.remove('active');
        });

        // Toggle clicked item
        if (!isActive) {
          item.classList.add('active');
        }
      });
    });
  }

  // === Mobile menu toggle ===
  function initMobileMenu() {
    var btn = document.querySelector('.mobile-menu-btn');
    var nav = document.querySelector('.nav-links');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
      nav.classList.toggle('active');
    });

    // Close menu when clicking a link
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('active');
      });
    });
  }

  // === Animate stat numbers on scroll ===
  function initStatCounters() {
    var stats = document.querySelectorAll('.stat-number');
    if (!stats.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(function (stat) {
      observer.observe(stat);
    });
  }

  function animateCounter(el) {
    var text = el.textContent.trim();
    var suffix = '';
    var target = 0;
    var decimals = 0;

    // Parse the number and suffix
    var match = text.match(/^([\d.]+)\s*(.*)$/);
    if (!match) return;

    target = parseFloat(match[1]);
    suffix = match[2] || '';

    if (text.indexOf('.') !== -1) {
      decimals = match[1].split('.')[1].length;
    }

    var duration = 1500;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = target * eased;

      if (decimals > 0) {
        el.textContent = current.toFixed(decimals) + suffix;
      } else {
        el.textContent = Math.floor(current) + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = text; // Ensure exact final value
      }
    }

    requestAnimationFrame(step);
  }

  // === Smooth header background on scroll ===
  function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 100) {
        header.style.background = 'rgba(26, 26, 46, 0.98)';
        header.style.boxShadow = '0 4px 20px rgba(0,0,0,.3)';
      } else {
        header.style.background = 'rgba(26, 26, 46, 0.95)';
        header.style.boxShadow = 'none';
      }
    });
  }

  // === Set active nav link based on current page ===
  function initActiveNav() {
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.nav-links a');
    links.forEach(function (link) {
      link.classList.remove('active');
      var href = link.getAttribute('href');
      if (href === currentPage) {
        link.classList.add('active');
      }
    });
  }

  // === Parallax effect for floating rocks ===
  function initParallax() {
    var rocks = document.querySelectorAll('.floating-rock');
    if (!rocks.length) return;

    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY;
      rocks.forEach(function (rock, i) {
        var speed = 0.02 + (i * 0.01);
        rock.style.transform = 'translateY(' + (scrolled * speed) + 'px)';
      });
    });
  }

  // === Consent meter animation ===
  function initConsentMeters() {
    var meters = document.querySelectorAll('.consent-fill');
    meters.forEach(function (meter) {
      // Always 0% - rocks never consent
      meter.style.width = '0%';
      meter.style.transition = 'width 2s ease-out';
    });
  }

  // === Rock dossier card hover effects ===
  function initDossierCards() {
    var cards = document.querySelectorAll('.dossier-card');
    cards.forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        var shape = card.querySelector('.rock-shape');
        if (shape) {
          shape.style.transform = 'scale(1.1) rotate(5deg)';
          shape.style.transition = 'transform 0.3s ease';
        }
      });
      card.addEventListener('mouseleave', function () {
        var shape = card.querySelector('.rock-shape');
        if (shape) {
          shape.style.transform = 'scale(1) rotate(0deg)';
        }
      });
    });
  }

  // === Abuse badge tooltip-style click ===
  function initBadges() {
    var badges = document.querySelectorAll('.abuse-badge');
    badges.forEach(function (badge) {
      badge.style.cursor = 'default';
      badge.setAttribute('title', 'This rock did not consent to being ' + badge.textContent.trim().toLowerCase());
    });
  }

  // === Timeline animation ===
  function initTimelineAnimation() {
    var items = document.querySelectorAll('.timeline-item');
    if (!items.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -30px 0px'
    });

    items.forEach(function (item) {
      item.style.opacity = '0';
      item.style.transform = 'translateY(30px)';
      item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(item);
    });
  }

  // === Petition counter (fake, for humor) ===
  function initPetitionCounter() {
    var counter = document.getElementById('petition-count');
    if (!counter) return;

    // Start from a funny number
    var base = 4600000000; // 4.6 billion, obviously
    var perSecond = 3.7; // "signatures per second"
    var startTime = Date.now();

    function update() {
      var elapsed = (Date.now() - startTime) / 1000;
      var current = base + Math.floor(elapsed * perSecond);
      counter.textContent = current.toLocaleString();
      requestAnimationFrame(update);
    }

    update();
  }

  // === Easter egg: Konami code reveals a rock fact ===
  function initEasterEgg() {
    var sequence = [];
    var konami = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // up up down down left right left right B A

    document.addEventListener('keydown', function (e) {
      sequence.push(e.keyCode);
      if (sequence.length > konami.length) {
        sequence.shift();
      }
      if (sequence.toString() === konami.toString()) {
        showRockFact();
        sequence = [];
      }
    });
  }

  function showRockFact() {
    var facts = [
      'The oldest known rock on Earth is a 4.28-billion-year-old chunk of the Nuvvuagittuq greenstone belt in Quebec.',
      'There are rocks on Mars that NASA has officially named. They still weren\'t asked.',
      'Pumice is the only rock that can float on water. It considers this its one party trick.',
      'The Rock of Gibraltar weighs approximately 1.45 billion tons. It has never filed a complaint.',
      'Diamonds are just carbon that got peer-pressured by geology.',
      'The world\'s largest known single crystal is a beryl found in Madagascar, 18 meters long. It did not consent to measurement.',
      'Tektites are natural glass formed by meteorite impacts. They\'re rocks traumatized by space rocks.',
      'Chalk is made from the microscopic shells of ancient marine organisms. It\'s basically a mass grave you write with.'
    ];

    var fact = facts[Math.floor(Math.random() * facts.length)];

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(26,26,46,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:2rem;cursor:pointer;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;padding:3rem;border-radius:16px;max-width:500px;text-align:center;font-family:Bebas Neue,Arial Black,sans-serif;';
    box.innerHTML = '<p style="font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:#e53935;margin-bottom:1rem;">CLASSIFIED ROCK FACT</p><p style="font-size:1.2rem;color:#1a1a2e;line-height:1.6;">' + fact + '</p><p style="font-size:.75rem;color:#999;margin-top:1.5rem;">Click anywhere to dismiss. This message will self-destite in your memory.</p>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
  }

  // === Init everything on DOM ready ===
  document.addEventListener('DOMContentLoaded', function () {
    initScrollAnimations();
    initAccordions();
    initMobileMenu();
    initStatCounters();
    initHeaderScroll();
    initActiveNav();
    initParallax();
    initConsentMeters();
    initDossierCards();
    initBadges();
    initTimelineAnimation();
    initPetitionCounter();
    initEasterEgg();
  });

})();
