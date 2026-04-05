const state = {
  processWorkspace: '',
  emailWorkspace: '',
  databasePath: '',
  databaseRows: [],
  activeEditorKey: ''
};

const processForm = document.querySelector('#process-form');
const emailForm = document.querySelector('#email-form');
const databaseForm = document.querySelector('#database-form');
const processResult = document.querySelector('#process-result');
const processExtraction = document.querySelector('#process-extraction');
const emailResult = document.querySelector('#email-result');
const databaseResult = document.querySelector('#database-result');
const databaseTableBody = document.querySelector('#database-table-body');
const mailboxPreview = document.querySelector('#mailbox-preview');
const workspaceInput = document.querySelector('#email-workspace-path');
const mailDomainInput = document.querySelector('#mail-domain');
const processSubmitButton = document.querySelector('#process-submit');
const emailSubmitButton = document.querySelector('#email-submit');
const databaseSubmitButton = document.querySelector('#database-submit');
const editableDatabaseFields = new Set([
  'firstName',
  'lastName',
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

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    switchView(button.dataset.viewTarget);
  });
});

document.querySelector('#pick-process-pdf').addEventListener('click', async () => {
  const selectedPath = await window.desktopApi.pickPdf();
  if (selectedPath) {
    document.querySelector('#process-pdf-path').value = selectedPath;
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
    state.emailWorkspace = result.workspaceDirectory || '';
    updateMailboxPreview();
    processResult.textContent = JSON.stringify(result, null, 2);
    await updateProcessExtraction(result.workspaceDirectory);
  } catch (error) {
    processResult.textContent = formatError(error);
    processExtraction.textContent = '未能读取提取信息。';
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
    mailDomain: document.querySelector('#mail-domain').value.trim(),
    notifyRecipient: document.querySelector('#notify-recipient').value.trim()
  };

  emailResult.textContent = '正在注册邮箱并发送通知邮件，请稍候...';
  setLoadingState(emailSubmitButton, true, '注册中...');

  try {
    const result = await window.desktopApi.registerEmail(payload);
    state.emailWorkspace = result.workspaceDirectory || payload.workspacePath || '';
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

databaseForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const databasePath = document.querySelector('#database-path').value.trim();
  databaseResult.textContent = '正在读取数据库，请稍候...';
  setLoadingState(databaseSubmitButton, true, '读取中...');

  try {
    const result = await window.desktopApi.readDatabaseRecords(databasePath);
    state.databasePath = result.databasePath || databasePath;
    document.querySelector('#database-path').value = state.databasePath;
    databaseResult.textContent = JSON.stringify(result, null, 2);
    renderDatabaseRows(result.rows || []);
  } catch (error) {
    databaseResult.textContent = formatError(error);
    renderDatabaseRows([]);
  } finally {
    setLoadingState(databaseSubmitButton, false, '刷新数据库数据');
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

function formatError(error) {
  if (error && typeof error === 'object' && error.message) {
    return `执行失败: ${error.message}`;
  }

  return `执行失败: ${String(error)}`;
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
    mailboxPreview.textContent = '未生成';
    return;
  }

  try {
    const json = await window.desktopApi.readExtraction(workspacePath);
    if (!json) {
      mailboxPreview.textContent = '未找到 origin/extracted.json';
      return;
    }
    const firstName = normalizeMailboxNamePart(json?.summary?.guest?.firstName || '');
    const lastName = normalizeMailboxNamePart(json?.summary?.guest?.lastName || '');
    const localPart = [firstName, lastName].filter(Boolean).join('_') || 'guest_account';
    mailboxPreview.textContent = `${localPart}@${domain}`;
  } catch (_error) {
    mailboxPreview.textContent = '未找到 origin/extracted.json';
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

function switchView(viewId) {
  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('is-active', view.id === viewId);
  });

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewTarget === viewId);
  });
}

function renderDatabaseRows(rows) {
  state.databaseRows = Array.isArray(rows) ? rows : [];

  if (!Array.isArray(rows) || rows.length === 0) {
    databaseTableBody.innerHTML = '<tr><td colspan="13" class="table-empty">暂无数据</td></tr>';
    return;
  }

  databaseTableBody.innerHTML = rows
    .map((row) => `
      <tr data-workspace-directory="${escapeHtml(row.workspaceDirectory)}">
        ${renderDatabaseCell('firstName', row.firstName)}
        ${renderDatabaseCell('lastName', row.lastName)}
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
  databaseResult.textContent = JSON.stringify(result, null, 2);
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
