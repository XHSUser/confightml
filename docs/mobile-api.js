(() => {
  'use strict';

  // Electron 注入了 desktopAPI；Capacitor/WKWebView 使用下面这份浏览器适配层。
  if (window.desktopAPI) return;
  document.documentElement.dataset.platform = 'ios';

  const DIRECTORY_FILE = 'peizhi.json';
  const STATE_KEY = 'config-platform.connections.v1';
  const CACHE_KEY = 'config-platform.apps-cache.v1';
  const DEFAULT_DOCUMENT = {
    app: { ad: 1, on: 1, version: '1.0.0' },
    switch: [],
    other: [],
    taku: { appid: '', appkey: '', banner: '', insert: '', open: '', reward: '' },
    paylist: [],
    revenue: { url: 'https://api.rc-backup.com/', key: '', offername: 'offer', payname: 'pay' }
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const randomId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `connection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  function readStorage(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn('读取本地移动端数据失败:', error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error(`保存本地数据失败：${error.message}`);
    }
  }

  function blankState() {
    return { connections: [], activeConnectionId: null };
  }

  function readState() {
    const saved = readStorage(STATE_KEY, blankState());
    if (!saved || !Array.isArray(saved.connections)) return blankState();
    const connections = saved.connections.map((connection) => ({ ...connection, branch: '' }));
    const activeConnectionId = connections.some((item) => item.id === saved.activeConnectionId)
      ? saved.activeConnectionId
      : connections[0]?.id || null;
    return { connections, activeConnectionId };
  }

  function writeState(state) {
    writeStorage(STATE_KEY, state);
  }

  function readCache() {
    const cache = readStorage(CACHE_KEY, { connections: {} });
    if (!cache || typeof cache !== 'object') return { connections: {} };
    cache.connections ||= {};
    return cache;
  }

  function writeCache(cache) {
    writeStorage(CACHE_KEY, cache);
  }

  function normalizeRepo(input) {
    let value = String(input || '').trim();
    value = value.replace(/^git@github\.com:/i, '').replace(/^https?:\/\/(?:www\.)?github\.com\//i, '');
    value = value.replace(/^github\.com\//i, '').replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
    const parts = value.split('/').filter(Boolean);
    if (parts.length !== 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) {
      throw new Error('远程地址格式不正确，请填写 owner/repo 或完整地址');
    }
    return `${parts[0]}/${parts[1]}`;
  }

  function validateConnection(input) {
    const repo = normalizeRepo(input.repo);
    const token = String(input.token || '').trim();
    if (!token) throw new Error('请输入访问令牌');
    return {
      id: input.id || randomId(),
      name: String(input.name || repo).trim() || repo,
      token,
      repo,
      branch: ''
    };
  }

  function getConnection(state, connectionId) {
    const connection = state.connections.find((item) => item.id === connectionId);
    if (!connection) throw new Error('没有找到对应的连接配置');
    return connection;
  }

  async function githubRequest(connection, method, apiPath, body) {
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${connection.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'config-platform-ios'
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`https://api.github.com${apiPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
    if (!response.ok) throw new Error(payload.message || `远程请求失败 (${response.status})`);
    return payload;
  }

  function encodePath(filePath) {
    return String(filePath).split('/').map((part) => encodeURIComponent(part)).join('/');
  }

  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(String(value).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function decodeContent(payload, label) {
    if (!payload || Array.isArray(payload) || !payload.content) throw new Error(`${label}无法读取`);
    try { return JSON.parse(fromBase64(payload.content)); } catch { throw new Error(`${label}内容格式有误`); }
  }

  async function readRemoteFile(connection, filePath) {
    const repo = normalizeRepo(connection.repo);
    try {
      return await githubRequest(connection, 'GET', `/repos/${repo}/contents/${encodePath(filePath)}`);
    } catch (error) {
      if (error.message.includes('Not Found')) return null;
      throw error;
    }
  }

  async function readDirectory(connection) {
    const payload = await readRemoteFile(connection, DIRECTORY_FILE);
    if (!payload) return { document: { apps: [] }, sha: null };
    let document = decodeContent(payload, '应用目录');
    if (Array.isArray(document)) document = { apps: document };
    if (!document || typeof document !== 'object') throw new Error('应用目录内容格式有误');
    if (!Array.isArray(document.apps) && Array.isArray(document.applications)) document.apps = document.applications;
    if (!Array.isArray(document.apps)) document.apps = [];
    return { document, sha: payload.sha };
  }

  async function listApps(connection) {
    const { document } = await readDirectory(connection);
    return document.apps.map((item) => {
      if (!item || typeof item !== 'object') return null;
      const fileName = String(item.fileName || item.file || '').trim();
      if (!fileName) return null;
      return {
        ...item,
        name: String(item.name || item.displayName || fileName.replace(/\.json$/i, '')),
        fileName,
        path: fileName
      };
    }).filter(Boolean);
  }

  async function writeRemoteJson(connection, filePath, document, sha, message) {
    const repo = normalizeRepo(connection.repo);
    const body = {
      message: message || `更新配置 ${filePath}`,
      content: toBase64(`${JSON.stringify(document, null, 4)}\n`)
    };
    if (sha) body.sha = sha;
    const payload = await githubRequest(connection, 'PUT', `/repos/${repo}/contents/${encodePath(filePath)}`, body);
    return { path: payload.content?.path || filePath, sha: payload.content?.sha || null, commit: payload.commit?.html_url || null };
  }

  async function deleteRemoteFile(connection, filePath, sha, message = `删除应用配置 ${filePath}`) {
    const repo = normalizeRepo(connection.repo);
    await githubRequest(connection, 'DELETE', `/repos/${repo}/contents/${encodePath(filePath)}`, { message, sha });
  }

  async function writeDirectory(connection, document, sha, message = '更新应用目录') {
    return writeRemoteJson(connection, DIRECTORY_FILE, document, sha, message);
  }

  async function readApp(connection, filePath) {
    const payload = await readRemoteFile(connection, filePath);
    if (!payload) throw new Error('没有找到这个应用的配置');
    const document = decodeContent(payload, '应用配置');
    const { document: directory } = await readDirectory(connection);
    const item = directory.apps.find((entry) => (entry.fileName || entry.file) === filePath);
    const metadata = item ? {
      ...item,
      name: String(item.name || item.displayName || filePath.replace(/\.json$/i, '')),
      fileName: filePath
    } : { name: filePath.replace(/\.json$/i, ''), fileName: filePath };
    return { path: payload.path, sha: payload.sha, document, metadata };
  }

  function cacheApps(connectionId, apps) {
    const cache = readCache();
    const entry = cache.connections[connectionId] || { apps: [], documents: {} };
    entry.apps = apps;
    entry.updatedAt = new Date().toISOString();
    cache.connections[connectionId] = entry;
    writeCache(cache);
  }

  function cacheApp(connectionId, result) {
    const cache = readCache();
    const entry = cache.connections[connectionId] || { apps: [], documents: {} };
    entry.documents ||= {};
    entry.documents[result.path] = result;
    entry.updatedAt = new Date().toISOString();
    cache.connections[connectionId] = entry;
    writeCache(cache);
  }

  function cachedApps(connectionId) {
    const apps = readCache().connections[connectionId]?.apps;
    return Array.isArray(apps) ? apps : null;
  }

  function cachedApp(connectionId, filePath) {
    return readCache().connections[connectionId]?.documents?.[filePath] || null;
  }

  function cleanFileStem(input) {
    const value = String(input || '').trim().replace(/\.json$/i, '');
    if (!value) return '';
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) throw new Error('英文文件名需以字母开头，只能使用字母、数字、下划线或短横线');
    return value;
  }

  function randomLetters(length = 8) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const bytes = new Uint8Array(length);
    window.crypto?.getRandomValues(bytes);
    return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  }

  function uniqueFileName(directory, requestedName) {
    const used = new Set(directory.apps.map((item) => String(item.fileName || item.file || '').toLowerCase()));
    const stem = cleanFileStem(requestedName);
    if (stem) {
      const candidate = `${stem}.json`;
      if (used.has(candidate.toLowerCase())) throw new Error('这个英文文件名已被使用，请换一个名称');
      return candidate;
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `app-${randomLetters()}.json`;
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
    throw new Error('暂时无法生成唯一名称，请手动填写英文文件名');
  }

  function validateAppInfo(input) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('请输入应用中文名称');
    const packageName = String(input.packageName || '').trim();
    const appStoreUrl = String(input.appStoreUrl || '').trim();
    if (appStoreUrl && !/^https?:\/\//i.test(appStoreUrl)) throw new Error('商城链接需以 http:// 或 https:// 开头');
    return { name, packageName, appStoreUrl };
  }

  async function writeApp(connection, filePath, document, sha, message, metadata, connectionId) {
    document = window.configJSON.omitEmptyFields(document);
    const result = await writeRemoteJson(connection, filePath, document, sha, message || `更新应用配置 ${filePath}`);
    if (metadata) {
      const { document: directory, sha: directorySha } = await readDirectory(connection);
      const index = directory.apps.findIndex((item) => (item.fileName || item.file) === filePath);
      if (index < 0) throw new Error('应用目录中已找不到此应用，配置内容已保存，请刷新后重试');
      const info = validateAppInfo(metadata);
      const currentInfo = directory.apps[index];
      if (currentInfo.name !== info.name || (currentInfo.packageName || '') !== info.packageName || (currentInfo.appStoreUrl || '') !== info.appStoreUrl) {
        directory.apps[index] = { ...currentInfo, ...info, fileName: filePath };
        await writeDirectory(connection, directory, directorySha, '更新应用信息');
      }
    }
    if (connectionId) cacheApp(connectionId, { path: result.path || filePath, sha: result.sha, document, metadata });
    return result;
  }

  async function lookupAppStoreVersion(input) {
    const storeUrl = String(input || '').trim();
    if (!storeUrl) throw new Error('请输入商城链接');
    const appId = storeUrl.match(/\/id(\d+)(?:[/?#]|$)/i)?.[1] || storeUrl.match(/^\d+$/)?.[0];
    if (!appId) throw new Error('商城链接中没有找到应用编号');
    const country = storeUrl.match(/apps\.apple\.com\/([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase();
    const query = new URLSearchParams({ id: appId });
    if (country) query.set('country', country);
    const response = await fetch(`https://itunes.apple.com/lookup?${query.toString()}`, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`获取商城版本失败 (${response.status})`);
    const version = payload.results?.[0]?.version;
    if (!version || !/^\d+\.\d+(?:\.\d+)?$/.test(String(version))) throw new Error('没有获取到有效的商城版本');
    return { version: String(version), appId };
  }

  async function exportConnections() {
    const state = readState();
    const content = JSON.stringify(state, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const file = typeof File === 'function' ? new File([blob], '连接配置.cfg', { type: 'application/json' }) : null;
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: '连接配置', files: [file] });
        return { canceled: false };
      } catch (error) {
        if (error.name === 'AbortError') return { canceled: true };
      }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '连接配置.cfg';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { canceled: false };
  }

  function importConnections() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.cfg,.json,application/json';
      input.onchange = async () => {
        try {
          if (!input.files?.[0]) return resolve({ canceled: true });
          const imported = JSON.parse(await input.files[0].text());
          if (!imported || !Array.isArray(imported.connections)) throw new Error('文件格式不正确');
          const current = readState();
          const byRepo = new Map(current.connections.map((item) => [item.repo, item]));
          imported.connections.forEach((item) => {
            const connection = validateConnection(item);
            const existing = byRepo.get(connection.repo);
            byRepo.set(connection.repo, existing ? { ...existing, ...connection, id: existing.id } : connection);
          });
          const next = { connections: [...byRepo.values()], activeConnectionId: imported.activeConnectionId || current.activeConnectionId };
          if (!next.connections.some((item) => item.id === next.activeConnectionId)) next.activeConnectionId = next.connections[0]?.id || null;
          writeState(next);
          resolve({ canceled: false, state: next });
        } catch (error) { reject(error); }
      };
      input.click();
    });
  }

  window.desktopAPI = {
    getState: async () => readState(),
    saveConnection: async (input) => {
      const state = readState();
      const connection = validateConnection(input);
      const index = state.connections.findIndex((item) => item.id === connection.id);
      if (index >= 0) state.connections[index] = connection; else state.connections.push(connection);
      state.activeConnectionId = connection.id;
      writeState(state);
      return { state, connection };
    },
    deleteConnection: async (connectionId) => {
      const state = readState();
      state.connections = state.connections.filter((item) => item.id !== connectionId);
      if (state.activeConnectionId === connectionId) state.activeConnectionId = state.connections[0]?.id || null;
      writeState(state);
      return state;
    },
    activateConnection: async (connectionId) => {
      const state = readState();
      getConnection(state, connectionId);
      state.activeConnectionId = connectionId;
      writeState(state);
      return state;
    },
    exportConnections,
    importConnections,
    listApps: async (connectionId) => {
      const state = readState();
      try {
        const apps = await listApps(getConnection(state, connectionId));
        cacheApps(connectionId, apps);
        return apps;
      } catch (error) {
        const cached = cachedApps(connectionId);
        if (cached) return cached;
        throw error;
      }
    },
    getApp: async (connectionId, filePath) => {
      const state = readState();
      try {
        const result = await readApp(getConnection(state, connectionId), filePath);
        cacheApp(connectionId, result);
        return result;
      } catch (error) {
        const cached = cachedApp(connectionId, filePath);
        if (cached) return cached;
        throw error;
      }
    },
    saveApp: async ({ connectionId, filePath, document, sha, message, metadata }) => {
      const state = readState();
      if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('配置内容需为对象格式');
      return writeApp(getConnection(state, connectionId), filePath, document, sha, message, metadata, connectionId);
    },
    deleteApp: async (connectionId, filePath) => {
      const state = readState();
      const connection = getConnection(state, connectionId);
      if (!filePath || filePath === DIRECTORY_FILE) throw new Error('不能删除应用目录');
      const payload = await readRemoteFile(connection, filePath);
      if (!payload) throw new Error('没有找到这个应用的配置');
      const { document: directory, sha: directorySha } = await readDirectory(connection);
      const index = directory.apps.findIndex((item) => (item.fileName || item.file) === filePath);
      if (index < 0) throw new Error('应用目录中没有登记这个应用');
      await deleteRemoteFile(connection, filePath, payload.sha, `删除应用 ${filePath}`);
      directory.apps.splice(index, 1);
      await writeDirectory(connection, directory, directorySha, '更新应用目录');
      const cache = readCache();
      if (cache.connections[connectionId]) {
        cache.connections[connectionId].apps = directory.apps;
        delete cache.connections[connectionId].documents?.[filePath];
        writeCache(cache);
      }
      return { path: filePath };
    },
    testRequest: async (connectionId, filePath) => {
      const state = readState();
      const result = await readApp(getConnection(state, connectionId), filePath);
      return { path: result.path, document: result.document, metadata: result.metadata };
    },
    createApp: async (connectionId, input) => {
      const state = readState();
      const connection = getConnection(state, connectionId);
      const info = validateAppInfo(input);
      const { document: directory, sha: directorySha } = await readDirectory(connection);
      const filePath = uniqueFileName(directory, input.fileName);
      if (await readRemoteFile(connection, filePath)) throw new Error('这个英文文件名对应的配置已存在，请换一个名称');
      const document = window.configJSON.omitEmptyFields(DEFAULT_DOCUMENT);
      const result = await writeRemoteJson(connection, filePath, document, null, `创建应用 ${info.name}`);
      directory.apps.push({ ...info, fileName: result.path || filePath });
      try {
        const directoryResult = await writeDirectory(connection, directory, directorySha, '登记新应用');
        cacheApps(connectionId, directory.apps);
        cacheApp(connectionId, { path: result.path || filePath, sha: result.sha, document, metadata: info });
        return { ...result, document, metadata: info, directorySha: directoryResult.sha };
      } catch (error) {
        try { await deleteRemoteFile(connection, filePath, result.sha, `撤销未完成的应用创建 ${filePath}`); } catch { /* 保留原始错误 */ }
        throw new Error(`应用配置文件已创建，但应用目录更新失败：${error.message}`);
      }
    },
    openRepo: async (connectionId) => {
      const state = readState();
      const connection = getConnection(state, connectionId);
      window.open(`https://github.com/${normalizeRepo(connection.repo)}`, '_blank');
      return true;
    },
    getUserDataPath: async () => '本机应用存储'
  };
})();
