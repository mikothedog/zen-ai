let nearBottom = true;
window.nearBottom = nearBottom;

function isNearBottom() {
  return chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - SCROLL_THRESHOLD;
}

function scrollToBottomForce() {
  nearBottom = true;
  window.nearBottom = nearBottom;
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatContainer.addEventListener('wheel', () => {
  nearBottom = false;
  window.nearBottom = nearBottom;
});

chatContainer.addEventListener('scroll', () => {
  nearBottom = isNearBottom();
  window.nearBottom = nearBottom;
});

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

function setupDropdown() {
  dropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('open');
  });
}

function setLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

function toggleInput(disabled) {
  inputEl.disabled = disabled;
  sendBtn.disabled = disabled;
}
