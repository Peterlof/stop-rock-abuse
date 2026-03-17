/**
 * entertainment-images.js
 * Injects real images into the entertainment page cards.
 * All images sourced via the Wikipedia REST summary API (thumbnail.source field).
 * API format used: https://en.wikipedia.org/api/rest_v1/page/summary/ARTICLE_TITLE
 */

(function () {
  'use strict';

  // Map card title text → Wikipedia thumbnail URL
  // Titles must match the exact text content of .card-title elements in entertainment.html
  var IMAGES = {
    // MOVIES
    'Armageddon':
      'https://upload.wikimedia.org/wikipedia/en/f/fc/Armageddon-poster06.jpg',
    'Deep Impact':
      'https://upload.wikimedia.org/wikipedia/en/9/93/Deep_Impact_poster.jpg',
    'The Core':
      'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/The_Core_poster.jpg/250px-The_Core_poster.jpg',
    '10,000 BC':
      'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/Ten_thousand_b_c.jpg/250px-Ten_thousand_b_c.jpg',
    'Indiana Jones Franchise':
      'https://upload.wikimedia.org/wikipedia/en/thumb/a/a6/Raiders_of_the_Lost_Ark_Theatrical_Poster.jpg/250px-Raiders_of_the_Lost_Ark_Theatrical_Poster.jpg',
    '127 Hours':
      'https://upload.wikimedia.org/wikipedia/en/b/b3/127_Hours_Poster.jpg',
    'Tremors':
      'https://upload.wikimedia.org/wikipedia/en/f/f1/Tremors_official_theatrical_poster.jpg',
    "Dante's Peak / Volcano":
      'https://upload.wikimedia.org/wikipedia/en/c/ce/Dantes_peak_ver2.jpg',
    'The Lord of the Rings Trilogy':
      'https://upload.wikimedia.org/wikipedia/en/f/fb/Lord_Rings_Fellowship_Ring.jpg',
    'Frozen':
      'https://upload.wikimedia.org/wikipedia/en/0/05/Frozen_%282013_film%29_poster.jpg',

    // GAMES
    'Minecraft':
      'https://upload.wikimedia.org/wikipedia/en/b/b6/Minecraft_2024_cover_art.png',
    'Asteroids':
      'https://upload.wikimedia.org/wikipedia/en/8/81/Asteroids-arcadegame.jpg',
    'Rock Band':
      'https://upload.wikimedia.org/wikipedia/en/e/e0/Rock_band_cover.jpg',
    // Dwarf Fortress – no thumbnail available via Wikipedia API; skipped
    'The Legend of Zelda Series':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Zelda_2017.svg/330px-Zelda_2017.svg.png',
    'Portal 2':
      'https://upload.wikimedia.org/wikipedia/en/f/f9/Portal2cover.jpg',
    'Dark Souls / Elden Ring':
      'https://upload.wikimedia.org/wikipedia/en/8/8d/Dark_Souls_Cover_Art.jpg',
    'Shadow of the Colossus':
      'https://upload.wikimedia.org/wikipedia/en/f/f8/Shadow_of_the_Colossus_%282005%29_cover.jpg',

    // TV
    'Breaking Bad':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Breaking_Bad_logo.svg/330px-Breaking_Bad_logo.svg.png',
    // The Flintstones – no thumbnail available via Wikipedia API; skipped
    'Planet Earth / Blue Planet':
      'https://upload.wikimedia.org/wikipedia/en/thumb/b/ba/Planet_Earth_II.png/330px-Planet_Earth_II.png',
    'Avatar: The Last Airbender':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Avatar_The_Last_Airbender_logo.svg/330px-Avatar_The_Last_Airbender_logo.svg.png',
    'Steven Universe':
      'https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Steven_Universe_-_Title_Card.png/330px-Steven_Universe_-_Title_Card.png',

    // MUSIC
    '"We Will Rock You" \u2014 Queen':
      'https://upload.wikimedia.org/wikipedia/en/1/18/We_Will_Rock_You_by_Queen_%281977_French_single%29.png',
    '"Rock and Roll" as a Genre':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Elvis_Presley_promoting_Jailhouse_Rock.jpg/330px-Elvis_Presley_promoting_Jailhouse_Rock.jpg',
    '"Like a Rolling Stone" \u2014 Bob Dylan':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Like_a_rolling_stone_by_bob_dylan_us_vinyl_side_a.png/330px-Like_a_rolling_stone_by_bob_dylan_us_vinyl_side_a.png',
    'The Rolling Stones':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/The_Rolling_Stones_Summerfest_in_Milwaukee_-_2015.jpg/330px-The_Rolling_Stones_Summerfest_in_Milwaukee_-_2015.jpg',

    // OTHER
    'Pet Rock':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/PetRock_Box.jpg/330px-PetRock_Box.jpg',
    'Rock Paper Scissors':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Rock-paper-scissors.svg/330px-Rock-paper-scissors.svg.png',
    'Rock Balancing / Cairns':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Stacked_stones.jpg/330px-Stacked_stones.jpg',
    "Philosopher's Stone / Rosetta Stone":
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Rosetta_Stone.JPG/330px-Rosetta_Stone.JPG',
    'Dwayne "The Rock" Johnson':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Dwayne_Johnson-1809_%28cropped%29.jpg/330px-Dwayne_Johnson-1809_%28cropped%29.jpg'
  };

  /**
   * Inject an image element into a card's header area,
   * just before .card-badges (or at the top of the card).
   */
  function injectImage(card, imageUrl, altText) {
    // Don't inject twice
    if (card.querySelector('.ent-card-img-wrap')) return;

    var wrap = document.createElement('div');
    wrap.className = 'ent-card-img-wrap';
    wrap.style.cssText = [
      'width:100%',
      'height:160px',
      'overflow:hidden',
      'border-radius:8px',
      'margin-bottom:1rem',
      'background:#111',
      'display:flex',
      'align-items:center',
      'justify-content:center'
    ].join(';');

    var img = document.createElement('img');
    img.src = imageUrl;
    img.alt = altText;
    img.loading = 'lazy';
    img.style.cssText = [
      'width:100%',
      'height:100%',
      'object-fit:contain',
      'object-position:center',
      'transition:opacity 0.3s ease'
    ].join(';');
    img.style.opacity = '0';

    img.addEventListener('load', function () {
      img.style.opacity = '1';
    });

    img.addEventListener('error', function () {
      // Remove wrapper if image fails to load
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    });

    wrap.appendChild(img);

    // Insert before the first child of the card
    card.insertBefore(wrap, card.firstChild);
  }

  function init() {
    var cards = document.querySelectorAll('.ent-card');

    cards.forEach(function (card) {
      var titleEl = card.querySelector('.card-title');
      if (!titleEl) return;

      var titleText = titleEl.textContent.trim();
      var imageUrl = IMAGES[titleText];

      if (imageUrl) {
        injectImage(card, imageUrl, titleText);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
