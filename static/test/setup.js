import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsDir = path.join(__dirname, '..', 'js');

export function createTestEnv() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <div id="messages"></div>
    <div id="chat" style="height: 500px; overflow-y: auto;"><div id="messages"></div></div>
    <div id="loading" class="hidden"></div>
    <textarea id="input"></textarea>
    <button id="send"></button>
    <div class="dropdown-toggle">deepseek-r1:14b</div>
    <ul class="dropdown-menu"></ul>
  `, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  const window = dom.window;
  const document = window.document;

  const { navigator } = window;
  navigator.clipboard = { writeText: async () => {} };

  return { dom, window, document };
}

export function evalJS(window) {
  const jsFiles = ['constants.js', 'dom.js', 'clipboard.js', 'markdown.js', 'ui.js', 'models.js', 'app.js'];
  let allCode = '';
  for (const file of jsFiles) {
    allCode += fs.readFileSync(path.join(jsDir, file), 'utf-8') + '\n';
  }
  window.eval(allCode);
}

export function setChatScroll(window, scrollTop, scrollHeight, clientHeight) {
  window.chatContainer.scrollTop = scrollTop;
  Object.defineProperty(window.chatContainer, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(window.chatContainer, 'clientHeight', { value: clientHeight, configurable: true });
}
