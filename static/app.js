const DEFAULT_MODEL = 'deepseek-r1:14b';

let currentModel = DEFAULT_MODEL;
let abortController = null;
let nearBottom = true;

const chatEl = document.getElementById('messages');
const chatContainer = document.getElementById('chat');
const loadingEl = document.getElementById('loading');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const modelSelect = document.getElementById('model-select');

const SCROLL_THRESHOLD = 80;

function isNearBottom() {
  return chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - SCROLL_THRESHOLD;
}

function scrollToBottom() {
  if (!isNearBottom()) return;
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function scrollToBottomForce() {
  nearBottom = true;
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatContainer.addEventListener('scroll', () => {
  nearBottom = isNearBottom();
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');

  const lines = html.split('\n\n');
  return lines.map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('<')) return t;
    return `<p>${t}</p>`;
  }).join('\n');
}

function addMessage(role, content) {
  const el = document.createElement('div');
  el.className = 'message ' + role;
  if (role === 'assistant') {
    el.innerHTML = renderMarkdown(content) || '\u200B';
  } else {
    el.textContent = content;
  }
  chatEl.appendChild(el);
  if (role === 'user') scrollToBottomForce();
  return el;
}

function updateLastMessage(content) {
  let last = chatEl.lastElementChild;
  if (!last || !last.classList.contains('assistant')) {
    last = addMessage('assistant', '');
  }
  last.innerHTML = renderMarkdown(content) || '\u200B';
  if (nearBottom) scrollToBottomForce();
}

function setLoading(v) {
  loadingEl.classList.toggle('hidden', !v);
}

function toggleInput(disabled) {
  inputEl.disabled = disabled;
  sendBtn.disabled = disabled;
}

async function sendMessage(content) {
  if (!content.trim()) return;

  if (abortController) abortController.abort();
  abortController = new AbortController();

  addMessage('user', content);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  setLoading(true);
  toggleInput(true);

  const msgs = [];
  document.querySelectorAll('.message').forEach(el => {
    const role = el.classList.contains('user') ? 'user' : 'assistant';
    msgs.push({ role, content: el.textContent });
  });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: currentModel, messages: msgs }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          full += chunk.content;
          updateLastMessage(full);
          if (chunk.done) break;
        } catch (_) {}
      }
    }

    if (buf.trim()) {
      try {
        const chunk = JSON.parse(buf);
        full += chunk.content;
        updateLastMessage(full);
      } catch (_) {}
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      updateLastMessage('Error: ' + err.message);
    }
  }

  setLoading(false);
  toggleInput(false);
  inputEl.focus();
  abortController = null;
}

async function loadModels() {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    const models = await res.json();
    modelSelect.innerHTML = '';
    if (models.length === 0) {
      const opt = document.createElement('option');
      opt.value = DEFAULT_MODEL;
      opt.textContent = DEFAULT_MODEL + ' (not found)';
      modelSelect.appendChild(opt);
      return;
    }
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      if (m.name === DEFAULT_MODEL) opt.selected = true;
      modelSelect.appendChild(opt);
    });
    currentModel = modelSelect.value;
  } catch (e) {
    console.error('Failed to load models:', e);
    const opt = document.createElement('option');
    opt.value = DEFAULT_MODEL;
    opt.textContent = DEFAULT_MODEL;
    opt.selected = true;
    modelSelect.appendChild(opt);
  }
}

modelSelect.addEventListener('change', () => {
  currentModel = modelSelect.value;
});

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});

sendBtn.addEventListener('click', () => {
  sendMessage(inputEl.value);
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    switch (e.key) {
      case 'l':
        e.preventDefault();
        inputEl.focus();
        break;
      case 'j':
        e.preventDefault();
        chatContainer.scrollBy({ top: 200, behavior: 'smooth' });
        nearBottom = isNearBottom();
        break;
      case 'k':
        e.preventDefault();
        chatContainer.scrollBy({ top: -200, behavior: 'smooth' });
        nearBottom = false;
        break;
    }
  }
});

const initialQuery = (new URLSearchParams(window.location.search)).get('q') || '';
loadModels();

window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/shutdown');
});

if (initialQuery) {
  setTimeout(() => sendMessage(initialQuery), 400);
  history.replaceState(null, '', '/');
}
