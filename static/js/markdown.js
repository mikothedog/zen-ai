function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text) {
  const codeBlocks = [];
  let idx = 0;
  let html = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `\x00CODE${idx}\x00`;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    idx++;
    return placeholder;
  });

  html = escapeHtml(html);

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="external-link">$1</a>');

  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    return codeBlocks[parseInt(i)] || _;
  });

  const lines = html.split('\n\n');
  return lines.map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('<')) return t;
    return `<p>${t}</p>`;
  }).join('\n');
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = 'Copy';
      button.classList.remove('copied');
    }, COPY_FEEDBACK_DURATION);
  } catch {
    button.textContent = 'Failed';
  }
}

function addCodeCopyButtons(el) {
  el.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(pre.textContent, btn);
    });
    wrap.appendChild(btn);
  });
}

function addMessageActions(el) {
  if (el.querySelector('.message-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  const copyBtn = document.createElement('button');
  const content = el.dataset.content || el.textContent;
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => copyToClipboard(content, copyBtn));
  actions.appendChild(copyBtn);
  el.appendChild(actions);
}

function renderMath(el) {
  if (typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      ignoredTags: ['pre', 'code'],
    });
  } catch (_) {}
}
