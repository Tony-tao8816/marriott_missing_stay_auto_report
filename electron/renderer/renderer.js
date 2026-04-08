const state = {
  processWorkspace: '',
  emailWorkspace: '',
  databasePath: '',
  databaseRows: [],
  activeEditorKey: '',
  generatedMailboxEmail: '',
  mailboxEmailCustomized: false
};

const processForm = document.querySelector('#process-form');
const emailForm = document.querySelector('#email-form');
const marriottForm = document.querySelector('#marriott-form');
const missingStayForm = document.querySelector('#missing-stay-form');
const databaseForm = document.querySelector('#database-form');
const processResult = document.querySelector('#process-result');
const processExtraction = document.querySelector('#process-extraction');
const idUploadStatus = document.querySelector('#id-upload-status');
const idPreviewPanel = document.querySelector('#id-preview-panel');
const idUploadPreview = document.querySelector('#id-upload-preview');
const emailResult = document.querySelector('#email-result');
const marriottResult = document.querySelector('#marriott-result');
const missingStayResult = document.querySelector('#missing-stay-result');
const databaseResult = document.querySelector('#database-result');
const databaseTableBody = document.querySelector('#database-table-body');
const databaseJsonInput = document.querySelector('#database-json-input');
const databaseJsonModal = document.querySelector('#database-json-modal');
const databaseResultModal = document.querySelector('#database-result-modal');
const mailboxPreview = document.querySelector('#mailbox-preview');
const workspaceInput = document.querySelector('#email-workspace-path');
const mailDomainInput = document.querySelector('#mail-domain');
const processSubmitButton = document.querySelector('#process-submit');
const uploadIdButton = document.querySelector('#upload-id-submit');
const emailSubmitButton = document.querySelector('#email-submit');
const marriottSubmitButton = document.querySelector('#marriott-submit');
const missingStaySubmitButton = document.querySelector('#missing-stay-submit');
const databaseSubmitButton = document.querySelector('#database-submit');
const databaseImportSubmitButton = document.querySelector('#database-import-submit');
const openDatabaseJsonModalButton = document.querySelector('#open-database-json-modal');
const closeDatabaseJsonModalButton = document.querySelector('#close-database-json-modal');
const openDatabaseResultModalButton = document.querySelector('#open-database-result-modal');
const closeDatabaseResultModalButton = document.querySelector('#close-database-result-modal');
const editableDatabaseFields = new Set([
  'firstName',
  'lastName',
  'memberNumber',
  'hotel',
  'total',
  'arrivalDate',
  'departureDate',
  'roomNumber',
  'confirmationNumber',
  'mailboxEmail',
  'phone',
  'zipcode',
  'psw'
]);

workspaceInput.addEventListener('input', updateMailboxPreview);
mailDomainInput.addEventListener('input', updateMailboxPreview);
mailboxPreview.addEventListener('input', () => {
  const currentValue = mailboxPreview.value.trim();
  state.mailboxEmailCustomized = currentValue !== '' && currentValue !== state.generatedMailboxEmail;
});

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    switchView(button.dataset.viewTarget);
  });
});

openDatabaseJsonModalButton.addEventListener('click', () => {
  showModal(databaseJsonModal);
  databaseJsonInput.focus();
});

closeDatabaseJsonModalButton.addEventListener('click', () => {
  hideModal(databaseJsonModal);
});

openDatabaseResultModalButton.addEventListener('click', () => {
  showModal(databaseResultModal);
});

closeDatabaseResultModalButton.addEventListener('click', () => {
  hideModal(databaseResultModal);
});

[databaseJsonModal, databaseResultModal].forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      hideModal(modal);
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  hideModal(databaseJsonModal);
  hideModal(databaseResultModal);
});

document.querySelector('#pick-process-pdf').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickPdf();
  if (selectedPath) {
    document.querySelector('#process-pdf-path').value = selectedPath;
  }
});

uploadIdButton.addEventListener('click', async () => {
  if (!state.processWorkspace) {
    return;
  }

  const selectedPath = await window.desktopApi.pickIdentityDocument();
  if (!selectedPath) {
    return;
  }

  idUploadStatus.textContent = '正在上传证件...';
  uploadIdButton.disabled = true;

  try {
    const result = await window.desktopApi.uploadIdentityDocument({
      workspacePath: state.processWorkspace,
      sourceFilePath: selectedPath
    });
    processResult.textContent = JSON.stringify(result, null, 2);
    renderIdentityPreview(result.destinationPath || selectedPath);
  } catch (error) {
    processResult.textContent = formatError(error);
    idUploadStatus.textContent = '上传失败';
    clearIdentityPreview('上传失败');
  } finally {
    uploadIdButton.disabled = !state.processWorkspace;
  }
});

document.querySelector('#pick-process-output-root').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickOutputRoot();
  if (selectedPath) {
    document.querySelector('#process-output-root').value = selectedPath;
  }
});

document.querySelector('#pick-email-workspace').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickWorkspace();
  if (selectedPath) {
    document.querySelector('#email-workspace-path').value = selectedPath;
    document.querySelector('#marriott-workspace-path').value = selectedPath;
    state.emailWorkspace = selectedPath;
    updateMailboxPreview();
  }
});

document.querySelector('#pick-database-path').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickDatabase();
  if (selectedPath) {
    document.querySelector('#database-path').value = selectedPath;
    state.databasePath = selectedPath;
  }
});

document.querySelector('#pick-marriott-workspace').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickWorkspace();
  if (selectedPath) {
    document.querySelector('#marriott-workspace-path').value = selectedPath;
    document.querySelector('#missing-stay-workspace-path').value = selectedPath;
  }
});

document.querySelector('#pick-missing-stay-workspace').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickWorkspace();
  if (selectedPath) {
    document.querySelector('#missing-stay-workspace-path').value = selectedPath;
  }
});

document.querySelector('#open-process-workspace').addEventListener('click', async () => {
  if (state.processWorkspace) {
    await window.desktopApi.openPath(state.processWorkspace);
  }
});

document.querySelector('#open-email-workspace').addEventListener('click', async () => {
  const workspace = state.emailWorkspace || state.processWorkspace;
  if (workspace) {
    await window.desktopApi.openPath(workspace);
  }
});

document.querySelector('#open-marriott-workspace').addEventListener('click', async () => {
  const workspace = document.querySelector('#marriott-workspace-path').value.trim() || state.emailWorkspace || state.processWorkspace;
  if (workspace) {
    await window.desktopApi.openPath(workspace);
  }
});

document.querySelector('#open-missing-stay-workspace').addEventListener('click', async () => {
  const workspace = document.querySelector('#missing-stay-workspace-path').value.trim() || state.emailWorkspace || state.processWorkspace;
  if (workspace) {
    await window.desktopApi.openPath(workspace);
  }
});

document.querySelector('#open-database-path').addEventListener('click', async () => {
  const databasePath = document.querySelector('#database-path').value.trim() || state.databasePath;
  if (databasePath) {
    await window.desktopApi.openPath(databasePath);
  }
});

processForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    pdfPath: document.querySelector('#process-pdf-path').value.trim(),
    outputRoot: document.querySelector('#process-output-root').value.trim()
  };

  processResult.textContent = '正在处理 PDF，请稍候...';
  processExtraction.textContent = '正在读取并整理页面提取 PDF 信息...';
  setLoadingState(processSubmitButton, true, '处理中...');

  try {
    const result = await window.desktopApi.processPdf(payload);
    state.processWorkspace = result.workspaceDirectory || '';
    document.querySelector('#email-workspace-path').value = result.workspaceDirectory || '';
    document.querySelector('#marriott-workspace-path').value = result.workspaceDirectory || '';
    document.querySelector('#missing-stay-workspace-path').value = result.workspaceDirectory || '';
    state.emailWorkspace = result.workspaceDirectory || '';
    updateMailboxPreview();
    updateIdentityUploadState();
    processResult.textContent = JSON.stringify(result, null, 2);
    await updateProcessExtraction(result.workspaceDirectory);
  } catch (error) {
    processResult.textContent = formatError(error);
    processExtraction.textContent = '未能读取提取信息。';
    updateIdentityUploadState();
  } finally {
    setLoadingState(processSubmitButton, false, '开始处理 PDF');
  }
});

emailForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    workspacePath: document.querySelector('#email-workspace-path').value.trim(),
    mailApiBaseUrl: document.querySelector('#mail-api-base-url').value.trim(),
    mailAdminEmail: document.querySelector('#mail-admin-email').value.trim(),
    mailAdminPassword: document.querySelector('#mail-admin-password').value,
    mailboxEmail: mailboxPreview.value.trim(),
    mailDomain: document.querySelector('#mail-domain').value.trim(),
    notifyRecipient: document.querySelector('#notify-recipient').value.trim()
  };

  emailResult.textContent = '正在注册邮箱并发送通知邮件，请稍候...';
  setLoadingState(emailSubmitButton, true, '注册中...');

  try {
    const result = await window.desktopApi.registerEmail(payload);
    state.emailWorkspace = result.workspaceDirectory || payload.workspacePath || '';
    document.querySelector('#marriott-workspace-path').value = state.emailWorkspace;
    document.querySelector('#missing-stay-workspace-path').value = state.emailWorkspace;
    state.databasePath = result?.database?.databasePath || state.databasePath;
    if (state.databasePath) {
      document.querySelector('#database-path').value = state.databasePath;
    }
    emailResult.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    emailResult.textContent = formatError(error);
  } finally {
    setLoadingState(emailSubmitButton, false, '注册邮箱并发送通知');
  }
});

missingStayForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    workspacePath: document.querySelector('#missing-stay-workspace-path').value.trim(),
    databasePath: document.querySelector('#database-path').value.trim() || state.databasePath,
    opencliCommand: document.querySelector('#missing-stay-opencli-command').value.trim() || 'opencli',
    thirdPartyBooking: document.querySelector('#missing-stay-third-party-booking').value.trim() || 'no',
    billCopy: document.querySelector('#missing-stay-bill-copy').value.trim() || 'digital',
    comments: document.querySelector('#missing-stay-comments').value.trim() || 'Please credit this stay',
    incognito: document.querySelector('#missing-stay-incognito').checked
  };

  missingStayResult.textContent = '正在调用 opencli 补登住宿记录，请稍候...';
  setLoadingState(missingStaySubmitButton, true, '提交中...');

  try {
    const result = await window.desktopApi.requestMarriottMissingStay(payload);
    missingStayResult.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    missingStayResult.textContent = formatError(error);
  } finally {
    setLoadingState(missingStaySubmitButton, false, '补登住宿记录');
  }
});

marriottForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    workspacePath: document.querySelector('#marriott-workspace-path').value.trim(),
    databasePath: document.querySelector('#database-path').value.trim() || state.databasePath,
    opencliCommand: document.querySelector('#marriott-opencli-command').value.trim() || 'opencli',
    country: document.querySelector('#marriott-country').value.trim() || 'USA',
    rememberMe: parseBooleanInput(document.querySelector('#marriott-remember-me').value, false),
    marketingEmails: parseBooleanInput(document.querySelector('#marriott-marketing-emails').value, true),
    incognito: document.querySelector('#marriott-incognito').checked
  };

  marriottResult.textContent = '正在调用 opencli 注册万豪会员，请稍候...';
  setLoadingState(marriottSubmitButton, true, '注册中...');

  try {
    const result = await window.desktopApi.registerMarriottAccount(payload);
    marriottResult.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    marriottResult.textContent = formatError(error);
  } finally {
    setLoadingState(marriottSubmitButton, false, '注册万豪会员');
  }
});

databaseForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const databasePath = document.querySelector('#database-path').value.trim();
  setDatabaseFeedback('正在读取数据库，请稍候...');
  setLoadingState(databaseSubmitButton, true, '读取中...');

  try {
    const result = await window.desktopApi.readDatabaseRecords(databasePath);
    state.databasePath = result.databasePath || databasePath;
    document.querySelector('#database-path').value = state.databasePath;
    setDatabaseFeedback(JSON.stringify(result, null, 2));
    renderDatabaseRows(result.rows || []);
  } catch (error) {
    setDatabaseFeedback(formatError(error));
    renderDatabaseRows([]);
  } finally {
    setLoadingState(databaseSubmitButton, false, '刷新数据库数据');
  }
});

databaseImportSubmitButton.addEventListener('click', async () => {
  const databasePath = document.querySelector('#database-path').value.trim() || state.databasePath;
  const sourceText = databaseJsonInput.value.trim();

  if (!sourceText) {
    setDatabaseFeedback('执行失败: 请先粘贴 JSON 内容。');
    return;
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(sourceText);
  } catch (error) {
    setDatabaseFeedback(`执行失败: JSON 格式不正确: ${error.message}`);
    return;
  }

  setDatabaseFeedback('正在导入 JSON 到数据库，请稍候...');
  setLoadingState(databaseImportSubmitButton, true, '导入中...');

  try {
    const result = await window.desktopApi.importDatabaseJson({
      databasePath,
      json: parsedJson
    });
    state.databasePath = result.databasePath || databasePath || state.databasePath;
    document.querySelector('#database-path').value = state.databasePath;
    setDatabaseFeedback(JSON.stringify(result, null, 2));
    hideModal(databaseJsonModal);
    await refreshDatabaseView();
  } catch (error) {
    setDatabaseFeedback(formatError(error));
  } finally {
    setLoadingState(databaseImportSubmitButton, false, '导入 JSON 到数据库');
  }
});

databaseTableBody.addEventListener('dblclick', async (event) => {
  const cell = event.target.closest('td[data-field]');
  const row = event.target.closest('tr[data-workspace-directory]');
  if (!cell || !row) {
    return;
  }

  const field = cell.dataset.field;
  if (!editableDatabaseFields.has(field)) {
    return;
  }

  const workspaceDirectory = row.dataset.workspaceDirectory;
  if (!workspaceDirectory) {
    return;
  }

  startCellEdit(cell, {
    workspaceDirectory,
    field,
    value: cell.dataset.value || ''
  });
});

updateMailboxPreview();
bootstrapDatabasePath();
updateIdentityUploadState();

function formatError(error) {
  if (error && typeof error === 'object' && error.message) {
    return `执行失败: ${error.message}`;
  }

  return `执行失败: ${String(error)}`;
}

function setDatabaseFeedback(text) {
  const message = String(text || '');
  databaseResult.textContent = message;
}

function setLoadingState(button, isLoading, label) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  const labelNode = button.querySelector('.button-label');
  if (labelNode) {
    labelNode.textContent = label;
  }
}

function updateIdentityUploadState() {
  const enabled = Boolean(state.processWorkspace);
  uploadIdButton.disabled = !enabled;

  if (!enabled) {
    idUploadStatus.textContent = '处理完 PDF 后可上传';
    clearIdentityPreview('暂无预览');
  }
}

function renderIdentityPreview(filePath) {
  const fileName = getFileName(filePath);
  idUploadStatus.textContent = fileName || '已上传';
  idPreviewPanel.classList.remove('is-empty');

  if (isPreviewableImage(filePath)) {
    const previewUrl = toFileUrl(filePath);
    idUploadPreview.innerHTML = `<img src="${escapeHtmlAttribute(previewUrl)}" alt="${escapeHtmlAttribute(fileName)}" />`;
    return;
  }

  idUploadPreview.innerHTML = `<div class="id-file-card">${escapeHtml(fileName)}</div>`;
}

function clearIdentityPreview(text) {
  idPreviewPanel.classList.add('is-empty');
  idUploadPreview.textContent = text;
}

function getFileName(filePath) {
  return String(filePath || '').split('/').pop() || '';
}

function isPreviewableImage(filePath) {
  return /\.(png|jpg|jpeg|webp|heic)$/i.test(String(filePath || ''));
}

function toFileUrl(filePath) {
  return `file://${encodeURI(String(filePath || '')).replace(/#/g, '%23')}`;
}

async function updateProcessExtraction(workspacePath) {
  if (!workspacePath) {
    processExtraction.textContent = '未找到工作目录。';
    return;
  }

  const visibleText = await window.desktopApi.readVisibleText(workspacePath);
  if (!visibleText) {
    processExtraction.textContent = '未找到 origin/visible-text.json。';
    return;
  }

  processExtraction.textContent = JSON.stringify(visibleText, null, 2);
}

async function bootstrapDatabasePath() {
  try {
    const databasePath = await window.desktopApi.getDefaultDatabasePath();
    state.databasePath = databasePath || '';
    document.querySelector('#database-path').value = state.databasePath;
  } catch (_error) {
    state.databasePath = '';
  }
}

async function updateMailboxPreview() {
  const workspacePath = workspaceInput.value.trim();
  const domain = normalizeDomain(mailDomainInput.value.trim());

  if (!workspacePath || !domain) {
    state.generatedMailboxEmail = '';
    if (!state.mailboxEmailCustomized) {
      mailboxPreview.value = '';
    }
    return;
  }

  try {
    const json = await window.desktopApi.readExtraction(workspacePath);
    if (!json) {
      state.generatedMailboxEmail = '';
      if (!state.mailboxEmailCustomized) {
        mailboxPreview.value = '';
        mailboxPreview.placeholder = '未找到 origin/extracted.json';
      }
      return;
    }
    const firstName = normalizeMailboxNamePart(json?.summary?.guest?.firstName || '');
    const lastName = normalizeMailboxNamePart(json?.summary?.guest?.lastName || '');
    const localPart = [firstName, lastName].filter(Boolean).join('_') || 'guest_account';
    const generatedMailbox = `${localPart}@${domain}`;
    const shouldReplace = !state.mailboxEmailCustomized || mailboxPreview.value.trim() === '' || mailboxPreview.value.trim() === state.generatedMailboxEmail;
    state.generatedMailboxEmail = generatedMailbox;
    mailboxPreview.placeholder = generatedMailbox;
    if (shouldReplace) {
      mailboxPreview.value = generatedMailbox;
      state.mailboxEmailCustomized = false;
    }
  } catch (_error) {
    state.generatedMailboxEmail = '';
    if (!state.mailboxEmailCustomized) {
      mailboxPreview.value = '';
      mailboxPreview.placeholder = '未找到 origin/extracted.json';
    }
  }
}

function normalizeMailboxNamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9.-]/g, '');
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
}

function parseBooleanInput(value, defaultValue) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return defaultValue;
}

function switchView(viewId) {
  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('is-active', view.id === viewId);
  });

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewTarget === viewId);
  });
}

function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = false;
}

function hideModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = true;
}

function renderDatabaseRows(rows) {
  state.databaseRows = Array.isArray(rows) ? rows : [];

  if (!Array.isArray(rows) || rows.length === 0) {
    databaseTableBody.innerHTML = '<tr><td colspan="14" class="table-empty">暂无数据</td></tr>';
    return;
  }

  databaseTableBody.innerHTML = rows
    .map((row) => `
      <tr data-workspace-directory="${escapeHtml(row.workspaceDirectory)}">
        ${renderDatabaseCell('firstName', row.firstName)}
        ${renderDatabaseCell('lastName', row.lastName)}
        ${renderDatabaseCell('memberNumber', row.memberNumber)}
        ${renderDatabaseCell('hotel', row.hotel)}
        ${renderDatabaseCell('total', row.total)}
        ${renderDatabaseCell('arrivalDate', row.arrivalDate)}
        ${renderDatabaseCell('departureDate', row.departureDate)}
        ${renderDatabaseCell('roomNumber', row.roomNumber)}
        ${renderDatabaseCell('confirmationNumber', row.confirmationNumber)}
        ${renderDatabaseCell('mailboxEmail', row.mailboxEmail)}
        ${renderDatabaseCell('phone', row.phone)}
        ${renderDatabaseCell('zipcode', row.zipcode)}
        ${renderDatabaseCell('psw', row.psw)}
        <td>${escapeHtml(row.updatedAt)}</td>
      </tr>
    `)
    .join('');
}

function renderDatabaseCell(field, value) {
  return `<td class="editable-cell" data-field="${field}" data-value="${escapeHtmlAttribute(value)}" title="双击编辑">${escapeHtml(value)}</td>`;
}

function startCellEdit(cell, { workspaceDirectory, field, value }) {
  const editorKey = `${workspaceDirectory}:${field}`;
  if (state.activeEditorKey && state.activeEditorKey !== editorKey) {
    return;
  }

  if (cell.querySelector('input')) {
    return;
  }

  state.activeEditorKey = editorKey;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'table-cell-input';
  input.value = value;
  input.setAttribute('aria-label', field);

  const originalValue = value;
  cell.classList.add('is-editing');
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  input.select();

  const cleanup = () => {
    state.activeEditorKey = '';
  };

  const cancel = () => {
    cell.classList.remove('is-editing');
    cell.dataset.value = originalValue;
    cell.textContent = originalValue;
    cleanup();
  };

  const save = async () => {
    const nextValue = input.value.trim();
    if (nextValue === originalValue) {
      cancel();
      return;
    }

    cell.classList.remove('is-editing');
    cell.textContent = '保存中...';

    try {
      await window.desktopApi.updateDatabaseRecord({
        databasePath: document.querySelector('#database-path').value.trim() || state.databasePath,
        workspaceDirectory,
        field,
        value: nextValue
      });
      await refreshDatabaseView();
    } catch (error) {
      databaseResult.textContent = formatError(error);
      cell.dataset.value = originalValue;
      cell.textContent = originalValue;
    } finally {
      cleanup();
    }
  };

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  });

  input.addEventListener('blur', async () => {
    if (state.activeEditorKey === editorKey) {
      await save();
    }
  });
}

async function refreshDatabaseView() {
  const result = await window.desktopApi.readDatabaseRecords(
    document.querySelector('#database-path').value.trim() || state.databasePath
  );
  state.databasePath = result.databasePath || state.databasePath;
  document.querySelector('#database-path').value = state.databasePath;
  setDatabaseFeedback(JSON.stringify(result, null, 2));
  renderDatabaseRows(result.rows || []);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
