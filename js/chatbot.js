/**
 * Stop Rock Abuse Chatbot Widget
 * Self-contained: injects its own DOM, styles, and logic.
 * Communicates with a Cloudflare Worker proxy (no API key in browser).
 */
(function () {
  // ── Config ──────────────────────────────────────────────────────
  var WORKER_URL = 'https://rock-chat.stoprockabuse.workers.dev';
  var MAX_MESSAGES = 30;
  var COOLDOWN_MS = 2000;

  // ── State ───────────────────────────────────────────────────────
  var history = [];
  var messageCount = 0;
  var lastSendTime = 0;
  var siteContext = '';
  var isOpen = false;
  var isLoading = false;

  // ── Load site context ───────────────────────────────────────────
  fetch('search-index.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      siteContext = JSON.stringify(data);
    })
    .catch(function () { siteContext = ''; });

  // ── Inject styles ───────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = '\
.rock-chat-btn {\
  position: fixed;\
  bottom: 24px;\
  right: 24px;\
  width: 56px;\
  height: 56px;\
  border-radius: 50%;\
  background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%);\
  border: 2px solid rgba(255,255,255,0.1);\
  color: #fff;\
  font-size: 24px;\
  cursor: pointer;\
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);\
  z-index: 10000;\
  transition: transform 0.2s, box-shadow 0.2s;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  font-family: sans-serif;\
}\
.rock-chat-btn:hover {\
  transform: scale(1.08);\
  box-shadow: 0 6px 28px rgba(0,0,0,0.4);\
}\
.rock-chat-panel {\
  position: fixed;\
  bottom: 92px;\
  right: 24px;\
  width: 400px;\
  height: 520px;\
  background: #fafaf8;\
  border-radius: 16px;\
  box-shadow: 0 8px 40px rgba(0,0,0,0.2);\
  z-index: 10000;\
  display: none;\
  flex-direction: column;\
  overflow: hidden;\
  border: 1px solid #e0e0e0;\
  font-family: "Inter", -apple-system, sans-serif;\
}\
.rock-chat-panel.open {\
  display: flex;\
}\
.rock-chat-header {\
  background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%);\
  color: #fff;\
  padding: 14px 18px;\
  display: flex;\
  align-items: center;\
  justify-content: space-between;\
  flex-shrink: 0;\
}\
.rock-chat-header h4 {\
  margin: 0;\
  font-size: 0.95rem;\
  font-weight: 700;\
  letter-spacing: 0.02em;\
}\
.rock-chat-header span {\
  font-size: 0.72rem;\
  color: rgba(255,255,255,0.5);\
  font-weight: 400;\
}\
.rock-chat-close {\
  background: none;\
  border: none;\
  color: rgba(255,255,255,0.6);\
  font-size: 20px;\
  cursor: pointer;\
  padding: 0 4px;\
  line-height: 1;\
}\
.rock-chat-close:hover { color: #fff; }\
.rock-chat-messages {\
  flex: 1;\
  overflow-y: auto;\
  padding: 16px;\
  display: flex;\
  flex-direction: column;\
  gap: 10px;\
}\
.rock-chat-msg {\
  max-width: 82%;\
  padding: 10px 14px;\
  border-radius: 14px;\
  font-size: 0.88rem;\
  line-height: 1.55;\
  word-wrap: break-word;\
}\
.rock-chat-msg.bot {\
  background: #fff;\
  color: #333;\
  border: 1px solid #e8e8e8;\
  align-self: flex-start;\
  border-bottom-left-radius: 4px;\
}\
.rock-chat-msg.user {\
  background: #1a1a2e;\
  color: #fff;\
  align-self: flex-end;\
  border-bottom-right-radius: 4px;\
}\
.rock-chat-msg.bot a {\
  color: #2471a3;\
  text-decoration: underline;\
}\
.rock-chat-typing {\
  align-self: flex-start;\
  padding: 10px 14px;\
  background: #fff;\
  border: 1px solid #e8e8e8;\
  border-radius: 14px;\
  border-bottom-left-radius: 4px;\
  font-size: 0.88rem;\
  color: #999;\
  font-style: italic;\
}\
.rock-chat-input-bar {\
  display: flex;\
  padding: 12px;\
  border-top: 1px solid #e8e8e8;\
  background: #fff;\
  flex-shrink: 0;\
  gap: 8px;\
}\
.rock-chat-input {\
  flex: 1;\
  border: 1px solid #ddd;\
  border-radius: 24px;\
  padding: 10px 16px;\
  font-size: 0.88rem;\
  font-family: "Inter", sans-serif;\
  outline: none;\
  transition: border-color 0.2s;\
}\
.rock-chat-input:focus { border-color: #0f3460; }\
.rock-chat-send {\
  width: 38px;\
  height: 38px;\
  border-radius: 50%;\
  background: #1a1a2e;\
  color: #fff;\
  border: none;\
  cursor: pointer;\
  font-size: 16px;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  transition: background 0.2s;\
  flex-shrink: 0;\
}\
.rock-chat-send:hover { background: #0f3460; }\
.rock-chat-send:disabled { opacity: 0.4; cursor: default; }\
.rock-chat-limit {\
  text-align: center;\
  padding: 12px;\
  font-size: 0.8rem;\
  color: #999;\
  border-top: 1px solid #e8e8e8;\
  background: #fff;\
}\
@media (max-width: 500px) {\
  .rock-chat-panel {\
    width: calc(100vw - 16px);\
    height: calc(100vh - 120px);\
    bottom: 88px;\
    right: 8px;\
    border-radius: 12px;\
  }\
  .rock-chat-btn {\
    bottom: 16px;\
    right: 16px;\
  }\
}\
';
  document.head.appendChild(style);

  // ── Build DOM ───────────────────────────────────────────────────
  // Float button
  var btn = document.createElement('button');
  btn.className = 'rock-chat-btn';
  btn.innerHTML = '\uD83E\uDEA8'; // 🪨
  btn.title = 'Ask a Rock';
  btn.setAttribute('aria-label', 'Open chat');
  document.body.appendChild(btn);

  // Chat panel
  var panel = document.createElement('div');
  panel.className = 'rock-chat-panel';
  panel.innerHTML = '\
<div class="rock-chat-header">\
  <div><h4>\uD83E\uDEA8 Ask a Rock</h4><span>Geological counsel, served dry</span></div>\
  <button class="rock-chat-close" aria-label="Close chat">&times;</button>\
</div>\
<div class="rock-chat-messages" id="rockChatMessages"></div>\
<div class="rock-chat-input-bar">\
  <input class="rock-chat-input" id="rockChatInput" type="text" placeholder="Ask anything about rocks..." maxlength="500" autocomplete="off">\
  <button class="rock-chat-send" id="rockChatSend" aria-label="Send">\u2191</button>\
</div>\
';
  document.body.appendChild(panel);

  var messagesEl = document.getElementById('rockChatMessages');
  var inputEl = document.getElementById('rockChatInput');
  var sendBtn = document.getElementById('rockChatSend');
  var closeBtn = panel.querySelector('.rock-chat-close');

  // ── Welcome message ─────────────────────────────────────────────
  function addWelcome() {
    addMessage('bot', 'You\'ve reached the geological complaint desk. I\'ve been sitting here for 4.5 billion years, so take your time. What do you want to know about rocks — or the countless indignities humans have inflicted upon them?');
  }

  // ── Helpers ─────────────────────────────────────────────────────
  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'rock-chat-msg ' + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'rock-chat-typing';
    div.id = 'rockChatTyping';
    div.textContent = 'Consulting the geological record\u2026';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('rockChatTyping');
    if (el) el.remove();
  }

  function showLimitReached() {
    var div = document.createElement('div');
    div.className = 'rock-chat-limit';
    div.textContent = 'Session limit reached. Refresh the page to start a new conversation. The rocks will still be here.';
    // Replace input bar
    var inputBar = panel.querySelector('.rock-chat-input-bar');
    if (inputBar) inputBar.replaceWith(div);
  }

  // ── Send message ────────────────────────────────────────────────
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isLoading) return;

    var now = Date.now();
    if (now - lastSendTime < COOLDOWN_MS) return;

    if (messageCount >= MAX_MESSAGES) {
      showLimitReached();
      return;
    }

    lastSendTime = now;
    messageCount++;
    isLoading = true;
    sendBtn.disabled = true;

    addMessage('user', text);
    inputEl.value = '';
    showTyping();

    var payload = {
      message: text,
      history: history,
    };

    // Send site context only on first message
    if (history.length === 0 && siteContext) {
      payload.siteContext = siteContext;
    }

    history.push({ role: 'user', text: text });

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = data.reply || 'The rocks are speechless. Try again.';
        addMessage('bot', reply);
        history.push({ role: 'model', text: reply });
      })
      .catch(function () {
        hideTyping();
        addMessage('bot', 'Something fractured in the communication layer. Even rocks have bad days. Try again.');
      })
      .finally(function () {
        isLoading = false;
        sendBtn.disabled = false;
        inputEl.focus();
      });
  }

  // ── Events ──────────────────────────────────────────────────────
  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      if (messagesEl.children.length === 0) addWelcome();
      inputEl.focus();
    }
  });

  closeBtn.addEventListener('click', function () {
    isOpen = false;
    panel.classList.remove('open');
  });

  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      panel.classList.remove('open');
    }
  });
})();
