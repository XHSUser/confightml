(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const ui = {
    connectionSelect: $('#connectionSelect'),
    manageConnectionsBtn: $('#manageConnectionsBtn'),
    repoCaption: $('#repoCaption'),
    appSearch: $('#appSearch'),
    appList: $('#appList'),
    appCount: $('#appCount'),
    refreshAppsBtn: $('#refreshAppsBtn'),
    createAppBtn: $('#createAppBtn'),
    welcomeCreateBtn: $('#welcomeCreateBtn'),
    welcomeState: $('#welcomeState'),
    editor: $('#editor'),
    editorSections: $('.editor-sections'),
    formGrid: $('.form-grid'),
    editorTitle: $('#editorTitle'),
    editorMetaText: $('#editorMetaText'),
    saveState: $('#saveState'),
    deleteAppBtn: $('#deleteAppBtn'),
    saveAppBottomBtn: $('#saveAppBottomBtn'),
    appDisplayName: $('#appDisplayName'),
    appPackageName: $('#appPackageName'),
    appStoreUrl: $('#appStoreUrl'),
    appAdToggle: $('#appAdToggle'),
    appOnToggle: $('#appOnToggle'),
    appVersion: $('#appVersion'),
    updateVersionBtn: $('#updateVersionBtn'),
    revenueUrl: $('#revenueUrl'),
    revenueKey: $('#revenueKey'),
    revenueOffername: $('#revenueOffername'),
    revenuePayname: $('#revenuePayname'),
    payList: $('#payList'),
    payEmpty: $('#payEmpty'),
    payCountBadge: $('#payCountBadge'),
    switchList: $('#switchList'),
    switchEmpty: $('#switchEmpty'),
    otherList: $('#otherList'),
    otherEmpty: $('#otherEmpty'),
    connectionModal: $('#connectionModal'),
    connectionModalTitle: $('#connectionModalTitle'),
    connectionForm: $('#connectionForm'),
    connectionId: $('#connectionId'),
    connectionName: $('#connectionName'),
    connectionToken: $('#connectionToken'),
    connectionRepo: $('#connectionRepo'),
    connectionError: $('#connectionError'),
    deleteConnectionBtn: $('#deleteConnectionBtn'),
    newConnectionBtn: $('#newConnectionBtn'),
    importConnectionsBtn: $('#importConnectionsBtn'),
    exportConnectionsBtn: $('#exportConnectionsBtn'),
    localPath: $('#localPath'),
    createAppModal: $('#createAppModal'),
    createAppForm: $('#createAppForm'),
    newAppName: $('#newAppName'),
    newAppPackage: $('#newAppPackage'),
    newAppStoreUrl: $('#newAppStoreUrl'),
    newAppFileName: $('#newAppFileName'),
    createAppError: $('#createAppError'),
    addPayBtn: $('#addPayBtn'),
    addSwitchBtn: $('#addSwitchBtn'),
    addOtherBtn: $('#addOtherBtn'),
    enableAllSwitchBtn: $('#enableAllSwitchBtn'),
    disableAllSwitchBtn: $('#disableAllSwitchBtn'),
    payEditModal: $('#payEditModal'),
    payEditForm: $('#payEditForm'),
    payEditIndex: $('#payEditIndex'),
    payEditName: $('#payEditName'),
    payEditPayid: $('#payEditPayid'),
    payEditTag: $('#payEditTag'),
    payEditPrice: $('#payEditPrice'),
    payEditOldprice: $('#payEditOldprice'),
    payEditPlanIndex: $('#payEditPlanIndex'),
    payEditShowToggle: $('#payEditShowToggle'),
    payEditDefaultToggle: $('#payEditDefaultToggle'),
    payEditViptype: $('#payEditViptype'),
    payEditTip: $('#payEditTip'),
    payEditTip2: $('#payEditTip2'),
    payEditError: $('#payEditError'),
    rawConfig: $('#rawConfig'),
    applyRawConfigBtn: $('#applyRawConfigBtn'),
    previewBtn: $('#previewBtn'),
    testRequestBtn: $('#testRequestBtn'),
    testRequestPath: $('#testRequestPath'),
    copyConnectionKeyBtn: $('#copyConnectionKeyBtn'),
    previewModal: $('#previewModal'),
    previewContent: $('#previewContent'),
    loadingOverlay: $('#loadingOverlay'),
    loadingText: $('#loadingText'),
    toast: $('#toast')
  };

  const state = {
    connections: [],
    activeConnectionId: null,
    apps: [],
    selectedPath: null,
    current: null,
    currentMetadata: null,
    currentSha: null,
    saving: false,
    loadingCount: 0,
    toastTimer: null,
    loadAppSequence: 0,
    validationAttempted: false
  };

  const emptyDocument = () => ({
    app: { ad: 1, on: 1, version: '1.0.0' },
    switch: [],
    other: [],
    taku: { appid: '', appkey: '', banner: '', insert: '', open: '', reward: '' },
    paylist: [],
    revenue: { url: 'https://api.rc-backup.com/', key: '', offername: 'offer', payname: 'pay' }
  });

  function activeConnection() {
    return state.connections.find((connection) => connection.id === state.activeConnectionId) || null;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function showToast(message, type = '') {
    clearTimeout(state.toastTimer);
    ui.toast.textContent = message;
    ui.toast.className = `toast show ${type}`;
    state.toastTimer = setTimeout(() => { ui.toast.className = 'toast'; }, 3200);
  }

  function showError(target, error) {
    const message = error?.message || String(error);
    if (target) target.textContent = message;
    showToast(message, 'error');
  }

  function beginLoading(message = '正在处理…') {
    state.loadingCount += 1;
    ui.loadingText.textContent = message;
    ui.loadingOverlay.hidden = false;
  }

  function endLoading() {
    state.loadingCount = Math.max(0, state.loadingCount - 1);
    if (!state.loadingCount) ui.loadingOverlay.hidden = true;
  }

  async function request(task, message) {
    beginLoading(message);
    try { return await task(); } finally { endLoading(); }
  }

  function openModal(element) {
    element.hidden = false;
    requestAnimationFrame(() => element.querySelector('input:not([type="hidden"])')?.focus());
  }

  function closeModal(element) {
    element.hidden = true;
  }

  function renderConnectionSelect() {
    ui.connectionSelect.innerHTML = '';
    if (!state.connections.length) {
      ui.connectionSelect.innerHTML = '<option value="">未连接配置</option>';
      ui.connectionSelect.disabled = true;
      ui.repoCaption.textContent = '还没有连接配置';
      return;
    }
    ui.connectionSelect.disabled = false;
    state.connections.forEach((connection) => {
      const option = document.createElement('option');
      option.value = connection.id;
      option.textContent = connection.name;
      option.selected = connection.id === state.activeConnectionId;
      ui.connectionSelect.appendChild(option);
    });
    const connection = activeConnection();
    ui.repoCaption.textContent = connection ? `${connection.name} · 当前连接` : '';
  }

  function renderAppList() {
    const keyword = ui.appSearch.value.trim().toLowerCase();
    const filtered = state.apps.filter((app) => !keyword || `${app.name} ${app.fileName}`.toLowerCase().includes(keyword));
    ui.appCount.textContent = `${state.apps.length} 个应用`;
    if (!filtered.length) {
      ui.appList.innerHTML = `<div class="empty-state compact"><div class="empty-icon" aria-hidden="true">${state.apps.length ? '⌕' : '⌁'}</div><p>${state.apps.length ? '没有匹配的应用' : '还没有应用配置'}</p></div>`;
      return;
    }
    ui.appList.innerHTML = filtered.map((app) => `
      <button class="app-item ${app.path === state.selectedPath ? 'active' : ''}" data-app-path="${escapeHtml(app.path)}" title="${escapeHtml(app.name)}" ${app.path === state.selectedPath ? 'aria-current="page"' : ''}>
        <span class="file-icon" aria-hidden="true">${escapeHtml((app.name || '应').slice(0, 1))}</span>
        <span class="app-item-name">${escapeHtml(app.name)}</span>
      </button>`).join('');
  }

  function setEditorVisible(visible) {
    ui.welcomeState.hidden = visible;
    ui.editor.hidden = !visible;
  }

  function activateSection(section, focusTab = false) {
    const selected = ui.editorSections.querySelector(`[data-section="${section}"]`);
    if (!selected) return;
    ui.editorSections.querySelectorAll('[data-section]').forEach((tab) => {
      const active = tab === selected;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    ui.formGrid.querySelectorAll('[data-config-section]').forEach((panel) => {
      panel.hidden = panel.dataset.configSection !== section;
    });
    ui.formGrid.scrollTop = 0;
    if (focusTab) selected.focus();
  }

  const sectionLayout = window.matchMedia('(max-width: 900px)');
  function updateSectionOrientation() {
    ui.editorSections.setAttribute('aria-orientation', sectionLayout.matches ? 'horizontal' : 'vertical');
  }
  sectionLayout.addEventListener('change', updateSectionOrientation);
  updateSectionOrientation();

  function setToggleButton(button, value, onText = '开启', offText = '关闭') {
    if (!button) return;
    const enabled = Number(value) === 1;
    button.dataset.value = enabled ? '1' : '0';
    button.classList.toggle('on', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    const label = button.querySelector('strong');
    if (label) label.textContent = enabled ? onText : offText;
  }

  function vipTypeLabel(value) {
    return ({ 1: '周会员', 2: '月会员', 3: '年会员', 9: '永久会员' })[Number(value)] || '周会员';
  }

  const switchTypes = [
    { value: 0, label: '开屏' },
    { value: 1, label: '插屏' },
    { value: 2, label: '横幅广告' },
    { value: 3, label: '激励视频' }
  ];

  function renderPayList() {
    const list = Array.isArray(state.current?.paylist) ? state.current.paylist : [];
    ui.payCountBadge.textContent = list.length;
    ui.payEmpty.hidden = list.length > 0;
    if (!list.length) { ui.payList.innerHTML = ''; return; }
    ui.payList.innerHTML = `
      <div class="pay-head"><span>套餐名称 *</span><span>支付 ID *</span><span>会员类型</span><span>售价</span><span>显示</span><span>默认</span><span>操作</span></div>
      ${list.map((item, index) => `
        <div class="pay-row" data-pay-index="${index}">
          <input class="pay-name-field" data-pay-field="name" data-required-field="套餐名称" value="${escapeHtml(item.name)}" placeholder="套餐名称 *" aria-label="套餐名称" required />
          <input class="pay-id-field" data-pay-field="payid" data-required-field="支付 ID" value="${escapeHtml(item.payid)}" placeholder="支付 ID *" aria-label="支付 ID" inputmode="text" required />
          <span class="pay-viptype">${escapeHtml(vipTypeLabel(item.viptype ?? 1))}</span>
          <input class="pay-money-field" data-pay-field="price" value="${escapeHtml(item.price)}" placeholder="14.0" inputmode="decimal" />
          <button type="button" class="switch-control compact ${Number(item.show ?? 1) === 1 ? 'on' : ''}" data-pay-toggle="show" data-value="${Number(item.show ?? 1) === 1 ? 1 : 0}" data-on-text="是" data-off-text="否" aria-label="是否显示套餐" aria-pressed="${Number(item.show ?? 1) === 1}"><span class="switch-knob"></span><strong>${Number(item.show ?? 1) === 1 ? '是' : '否'}</strong></button>
          <button type="button" class="switch-control compact ${Number(item.default ?? 0) === 1 ? 'on' : ''}" data-pay-toggle="default" data-value="${Number(item.default ?? 0) === 1 ? 1 : 0}" data-on-text="是" data-off-text="否" aria-label="设为默认套餐" aria-pressed="${Number(item.default ?? 0) === 1}"><span class="switch-knob"></span><strong>${Number(item.default ?? 0) === 1 ? '是' : '否'}</strong></button>
          <input type="hidden" data-pay-field="oldprice" value="${escapeHtml(item.oldprice)}" />
          <input type="hidden" data-pay-field="tag" value="${escapeHtml(item.tag)}" />
          <input type="hidden" data-pay-field="tip" value="${escapeHtml(item.tip)}" />
          <input type="hidden" data-pay-field="tip2" value="${escapeHtml(item.tip2)}" />
          <span class="row-actions"><button class="row-action edit" data-pay-action="edit" title="编辑">编辑</button><button class="row-action" data-pay-action="up" title="上移">↑</button><button class="row-action" data-pay-action="down" title="下移">↓</button><button class="row-action delete" data-pay-action="delete" title="删除">×</button></span>
        </div>`).join('')}`;
  }

  function renderSwitchList() {
    const list = Array.isArray(state.current?.switch) ? state.current.switch : [];
    ui.switchEmpty.hidden = list.length > 0;
    ui.switchList.innerHTML = list.map((item, index) => {
      const selectedType = item.type == null ? '' : String(item.type);
      const unknownType = selectedType !== '' && !switchTypes.some(({ value }) => String(value) === selectedType);
      return `
      <div class="switch-row" data-switch-index="${index}">
        <span class="switch-index" aria-label="开关索引 ${index}"><small>索引</small><strong>${index}</strong></span>
        <input class="switch-key-field" data-switch-field="key" data-required-field="开关名称" value="${escapeHtml(item.key)}" placeholder="开关名称 *" aria-label="开关名称" required />
        <input class="switch-tip-field" data-switch-field="tip" value="${escapeHtml(item.tip)}" placeholder="开关描述" aria-label="开关描述" />
        <select class="switch-type-field" data-switch-field="type" data-required-field="开关类型" aria-label="开关类型" required>
          <option value="" ${selectedType === '' ? 'selected' : ''}>选择类型</option>
          ${unknownType ? `<option value="${escapeHtml(selectedType)}" selected>未知类型</option>` : ''}
          ${switchTypes.map(({ value, label }) => `<option value="${value}" ${selectedType === String(value) ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button type="button" class="switch-control ${Number(item.open) === 1 ? 'on' : ''}" data-toggle="switch" data-value="${Number(item.open) === 1 ? 1 : 0}" data-on-text="开启" data-off-text="关闭" aria-pressed="${Number(item.open) === 1}"><span class="switch-knob"></span><strong>${Number(item.open) === 1 ? '开启' : '关闭'}</strong></button>
        <button type="button" class="row-action delete" data-switch-action="delete" title="删除" aria-label="删除开关">×</button>
      </div>`;
    }).join('');
    markDuplicateSwitchKeys();
  }

  function markDuplicateSwitchKeys() {
    const inputs = $$('.switch-row [data-switch-field="key"]');
    const counts = new Map();
    inputs.forEach((input) => {
      const key = input.value.trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    inputs.forEach((input) => {
      const duplicate = Boolean(input.value.trim() && counts.get(input.value.trim()) > 1);
      const missing = state.validationAttempted && !input.value.trim();
      if (duplicate || missing) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
    return [...counts.values()].some((count) => count > 1);
  }

  function renderOtherList() {
    const list = Array.isArray(state.current?.other) ? state.current.other : [];
    ui.otherEmpty.hidden = list.length > 0;
    ui.otherList.innerHTML = list.map((item, index) => `
      <div class="other-row" data-other-index="${index}">
        <label class="field"><span>字段名称</span><input data-other-field="key" value="${escapeHtml(item.key)}" type="text" placeholder="请输入字段名称" /></label>
        <label class="field"><span>内容</span><input data-other-field="value" value="${escapeHtml(item.value)}" type="text" placeholder="请输入内容" /></label>
        <label class="field"><span>信息描述</span><input data-other-field="tip" value="${escapeHtml(item.tip)}" type="text" placeholder="请输入描述" /></label>
        <button type="button" class="row-action delete" data-other-action="delete" title="删除这条信息" aria-label="删除这条信息">×</button>
      </div>`).join('');
  }

  function renderEditor() {
    if (!state.current) { setEditorVisible(false); return; }
    state.validationAttempted = false;
    ui.editorSections.querySelectorAll('.has-error').forEach((tab) => tab.classList.remove('has-error'));
    const document = state.current;
    document.app ||= {};
    document.revenue ||= {};
    document.taku ||= {};
    document.paylist ||= [];
    document.switch = Array.isArray(document.switch) ? document.switch : [];
    document.other = Array.isArray(document.other) ? document.other : [];
    ui.appDisplayName.value = state.currentMetadata?.name ?? '';
    ui.appPackageName.value = state.currentMetadata?.packageName ?? '';
    ui.appStoreUrl.value = state.currentMetadata?.appStoreUrl ?? '';
    setToggleButton(ui.appAdToggle, document.app.ad ?? 1, '开启', '关闭');
    setToggleButton(ui.appOnToggle, document.app.on ?? 1, '开启', '关闭');
    ui.appVersion.value = document.app.version ?? '';
    ui.revenueUrl.value = document.revenue.url ?? '';
    ui.revenueKey.value = document.revenue.key ?? '';
    ui.revenueOffername.value = document.revenue.offername ?? '';
    ui.revenuePayname.value = document.revenue.payname ?? '';
    $$('[data-taku]').forEach((element) => { element.value = document.taku[element.dataset.taku] ?? ''; });
    renderPayList();
    renderSwitchList();
    renderOtherList();
    ui.rawConfig.value = JSON.stringify(document, null, 2);
    ui.testRequestPath.value = state.selectedPath ? state.selectedPath.replace(/\.json$/i, '') : '';
    ui.editorTitle.textContent = state.currentMetadata?.name || '应用配置';
    ui.editorMetaText.textContent = '已加载';
    ui.saveState.textContent = '';
    ui.saveState.className = 'save-state';
    setEditorVisible(true);
  }

  function syncFormToDocument() {
    if (!state.current) return;
    state.current.app ||= {};
    state.current.revenue ||= {};
    state.current.taku ||= {};
    state.currentMetadata = {
      ...(state.currentMetadata || {}),
      name: ui.appDisplayName.value.trim(),
      packageName: ui.appPackageName.value.trim(),
      appStoreUrl: ui.appStoreUrl.value.trim()
    };
    state.current.app.ad = Number(ui.appAdToggle?.dataset.value) === 1 ? 1 : 0;
    state.current.app.on = Number(ui.appOnToggle?.dataset.value) === 1 ? 1 : 0;
    state.current.app.version = ui.appVersion.value.trim();
    state.current.revenue.url = ui.revenueUrl.value.trim();
    state.current.revenue.key = ui.revenueKey.value.trim();
    state.current.revenue.offername = ui.revenueOffername.value.trim();
    state.current.revenue.payname = ui.revenuePayname.value.trim();
    $$('[data-taku]').forEach((element) => { state.current.taku[element.dataset.taku] = element.value.trim(); });
    state.current.paylist = $$('.pay-row').map((row) => {
      const item = { ...(state.current.paylist[Number(row.dataset.payIndex)] || {}) };
      row.querySelectorAll('[data-pay-field]').forEach((field) => {
        item[field.dataset.payField] = field.value.trim();
      });
      item.show = Number(row.querySelector('[data-pay-toggle="show"]')?.dataset.value) === 1 ? 1 : 0;
      item.default = Number(row.querySelector('[data-pay-toggle="default"]')?.dataset.value) === 1 ? 1 : 0;
      return item;
    });
    state.current.switch = $$('.switch-row').map((row) => {
      const item = { ...(state.current.switch[Number(row.dataset.switchIndex)] || {}) };
      item.key = row.querySelector('[data-switch-field="key"]').value.trim();
      item.tip = row.querySelector('[data-switch-field="tip"]').value.trim();
      item.open = Number(row.querySelector('[data-toggle="switch"]')?.dataset.value) === 1 ? 1 : 0;
      const type = row.querySelector('[data-switch-field="type"]').value;
      if (type === '') delete item.type;
      else item.type = Number(type);
      return item;
    });
    state.current.other = $$('.other-row').map((row) => ({
      key: row.querySelector('[data-other-field="key"]').value,
      value: row.querySelector('[data-other-field="value"]').value,
      tip: row.querySelector('[data-other-field="tip"]').value
    }));
  }

  function normaliseDocument() {
    syncFormToDocument();
    const document = state.current;
    document.app ||= {};
    document.revenue ||= {};
    document.taku ||= {};
    document.paylist ||= [];
    document.switch ||= [];
    document.other ||= [];
    state.validationAttempted = true;
    const missing = refreshRequiredFields();
    const duplicateKeys = markDuplicateSwitchKeys();
    updateInvalidTabs();
    if (missing.length) {
      focusInvalidField(missing[0].field);
      throw new Error(`请填写或选择${missing[0].label}${missing.length > 1 ? `，还有 ${missing.length - 1} 项未完成` : ''}`);
    }
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(String(document.app.version || '').trim())) {
      ui.appVersion.setAttribute('aria-invalid', 'true');
      updateInvalidTabs();
      focusInvalidField(ui.appVersion);
      throw new Error('当前版本只能填写 1.0 或 1.0.0 这类格式');
    }
    if (duplicateKeys) {
      focusInvalidField(ui.switchList.querySelector('[data-switch-field="key"][aria-invalid="true"]'));
      throw new Error('开关 key 不能重复');
    }
    document.switch.forEach((item) => {
      if (item.key && !/^[A-Za-z0-9_-]+$/.test(item.key)) throw new Error('开关名称只能使用英文、数字、下划线或短横线');
      if (item.type != null && ![0, 1, 2, 3].includes(item.type)) throw new Error('开关类型不正确');
    });
    let defaultFound = false;
    document.paylist = document.paylist.map((item) => {
      const next = validatePayItem({ ...item, show: Number(item.show) ? 1 : 0, default: Number(item.default) ? 1 : 0 });
      if (next.default === 1 && defaultFound) next.default = 0;
      if (next.default === 1) defaultFound = true;
      return next;
    });
    ui.rawConfig.value = JSON.stringify(document, null, 2);
    return document;
  }

  function requiredFieldLabel(field) {
    const payRow = field.closest('[data-pay-index]');
    if (payRow) return `第 ${Number(payRow.dataset.payIndex) + 1} 个套餐的${field.dataset.requiredField}`;
    const switchRow = field.closest('[data-switch-index]');
    if (switchRow) return `索引 ${switchRow.dataset.switchIndex} 的${field.dataset.requiredField}`;
    return field.dataset.requiredField;
  }

  function refreshRequiredFields() {
    const missing = [];
    ui.formGrid.querySelectorAll('[data-required-field]').forEach((field) => {
      const empty = !field.value.trim();
      const invalidVersion = field === ui.appVersion && !empty && !/^\d+\.\d+(?:\.\d+)?$/.test(field.value.trim());
      if (empty) missing.push({ field, label: requiredFieldLabel(field) });
      if (state.validationAttempted && (empty || invalidVersion)) field.setAttribute('aria-invalid', 'true');
      else if (!field.matches('[data-switch-field="key"]')) field.removeAttribute('aria-invalid');
    });
    return missing;
  }

  function updateInvalidTabs() {
    ui.editorSections.querySelectorAll('[data-section]').forEach((tab) => {
      const panel = ui.formGrid.querySelector(`[data-config-section="${tab.dataset.section}"]`);
      tab.classList.toggle('has-error', Boolean(panel?.querySelector('[aria-invalid="true"]')));
    });
  }

  function focusInvalidField(field) {
    if (!field) return;
    activateSection(field.closest('[data-config-section]').dataset.configSection);
    field.focus();
  }

  function validatePayItem(item) {
    const next = { ...item, index: item.index === '' || item.index == null ? 0 : Number(item.index), viptype: item.viptype == null || item.viptype === '' ? 1 : Number(item.viptype) };
    if (!String(next.name || '').trim()) throw new Error('套餐名称为必填项');
    if (!String(next.payid || '').trim()) throw new Error('支付 ID 为必填项');
    if (!Number.isInteger(next.index) || next.index < 0) throw new Error('套餐序号只能填写纯数字');
    if (![1, 2, 3, 9].includes(next.viptype)) throw new Error('会员类型不正确');
    if (next.payid && !/^[A-Za-z0-9.]+$/.test(next.payid)) throw new Error('支付 ID 只能使用英文、数字和点号');
    if (next.price && !/^\d+(?:\.\d{1,2})?$/.test(next.price)) throw new Error('售价只能填写金额，例如 14 或 14.00');
    if (next.oldprice && !/^\d+(?:\.\d{1,2})?$/.test(next.oldprice)) throw new Error('原价只能填写金额，例如 28 或 28.00');
    return next;
  }

  async function loadApps({ selectFirst = false } = {}) {
    state.loadAppSequence += 1;
    const connection = activeConnection();
    if (!connection) {
      state.apps = [];
      state.selectedPath = null;
      state.current = null;
      state.currentMetadata = null;
      renderConnectionSelect(); renderAppList(); renderEditor();
      return;
    }
    ui.refreshAppsBtn.disabled = true;
    try {
      state.apps = await request(() => window.desktopAPI.listApps(connection.id), '正在读取应用列表…');
      if (selectFirst || !state.apps.some((app) => app.path === state.selectedPath)) {
        state.selectedPath = state.apps[0]?.path || null;
        state.current = null;
        state.currentMetadata = null;
      }
      renderAppList();
      if (state.selectedPath) await loadApp(state.selectedPath); else renderEditor();
    } catch (error) {
      state.apps = [];
      state.selectedPath = null;
      state.current = null;
      state.currentMetadata = null;
      renderAppList(); renderEditor();
      showError(null, error);
    } finally { ui.refreshAppsBtn.disabled = false; }
  }

  async function loadApp(filePath) {
    const connection = activeConnection();
    if (!connection) return;
    const loadSequence = ++state.loadAppSequence;
    state.selectedPath = filePath;
    state.current = null;
    state.currentMetadata = null;
    state.currentSha = null;
    renderAppList();
    ui.editorMetaText.textContent = '正在加载…';
    setEditorVisible(false);
    try {
      const result = await request(() => window.desktopAPI.getApp(connection.id, filePath), '正在读取应用配置…');
      if (loadSequence !== state.loadAppSequence || activeConnection()?.id !== connection.id) return;
      state.current = result.document;
      state.currentMetadata = result.metadata || { name: filePath.replace(/\.json$/i, '') };
      state.currentSha = result.sha;
      renderEditor();
    } catch (error) {
      if (loadSequence === state.loadAppSequence) showError(null, error);
    }
  }

  function openConnectionModal(connection = null) {
    ui.connectionError.textContent = '';
    ui.connectionModalTitle.textContent = connection ? '编辑连接配置' : '添加连接配置';
    ui.connectionId.value = connection?.id || '';
    ui.connectionName.value = connection?.name || '';
    ui.connectionToken.value = connection?.token || '';
    ui.connectionRepo.value = connection?.repo ? `https://github.com/${connection.repo}` : '';
    ui.deleteConnectionBtn.hidden = !connection;
    openModal(ui.connectionModal);
  }

  function openCreateModal() {
    ui.createAppError.textContent = '';
    ui.newAppName.value = '';
    ui.newAppPackage.value = '';
    ui.newAppStoreUrl.value = '';
    ui.newAppFileName.value = '';
    if (!activeConnection()) { openConnectionModal(); return; }
    openModal(ui.createAppModal);
  }

  function applyRawConfig() {
    if (!state.current) return;
    try {
      const parsed = JSON.parse(ui.rawConfig.value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('内容需为一个对象');
      state.current = parsed;
      renderEditor();
      showToast('文本配置已应用');
    } catch (error) { showError(null, error); }
  }

  function previewCurrent() {
    if (!state.current) return;
    try {
      const document = normaliseDocument();
      ui.previewContent.textContent = JSON.stringify(document, null, 2);
      ui.previewModal.querySelector('.eyebrow').textContent = 'PREVIEW';
      ui.previewModal.querySelector('h2').textContent = '配置预览';
      openModal(ui.previewModal);
    } catch (error) { showError(null, error); }
  }

  async function saveCurrentApp() {
    if (!state.current || !state.selectedPath || state.saving) return;
    try {
      const document = normaliseDocument();
      state.saving = true;
      ui.saveState.textContent = '保存中…';
      ui.saveState.className = 'save-state';
      ui.saveAppBottomBtn.disabled = true;
      const result = await request(() => window.desktopAPI.saveApp({
        connectionId: activeConnection().id,
        filePath: state.selectedPath,
        document,
        sha: state.currentSha,
        message: `更新应用配置 ${state.selectedPath}`,
        metadata: state.currentMetadata
      }), '正在保存配置…');
      state.currentSha = result.sha || state.currentSha;
      ui.saveState.textContent = '已保存';
      ui.saveState.className = 'save-state success';
      ui.editorMetaText.textContent = '已保存';
      showToast('配置已保存');
      await loadApps();
    } catch (error) {
      ui.saveState.textContent = '保存失败';
      ui.saveState.className = 'save-state error';
      showError(null, error);
    } finally { state.saving = false; ui.saveAppBottomBtn.disabled = false; }
  }

  async function handleConnectionSubmit(event) {
    event.preventDefault();
    ui.connectionError.textContent = '';
    try {
      const result = await request(() => window.desktopAPI.saveConnection({
        id: ui.connectionId.value || undefined,
        name: ui.connectionName.value,
        token: ui.connectionToken.value,
        repo: ui.connectionRepo.value
      }), '正在保存连接配置…');
      state.connections = result.state.connections;
      state.activeConnectionId = result.state.activeConnectionId;
      closeModal(ui.connectionModal);
      renderConnectionSelect();
      await loadApps({ selectFirst: true });
      showToast('连接配置已保存');
    } catch (error) { showError(ui.connectionError, error); }
  }

  async function deleteConnection() {
    const connection = state.connections.find((item) => item.id === ui.connectionId.value);
    if (!connection) return;
    if (!window.confirm(`确定删除“${connection.name}”的连接配置吗？本机保存的访问令牌会移除，远程应用配置不会被删除。`)) return;
    ui.deleteConnectionBtn.disabled = true;
    try {
      const saved = await request(() => window.desktopAPI.deleteConnection(connection.id), '正在删除连接配置…');
      state.connections = saved.connections;
      state.activeConnectionId = saved.activeConnectionId;
      state.selectedPath = null;
      state.current = null;
      state.currentMetadata = null;
      state.currentSha = null;
      renderConnectionSelect();
      await loadApps({ selectFirst: true });
      if (state.connections.length) closeModal(ui.connectionModal);
      else openConnectionModal();
      showToast('连接配置已删除');
    } catch (error) { showError(ui.connectionError, error); }
    finally { ui.deleteConnectionBtn.disabled = false; }
  }

  async function handleCreateApp(event) {
    event.preventDefault();
    ui.createAppError.textContent = '';
    const connection = activeConnection();
    if (!connection) { closeModal(ui.createAppModal); openConnectionModal(); return; }
    try {
      const result = await request(() => window.desktopAPI.createApp(connection.id, {
        name: ui.newAppName.value,
        packageName: ui.newAppPackage.value,
        appStoreUrl: ui.newAppStoreUrl.value,
        fileName: ui.newAppFileName.value
      }), '正在创建应用…');
      closeModal(ui.createAppModal);
      state.selectedPath = result.path;
      state.current = result.document;
      state.currentMetadata = result.metadata;
      state.currentSha = result.sha;
      await loadApps();
      await loadApp(result.path);
      showToast('应用已创建');
    } catch (error) { showError(ui.createAppError, error); }
  }

  async function deleteCurrentApp() {
    if (!state.current || !state.selectedPath || state.saving) return;
    const appName = state.currentMetadata?.name || state.selectedPath;
    if (!window.confirm(`确定要删除“${appName}”吗？删除后会同步移除远程配置，无法在应用内撤销。`)) return;
    try {
      state.saving = true;
      const connection = activeConnection();
      await request(() => window.desktopAPI.deleteApp(connection.id, state.selectedPath), '正在删除应用…');
      showToast('应用已删除');
      state.current = null;
      state.currentMetadata = null;
      state.currentSha = null;
      state.selectedPath = null;
      await loadApps({ selectFirst: true });
    } catch (error) { showError(null, error); }
    finally { state.saving = false; }
  }

  async function testRequest() {
    const connection = activeConnection();
    const requestedPath = state.selectedPath || ui.testRequestPath.value.trim();
    if (!connection) return showError(null, new Error('请先选择连接配置'));
    if (!requestedPath) return showError(null, new Error('请输入配置路径'));
    const filePath = requestedPath.toLowerCase().endsWith('.json') ? requestedPath : `${requestedPath}.json`;
    try {
      const result = await request(() => window.desktopAPI.testRequest(connection.id, filePath), '正在测试请求…');
      ui.previewContent.textContent = JSON.stringify(result.document, null, 2);
      ui.previewModal.querySelector('.eyebrow').textContent = 'REQUEST RESULT';
      ui.previewModal.querySelector('h2').textContent = '测试请求结果';
      openModal(ui.previewModal);
      showToast('请求成功');
    } catch (error) { showError(null, error); }
  }

  async function updateVersionFromAppStore() {
    const storeUrl = ui.appStoreUrl.value.trim();
    if (!storeUrl) {
      showError(null, new Error('请输入商城链接'));
      ui.appStoreUrl.focus();
      return;
    }
    try {
      const result = await request(() => window.desktopAPI.lookupAppStoreVersion(storeUrl), '正在获取商城版本…');
      ui.appVersion.value = result.version;
      showToast(`已更新为 ${result.version}，请保存配置`);
    } catch (error) { showError(null, error); }
  }

  function buildRequestUrl(connection, filePath) {
    const encodedPath = String(filePath).split('/').map((part) => encodeURIComponent(part)).join('/');
    return `https://api.github.com/repos/${connection.repo}/contents/${encodedPath}`;
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch (_) { /* Some embedded WebViews deny clipboard writes. */ }
    }
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    try {
      helper.focus();
      helper.select();
      if (!document.execCommand('copy')) throw new Error('复制失败');
    } finally { helper.remove(); }
  }

  async function copyConnectionKey() {
    const token = activeConnection()?.token;
    if (!token) return showError(null, new Error('当前连接没有访问令牌'));
    try {
      await copyText(token);
      showToast('访问令牌已复制');
    } catch (error) { showError(null, error); }
  }

  async function copyTestRequestUrl() {
    const connection = activeConnection();
    const filePath = state.selectedPath || ui.testRequestPath.value.trim();
    if (!connection) return showError(null, new Error('请先选择连接配置'));
    if (!filePath) return showError(null, new Error('当前没有配置路径'));
    const requestPath = filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`;
    const fullUrl = buildRequestUrl(connection, requestPath);
    try {
      await copyText(fullUrl);
      showToast('第三方请求地址已复制');
    } catch (error) { showError(null, error); }
  }

  function addPay() {
    if (!state.current) return;
    syncFormToDocument();
    state.current.paylist.push({ name: '', payid: '', price: '', oldprice: '', tag: '', show: 1, default: state.current.paylist.length ? 0 : 1, index: 0, viptype: 1, tip: '', tip2: '' });
    renderPayList();
  }

  function addSwitch() {
    if (!state.current) return;
    syncFormToDocument();
    state.current.switch.push({ key: '', tip: '', type: 0, open: 0 });
    renderSwitchList();
  }

  function addOther() {
    if (!state.current) return;
    syncFormToDocument();
    state.current.other.push({ key: '', value: '', tip: '' });
    renderOtherList();
    ui.otherList.lastElementChild?.querySelector('input')?.focus();
  }

  function setAllSwitches(open) {
    $$('.switch-row [data-toggle="switch"]').forEach((button) => {
      setToggleButton(button, open ? 1 : 0, '开启', '关闭');
    });
  }

  function openPayEditor(index) {
    syncFormToDocument();
    const item = state.current?.paylist?.[index];
    if (!item) return;
    ui.payEditError.textContent = '';
    ui.payEditIndex.value = index;
    ui.payEditName.value = item.name ?? '';
    ui.payEditPayid.value = item.payid ?? '';
    ui.payEditTag.value = item.tag ?? '';
    ui.payEditPrice.value = item.price ?? '';
    ui.payEditOldprice.value = item.oldprice ?? '';
    ui.payEditPlanIndex.value = item.index ?? 0;
    setToggleButton(ui.payEditShowToggle, item.show ?? 1, '显示', '隐藏');
    setToggleButton(ui.payEditDefaultToggle, item.default ?? 0, '是', '否');
    ui.payEditViptype.value = String(item.viptype ?? 1);
    ui.payEditTip.value = item.tip ?? '';
    ui.payEditTip2.value = item.tip2 ?? '';
    openModal(ui.payEditModal);
  }

  function handlePayEditSubmit(event) {
    event.preventDefault();
    ui.payEditError.textContent = '';
    try {
      const index = Number(ui.payEditIndex.value);
      const current = state.current.paylist[index] || {};
      const updated = validatePayItem({
        ...current,
        name: ui.payEditName.value.trim(),
        payid: ui.payEditPayid.value.trim(),
        tag: ui.payEditTag.value.trim(),
        price: ui.payEditPrice.value.trim(),
        oldprice: ui.payEditOldprice.value.trim(),
        index: ui.payEditPlanIndex.value.trim(),
        show: Number(ui.payEditShowToggle.dataset.value) === 1 ? 1 : 0,
        default: Number(ui.payEditDefaultToggle.dataset.value) === 1 ? 1 : 0,
        viptype: Number(ui.payEditViptype.value),
        tip: ui.payEditTip.value.trim(),
        tip2: ui.payEditTip2.value.trim()
      });
      if (updated.default === 1) {
        state.current.paylist = state.current.paylist.map((item, itemIndex) => ({ ...item, default: itemIndex === index ? 1 : 0 }));
      }
      state.current.paylist[index] = updated;
      renderPayList();
      closeModal(ui.payEditModal);
      showToast('套餐已更新，请保存配置');
    } catch (error) { showError(ui.payEditError, error); }
  }

  function handlePayAction(event) {
    const toggle = event.target.closest('[data-pay-toggle]');
    if (toggle) {
      const row = toggle.closest('[data-pay-index]');
      if (!row) return;
      const index = Number(row.dataset.payIndex);
      const next = Number(toggle.dataset.value) === 1 ? 0 : 1;
      setToggleButton(toggle, next, toggle.dataset.onText || '是', toggle.dataset.offText || '否');
      syncFormToDocument();
      if (toggle.dataset.payToggle === 'default' && next === 1) {
        state.current.paylist = state.current.paylist.map((item, itemIndex) => ({ ...item, default: itemIndex === index ? 1 : 0 }));
        renderPayList();
      }
      return;
    }
    const button = event.target.closest('[data-pay-action]');
    if (!button) return;
    const row = button.closest('[data-pay-index]');
    if (!row) return;
    syncFormToDocument();
    const index = Number(row.dataset.payIndex);
    const action = button.dataset.payAction;
    if (action === 'edit') { openPayEditor(index); return; }
    if (action === 'delete') state.current.paylist.splice(index, 1);
    if (action === 'up' && index > 0) [state.current.paylist[index - 1], state.current.paylist[index]] = [state.current.paylist[index], state.current.paylist[index - 1]];
    if (action === 'down' && index < state.current.paylist.length - 1) [state.current.paylist[index + 1], state.current.paylist[index]] = [state.current.paylist[index], state.current.paylist[index + 1]];
    renderPayList();
  }

  function handleSwitchAction(event) {
    const button = event.target.closest('[data-switch-action]');
    if (!button) return;
    const row = button.closest('[data-switch-index]');
    if (!row) return;
    syncFormToDocument();
    state.current.switch.splice(Number(row.dataset.switchIndex), 1);
    renderSwitchList();
  }

  function handleOtherAction(event) {
    const button = event.target.closest('[data-other-action="delete"]');
    if (!button) return;
    const row = button.closest('[data-other-index]');
    if (!row) return;
    syncFormToDocument();
    state.current.other.splice(Number(row.dataset.otherIndex), 1);
    renderOtherList();
  }

  function handleToggleClick(event) {
    const button = event.target.closest('[data-toggle], [data-pay-toggle]');
    if (!button) return;
    if (button.matches('[data-pay-toggle]')) return;
    const next = Number(button.dataset.value) === 1 ? 0 : 1;
    setToggleButton(button, next, button.dataset.onText || '开启', button.dataset.offText || '关闭');
  }

  function sanitiseInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === 'appVersion') target.value = target.value.replace(/[^0-9.]/g, '');
    if (target.matches('[data-pay-field="payid"]')) target.value = target.value.replace(/[^A-Za-z0-9.]/g, '');
    if (target.matches('[data-pay-field="price"], [data-pay-field="oldprice"]')) target.value = target.value.replace(/[^0-9.]/g, '');
    if (target.matches('[data-switch-field="key"]')) {
      target.value = target.value.replace(/[^A-Za-z0-9_-]/g, '');
      markDuplicateSwitchKeys();
    }
    if (target.id === 'payEditPayid') target.value = target.value.replace(/[^A-Za-z0-9.]/g, '');
    if (target.matches('#payEditPrice, #payEditOldprice')) target.value = target.value.replace(/[^0-9.]/g, '');
    if (target.id === 'payEditPlanIndex') target.value = target.value.replace(/[^0-9]/g, '');
    if (state.validationAttempted && target.matches('[data-required-field]')) {
      refreshRequiredFields();
      markDuplicateSwitchKeys();
      updateInvalidTabs();
    }
  }

  async function init() {
    try {
      const saved = await window.desktopAPI.getState();
      state.connections = saved.connections || [];
      state.activeConnectionId = saved.activeConnectionId || state.connections[0]?.id || null;
      renderConnectionSelect();
      const localPath = await window.desktopAPI.getUserDataPath();
      ui.localPath.textContent = localPath;
      if (state.connections.length) await loadApps({ selectFirst: true });
      else { renderAppList(); setEditorVisible(false); openConnectionModal(); }
    } catch (error) { showError(null, error); }
  }

  ui.connectionSelect.addEventListener('change', async () => {
    try {
      const saved = await request(() => window.desktopAPI.activateConnection(ui.connectionSelect.value), '正在切换连接…');
      state.connections = saved.connections;
      state.activeConnectionId = saved.activeConnectionId;
      state.selectedPath = null; state.current = null; state.currentMetadata = null;
      renderConnectionSelect(); await loadApps({ selectFirst: true });
    } catch (error) { showError(null, error); }
  });
  ui.manageConnectionsBtn.addEventListener('click', () => openConnectionModal(activeConnection()));
  ui.deleteConnectionBtn.addEventListener('click', deleteConnection);
  ui.newConnectionBtn.addEventListener('click', () => openConnectionModal());
  ui.refreshAppsBtn.addEventListener('click', () => loadApps());
  ui.appSearch.addEventListener('input', renderAppList);
  ui.appList.addEventListener('click', (event) => { const item = event.target.closest('[data-app-path]'); if (item) loadApp(item.dataset.appPath); });
  ui.editorSections.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-section]');
    if (tab) activateSection(tab.dataset.section);
  });
  ui.editorSections.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...ui.editorSections.querySelectorAll('[data-section]')];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
    activateSection(tabs[next].dataset.section, true);
  });
  ui.createAppBtn.addEventListener('click', openCreateModal);
  ui.welcomeCreateBtn.addEventListener('click', openCreateModal);
  ui.deleteAppBtn.addEventListener('click', deleteCurrentApp);
  ui.saveAppBottomBtn.addEventListener('click', saveCurrentApp);
  ui.updateVersionBtn.addEventListener('click', updateVersionFromAppStore);
  ui.addPayBtn.addEventListener('click', addPay);
  ui.addSwitchBtn.addEventListener('click', addSwitch);
  ui.addOtherBtn.addEventListener('click', addOther);
  ui.enableAllSwitchBtn.addEventListener('click', () => setAllSwitches(true));
  ui.disableAllSwitchBtn.addEventListener('click', () => setAllSwitches(false));
  ui.applyRawConfigBtn.addEventListener('click', applyRawConfig);
  ui.previewBtn.addEventListener('click', previewCurrent);
  ui.testRequestBtn.addEventListener('click', testRequest);
  ui.testRequestPath.addEventListener('click', copyTestRequestUrl);
  ui.copyConnectionKeyBtn.addEventListener('click', copyConnectionKey);
  ui.payList.addEventListener('click', handlePayAction);
  ui.payEditForm.addEventListener('submit', handlePayEditSubmit);
  ui.switchList.addEventListener('click', handleSwitchAction);
  ui.otherList.addEventListener('click', handleOtherAction);
  document.addEventListener('click', handleToggleClick);
  document.addEventListener('input', sanitiseInput);
  ui.formGrid.addEventListener('change', (event) => {
    if (state.validationAttempted && event.target.matches('[data-required-field]')) {
      refreshRequiredFields();
      markDuplicateSwitchKeys();
      updateInvalidTabs();
    }
  });
  ui.connectionForm.addEventListener('submit', handleConnectionSubmit);
  ui.createAppForm.addEventListener('submit', handleCreateApp);
  ui.importConnectionsBtn.addEventListener('click', async () => {
    try { const result = await request(() => window.desktopAPI.importConnections(), '正在导入连接配置…'); if (!result.canceled) { state.connections = result.state.connections; state.activeConnectionId = result.state.activeConnectionId; renderConnectionSelect(); await loadApps({ selectFirst: true }); showToast('配置已导入'); } } catch (error) { showError(ui.connectionError, error); }
  });
  ui.exportConnectionsBtn.addEventListener('click', async () => { try { const result = await request(() => window.desktopAPI.exportConnections(), '正在导出连接配置…'); if (!result.canceled) showToast('配置已导出'); } catch (error) { showError(null, error); } });
  document.addEventListener('click', (event) => { const close = event.target.closest('[data-close-modal]'); if (close) closeModal(document.getElementById(close.dataset.closeModal)); });
  $$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
    if (event.target !== backdrop || !state.connections.length) return;
    closeModal(backdrop);
  }));

  init();
})();
