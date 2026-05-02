/**
 * =============================================================
 * CIVIC CONNECT MODULE — civic-connect.js
 * Safe Voter Interaction System (Add-On Module)
 *
 * IMPORTANT:
 *  - This module is fully isolated from the main voting pipeline.
 *  - It reads AppState.identityResult to gate access.
 *  - It never writes to AppState or interferes with agent logic.
 *  - No free text input from users. All messages are pre-selected.
 * =============================================================
 */

'use strict';

/* ─── CIVIC CONNECT DATA ─────────────────────────────────────── */

const CivicConnect = {

  /* Gate: is the user identity-verified? */
  isUnlocked() {
    return typeof AppState !== 'undefined'
      && AppState.identityResult !== null
      && AppState.identityResult.verified === true;
  },

  /* ── Topic interest tracker (mock counters) ── */
  topicCounts: { Jobs: 42, Education: 31, Infrastructure: 58, Safety: 27 },
  selectedTopic: null,
  conversationLog: [],   // { sender: 'user'|'voter', text, type }

  /* ── Message bank ── */
  messages: [
    {
      id: 'ask-1',
      type: 'Ask Question',
      icon: '❓',
      text: 'What issues are most important in your area?'
    },
    {
      id: 'concern-1',
      type: 'Share Concern',
      icon: '⚠️',
      text: 'In my area, employment is a major concern.'
    },
    {
      id: 'opinion-1',
      type: 'General Opinion',
      icon: '💬',
      text: 'Public infrastructure needs improvement.'
    }
  ],

  /* ── Simulated responses per message ── */
  responses: {
    'ask-1': [
      'Many people here are concerned about job opportunities.',
      'Education and healthcare are the top priorities in our locality.',
      'Infrastructure gaps — roads and power supply — are the biggest issues.'
    ],
    'concern-1': [
      'Yes, unemployment has been rising steadily over the past few years.',
      'Job creation in rural areas is critically underfunded.',
      'We need better vocational training programs for the youth.'
    ],
    'opinion-1': [
      'Absolutely — local roads and water supply need urgent attention.',
      'Public infrastructure investment directly impacts quality of life.',
      'Smart city initiatives are a step in the right direction.'
    ]
  },

  /* ── Rule engine: blocked phrases ── */
  blockedPatterns: [
    /\bvote\s+for\b/i,
    /\bdon['']?t\s+vote\b/i,
    /\bvoting\s+for\b/i,
    /\belect\b/i,
    /\bcampaign\b/i,
    /\bparty\s+name\b/i,
    /\brajesh\s+kumar\b/i,
    /\bpriya\s+sharma\b/i,
    /\barun\s+patel\b/i,
    /\bprogressive\s+democratic\b/i,
    /\bnational\s+unity\b/i,
    /\bcitizens\s+alliance\b/i
  ],

  validateMessage(messageText) {
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(messageText)) {
        return { allowed: false, reason: 'Message blocked: violates civic communication guidelines.' };
      }
    }
    return { allowed: true };
  },

  getRandomResponse(messageId) {
    const pool = this.responses[messageId] || ['Thank you for sharing your perspective.'];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /* Pick the top topic based on counters + selected topic weight */
  getTopTopic() {
    if (this.selectedTopic) {
      const boosted = { ...this.topicCounts };
      boosted[this.selectedTopic] = (boosted[this.selectedTopic] || 0) + 10;
      return Object.entries(boosted).sort((a, b) => b[1] - a[1])[0][0];
    }
    return Object.entries(this.topicCounts).sort((a, b) => b[1] - a[1])[0][0];
  },

  getCommonConcerns() {
    const sorted = Object.entries(this.topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    return sorted.join(', ');
  }
};

/* ─── DOM HELPERS ────────────────────────────────────────────── */

function ccEl(id) { return document.getElementById(id); }

function ccShowSection(id) {
  ['cc-locked', 'cc-topic-select', 'cc-chat', 'cc-insights'].forEach(s => {
    const el = ccEl(s);
    if (el) el.classList.add('cc-hidden');
  });
  const target = ccEl(id);
  if (target) target.classList.remove('cc-hidden');
}

/* ─── NAV TOGGLE ─────────────────────────────────────────────── */

function openCivicConnect() {
  const section = ccEl('civic-connect-section');
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Re-evaluate gate every time the panel is opened
  if (!CivicConnect.isUnlocked()) {
    ccShowSection('cc-locked');
    return;
  }

  // Reset state each visit so it's fresh
  CivicConnect.selectedTopic = null;
  CivicConnect.conversationLog = [];
  ccShowSection('cc-topic-select');
  renderChat(); // clear chat on next open
}

/* ─── TOPIC SELECTION ────────────────────────────────────────── */

function selectTopic(topic) {
  CivicConnect.selectedTopic = topic;
  // Increment mock counter
  CivicConnect.topicCounts[topic] = (CivicConnect.topicCounts[topic] || 0) + 1;

  // Update UI: highlight selected card
  document.querySelectorAll('.cc-topic-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.topic === topic);
  });

  // Show matched voter notice
  const notice = ccEl('cc-match-notice');
  if (notice) {
    notice.innerHTML = `
      <span class="cc-match-icon">🤝</span>
      <span>Matched with another voter interested in <strong style="color:var(--gold)">${topic}</strong></span>
    `;
    notice.classList.remove('cc-hidden');
  }

  // Transition to chat after short delay
  setTimeout(() => {
    ccShowSection('cc-chat');
    renderChat();
  }, 900);
}

/* ─── CHAT / MESSAGING ───────────────────────────────────────── */

function sendMessage(messageId) {
  const msgObj = CivicConnect.messages.find(m => m.id === messageId);
  if (!msgObj) return;

  const validation = CivicConnect.validateMessage(msgObj.text);

  if (!validation.allowed) {
    appendSystemNotice(validation.reason, 'blocked');
    return;
  }

  // Append user message
  CivicConnect.conversationLog.push({ sender: 'user', text: msgObj.text, type: msgObj.type });
  renderChat();

  // Simulate voter response with delay
  const responseText = CivicConnect.getRandomResponse(messageId);
  setTimeout(() => {
    CivicConnect.conversationLog.push({ sender: 'voter', text: responseText, type: 'Response' });
    renderChat();

    // After 3 exchanges, offer insights
    if (CivicConnect.conversationLog.length >= 4) {
      const insightBtn = ccEl('cc-insights-trigger');
      if (insightBtn) insightBtn.classList.remove('cc-hidden');
    }
  }, 1000 + Math.random() * 600);
}

function renderChat() {
  const log = ccEl('cc-chat-log');
  if (!log) return;

  if (CivicConnect.conversationLog.length === 0) {
    log.innerHTML = `
      <div class="cc-chat-empty">
        <span>💬</span>
        <p>Select a message below to start the civic conversation.</p>
      </div>
    `;
    return;
  }

  log.innerHTML = CivicConnect.conversationLog.map(entry => {
    if (entry.sender === 'user') {
      return `
        <div class="cc-msg cc-msg-user">
          <div class="cc-msg-label">You · <em>${entry.type}</em></div>
          <div class="cc-msg-bubble cc-bubble-user">${entry.text}</div>
        </div>
      `;
    } else {
      return `
        <div class="cc-msg cc-msg-voter">
          <div class="cc-msg-label">🧑 Matched Voter</div>
          <div class="cc-msg-bubble cc-bubble-voter">${entry.text}</div>
        </div>
      `;
    }
  }).join('');

  // Auto-scroll log
  log.scrollTop = log.scrollHeight;
}

function appendSystemNotice(text, kind) {
  const log = ccEl('cc-chat-log');
  if (!log) return;
  const div = document.createElement('div');
  div.className = `cc-system-notice cc-notice-${kind}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

/* ─── INSIGHTS PANEL ─────────────────────────────────────────── */

function showInsights() {
  ccShowSection('cc-insights');

  const topTopic = CivicConnect.getTopTopic();
  const concerns = CivicConnect.getCommonConcerns();

  // Top topic
  const topEl = ccEl('cc-insight-top');
  if (topEl) topEl.textContent = topTopic;

  // Common concerns
  const commonEl = ccEl('cc-insight-concerns');
  if (commonEl) commonEl.textContent = concerns;

  // Bar chart
  renderInsightBars();
}

function renderInsightBars() {
  const container = ccEl('cc-insight-bars');
  if (!container) return;
  const counts = CivicConnect.topicCounts;
  const maxVal = Math.max(...Object.values(counts));

  container.innerHTML = Object.entries(counts).map(([topic, count]) => {
    const pct = Math.round((count / maxVal) * 100);
    return `
      <div class="cc-bar-row">
        <span class="cc-bar-label">${topic}</span>
        <div class="cc-bar-track">
          <div class="cc-bar-fill" style="width:${pct}%" data-pct="${pct}"></div>
        </div>
        <span class="cc-bar-count">${count}</span>
      </div>
    `;
  }).join('');

  // Animate bars after a tick
  requestAnimationFrame(() => {
    document.querySelectorAll('.cc-bar-fill').forEach(bar => {
      bar.style.transition = 'width 0.7s cubic-bezier(.4,0,.2,1)';
    });
  });
}

function resetCivicConnect() {
  CivicConnect.selectedTopic = null;
  CivicConnect.conversationLog = [];
  const notice = ccEl('cc-match-notice');
  if (notice) notice.classList.add('cc-hidden');
  const insightBtn = ccEl('cc-insights-trigger');
  if (insightBtn) insightBtn.classList.add('cc-hidden');
  document.querySelectorAll('.cc-topic-card').forEach(c => c.classList.remove('selected'));
  if (CivicConnect.isUnlocked()) {
    ccShowSection('cc-topic-select');
  } else {
    ccShowSection('cc-locked');
  }
}
