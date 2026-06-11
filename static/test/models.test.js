import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv, evalJS } from './setup.js';

let window;

beforeEach(() => {
  const env = createTestEnv();
  window = env.window;
  window.renderMathInElement = () => {};
  evalJS(window);
});

describe('classifyModel', () => {
  it('should classify deepseek/r1 models as think', () => {
    assert.equal(window.classifyModel('deepseek-r1:14b'), 'think');
    assert.equal(window.classifyModel('deepseek-r1:latest'), 'think');
    assert.equal(window.classifyModel('r1-distill-llama'), 'think');
    assert.equal(window.classifyModel('reasoning-model'), 'think');
  });

  it('should classify coder/code models as code', () => {
    assert.equal(window.classifyModel('qwen2.5-coder:14b'), 'code');
    assert.equal(window.classifyModel('codegemma'), 'code');
    assert.equal(window.classifyModel('llama-3-instruct'), 'code');
  });

  it('should classify anything else as ask', () => {
    assert.equal(window.classifyModel('gemma:7b'), 'ask');
    assert.equal(window.classifyModel('llama3:8b'), 'ask');
    assert.equal(window.classifyModel('mistral'), 'ask');
    assert.equal(window.classifyModel('qwen3:8b'), 'ask');
  });
});

describe('selectModelForMode', () => {
  it('should pick a think model for think mode', () => {
    const models = [
      { name: 'llama3:8b' },
      { name: 'deepseek-r1:14b' },
      { name: 'qwen2.5-coder:14b' },
    ];
    assert.equal(window.selectModelForMode('think', models), 'deepseek-r1:14b');
  });

  it('should pick a code model for code mode', () => {
    const models = [
      { name: 'llama3:8b' },
      { name: 'deepseek-r1:14b' },
      { name: 'qwen2.5-coder:14b' },
    ];
    assert.equal(window.selectModelForMode('code', models), 'qwen2.5-coder:14b');
  });

  it('should pick first ask model for ask mode', () => {
    const models = [
      { name: 'gemma:7b' },
      { name: 'llama3:8b' },
    ];
    assert.equal(window.selectModelForMode('ask', models), 'gemma:7b');
  });

  it('should fallback to first model if no match', () => {
    const models = [{ name: 'llama3:8b' }];
    assert.equal(window.selectModelForMode('code', models), 'llama3:8b');
  });

  it('should default to ask when mode is null', () => {
    const models = [
      { name: 'deepseek-r1:14b' },
      { name: 'gemma:7b' },
    ];
    assert.equal(window.selectModelForMode(null, models), 'gemma:7b');
  });

  it('should return empty string when no models', () => {
    assert.equal(window.selectModelForMode('ask', []), '');
  });

  it('should pick from models list without hardcoded names', () => {
    const models = [
      { name: 'custom-model:latest' },
      { name: 'another-model:7b' },
    ];
    assert.equal(window.selectModelForMode(null, models), 'custom-model:latest');
  });
});

describe('resolveModel', () => {
  const models = [
    { name: 'deepseek-r1:14b' },
    { name: 'llama3:8b' },
    { name: 'qwen2.5-coder:14b' },
  ];

  it('should prefer preferredModel over preferredMode', () => {
    assert.equal(window.resolveModel(models, 'think', 'qwen2.5-coder:14b'), 'qwen2.5-coder:14b');
  });

  it('should fall back to preferredMode when preferredModel not in list', () => {
    assert.equal(window.resolveModel(models, 'think', 'nonexistent:latest'), 'deepseek-r1:14b');
  });

  it('should fall back to preferredMode when preferredModel is empty', () => {
    assert.equal(window.resolveModel(models, 'think', ''), 'deepseek-r1:14b');
  });

  it('should fall back to preferredMode when preferredModel is null', () => {
    assert.equal(window.resolveModel(models, 'ask', null), 'llama3:8b');
  });

  it('should return empty string when models list is empty', () => {
    assert.equal(window.resolveModel([], 'ask', ''), '');
  });
});

describe('parseModeFromQuery', () => {
  it('should parse :think prefix', () => {
    const result = window.parseModeFromQuery(':think what is life');
    assert.equal(result.mode, 'think');
    assert.equal(result.query, 'what is life');
  });

  it('should parse :ask prefix', () => {
    const result = window.parseModeFromQuery(':ask hello world');
    assert.equal(result.mode, 'ask');
    assert.equal(result.query, 'hello world');
  });

  it('should parse :code prefix', () => {
    const result = window.parseModeFromQuery(':code write js');
    assert.equal(result.mode, 'code');
    assert.equal(result.query, 'write js');
  });

  it('should return null mode when no prefix', () => {
    const result = window.parseModeFromQuery('hello world');
    assert.equal(result.mode, null);
    assert.equal(result.query, 'hello world');
  });

  it('should return null mode for empty string', () => {
    const result = window.parseModeFromQuery('');
    assert.equal(result.mode, null);
    assert.equal(result.query, '');
  });

  it('should not parse prefix without trailing space', () => {
    const result = window.parseModeFromQuery(':code');
    assert.equal(result.mode, null);
    assert.equal(result.query, ':code');
  });

  it('should require whitespace after mode prefix', () => {
    const result = window.parseModeFromQuery(':codez rule');
    assert.equal(result.mode, null);
    assert.equal(result.query, ':codez rule');
  });
});
