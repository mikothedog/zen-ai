let currentModel = '';

function classifyModel(name) {
  const n = name.toLowerCase();
  if (n.includes('deepseek') || n.includes('r1') || n.includes('reason')) return 'think';
  if (n.includes('coder') || n.includes('code') || n.includes('instruct')) return 'code';
  return 'ask';
}

function selectModelForMode(mode, models) {
  if (models.length === 0) return '';
  const targetMode = mode || 'ask';
  for (const m of models) {
    if (classifyModel(m.name) === targetMode) return m.name;
  }
  return models[0].name;
}

function parseModeFromQuery(query) {
  const match = query.match(/^:(think|ask|code)\s+/);
  if (!match) return { query, mode: null };
  return { query: query.slice(match[0].length), mode: match[1] };
}

function setModel(name) {
  currentModel = name;
  dropdownToggle.textContent = name || 'Select model...';
  dropdownMenu.querySelectorAll('li').forEach(li => {
    li.classList.toggle('active', li.dataset.model === name);
  });
  dropdownMenu.classList.remove('open');
  sendBtn.disabled = !name;
}

function resolveModel(models, preferredMode, preferredModel) {
  if (preferredModel && models.some(m => m.name === preferredModel)) {
    return preferredModel;
  }
  return selectModelForMode(preferredMode, models);
}

async function loadModels(preferredMode, preferredModel) {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    const models = await res.json();
    dropdownMenu.innerHTML = '';
    if (models.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No models installed (run ollama pull ...)';
      li.dataset.model = '';
      dropdownMenu.appendChild(li);
      setModel('');
      return;
    }
    models.forEach(m => {
      const li = document.createElement('li');
      li.textContent = m.name;
      li.dataset.model = m.name;
      li.addEventListener('click', () => setModel(m.name));
      dropdownMenu.appendChild(li);
    });
    setModel(resolveModel(models, preferredMode, preferredModel));
  } catch (e) {
    console.error('Failed to load models:', e);
    const li = document.createElement('li');
    li.textContent = 'Error loading models';
    li.dataset.model = '';
    dropdownMenu.appendChild(li);
    setModel('');
  }
}

dropdownToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('open');
});

document.addEventListener('click', () => {
  dropdownMenu.classList.remove('open');
});
