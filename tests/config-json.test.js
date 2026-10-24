const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { omitEmptyFields } = require('../docs/config-json');

const source = (file) => fs.readFileSync(path.join(__dirname, '../docs', file), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('omits empty fields recursively while preserving zero, false and nonempty content', () => {
  const document = {
    app: { ad: 0, on: false, version: '1.0.0' },
    taku: { appid: '', appkey: ' \t\n', banner: null },
    revenue: {}, paylist: [], switch: [], other: [{ key: '', value: null }],
    custom: { empty: { list: [null, '', {}] }, active: false, count: 0 },
    text: ' keep spacing ', nested: [null, { value: 'hello', tip: '' }, 0, false]
  };
  const before = structuredClone(document);
  assert.deepEqual(omitEmptyFields(document), {
    app: { ad: 0, on: false, version: '1.0.0' },
    custom: { active: false, count: 0 }, text: ' keep spacing ',
    nested: [{ value: 'hello' }, 0, false]
  });
  assert.deepEqual(document, before);
  assert.deepEqual(omitEmptyFields({ taku: { appid: '123', appkey: '' } }), { taku: { appid: '123' } });
  assert.deepEqual(omitEmptyFields({}), {});
});

function mobileHarness() {
  const storage = new Map();
  const files = new Map();
  const writes = [];
  const window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  };
  const context = vm.createContext({
    window, document: { documentElement: { dataset: {} } }, TextEncoder, TextDecoder,
    btoa: (text) => Buffer.from(text, 'binary').toString('base64'),
    atob: (text) => Buffer.from(text, 'base64').toString('binary'),
    fetch: async (url, options) => {
      const file = decodeURIComponent(url.split('/contents/')[1]);
      let payload;
      let status = 200;
      if (options.method === 'GET') {
        payload = files.get(file) ?? { message: 'Not Found' };
        if (!files.has(file)) status = 404;
      } else if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        const document = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
        const sha = `sha-${writes.length}`;
        writes.push({ file, document });
        files.set(file, { content: body.content, sha });
        payload = { content: { path: file, sha } };
      } else throw new Error(`Unexpected method ${options.method}`);
      return { ok: status === 200, status, text: async () => JSON.stringify(payload) };
    }
  });
  vm.runInContext(source('config-json.js'), context);
  vm.runInContext(source('mobile-api.js'), context);
  return { api: window.desktopAPI, writes, storage };
}

test('new apps and saved apps send cleaned JSON to GitHub and keep the cache consistent', async () => {
  const { api, writes, storage } = mobileHarness();
  await api.saveConnection({ id: 'test', repo: 'example/config', token: 'test-token' });
  const created = await api.createApp('test', { name: '测试应用', fileName: 'sample' });
  assert.deepEqual(writes[0].document, {
    app: { ad: 1, on: 1, version: '1.0.0' },
    revenue: { url: 'https://api.rc-backup.com/', offername: 'offer', payname: 'pay' }
  });
  assert.deepEqual(plain(created.document), writes[0].document);
  assert.deepEqual(writes[1].document.apps[0], { name: '测试应用', packageName: '', appStoreUrl: '', fileName: 'sample.json' });
  const document = {
    app: { ad: 0, on: 0, version: '1.0.0' }, taku: { appid: '123', appkey: '' },
    revenue: { url: '', key: null }, switch: [{ key: 'ad1', open: 0, type: 0, tip: '' }],
    paylist: [], other: [], custom: false
  };
  await api.saveApp({ connectionId: 'test', filePath: 'sample.json', sha: created.sha, document });
  const saved = writes.at(-1).document;
  assert.deepEqual(saved, {
    app: { ad: 0, on: 0, version: '1.0.0' }, taku: { appid: '123' },
    switch: [{ key: 'ad1', open: 0, type: 0 }], custom: false
  });
  const cache = JSON.parse(storage.get('config-platform.apps-cache.v1'));
  assert.deepEqual(cache.connections.test.documents['sample.json'].document, saved);
  document.taku.appid = '   ';
  await api.saveApp({ connectionId: 'test', filePath: 'sample.json', document });
  assert.ok(!Object.hasOwn(writes.at(-1).document, 'taku'));
});

test('preview and form saves omit empty fields while the editor remains editable', () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { value: '', dataset: { value: '0' }, querySelectorAll: () => [], setAttribute: () => {} });
    return elements.get(selector);
  };
  const taku = ['appid', 'appkey', 'banner', 'insert', 'open', 'reward'].map((key) => ({ value: '', dataset: { taku: key } }));
  const document = {
    querySelector: element,
    querySelectorAll: (selector) => selector === '[data-taku]' ? taku : []
  };
  const window = { matchMedia: () => ({ matches: false, addEventListener: () => {} }) };
  const context = vm.createContext({ window, document });
  vm.runInContext(source('config-json.js'), context);
  const renderer = source('renderer.js').split("  ui.connectionSelect.addEventListener('change'")[0];
  vm.runInContext(`${renderer}\nwindow.editorTest = { state, normaliseDocument };\n})();`, context);
  const { state, normaliseDocument } = window.editorTest;
  state.current = { app: { version: '1.0.0' }, custom: { enabled: false, empty: '' } };
  element('#appVersion').value = '1.0.0';
  const first = plain(normaliseDocument());
  assert.deepEqual(first, { app: { ad: 0, on: 0, version: '1.0.0' }, custom: { enabled: false } });
  assert.deepEqual(JSON.parse(element('#rawConfig').value), first);
  assert.ok(Array.isArray(state.current.paylist));
  taku[0].value = '123';
  assert.deepEqual(plain(normaliseDocument()).taku, { appid: '123' });
  taku[0].value = '';
  assert.ok(!Object.hasOwn(normaliseDocument(), 'taku'));
});
