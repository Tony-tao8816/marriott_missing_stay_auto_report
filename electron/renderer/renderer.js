const state = {
  processWorkspace: '',
  emailWorkspace: ''
};

const processForm = document.querySelector('#process-form');
const emailForm = document.querySelector('#email-form');
const processResult = document.querySelector('#process-result');
const emailResult = document.querySelector('#email-result');
const mailboxPreview = document.querySelector('#mailbox-preview');
const workspaceInput = document.querySelector('#email-workspace-path');
const mailDomainInput = document.querySelector('#mail-domain');

workspaceInput.addEventListener('input', updateMailboxPreview);
mailDomainInput.addEventListener('input', updateMailboxPreview);

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

processForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    pdfPath: document.querySelector('#process-pdf-path').value.trim(),
    outputRoot: document.querySelector('#process-output-root').value.trim()
  };

  processResult.textContent = '正在处理 PDF，请稍候...';

  try {
    const result = await window.desktopApi.processPdf(payload);
    state.processWorkspace = result.workspaceDirectory || '';
    document.querySelector('#email-workspace-path').value = result.workspaceDirectory || '';
    state.emailWorkspace = result.workspaceDirectory || '';
    updateMailboxPreview();
    processResult.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    processResult.textContent = formatError(error);
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

  try {
    const result = await window.desktopApi.registerEmail(payload);
    state.emailWorkspace = result.workspaceDirectory || payload.workspacePath || '';
    emailResult.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    emailResult.textContent = formatError(error);
  }
});

updateMailboxPreview();

function formatError(error) {
  if (error && typeof error === 'object' && error.message) {
    return `执行失败: ${error.message}`;
  }

  return `执行失败: ${String(error)}`;
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
