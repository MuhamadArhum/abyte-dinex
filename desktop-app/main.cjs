const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3008;
let backendProcess = null;
let mainWindow = null;

function projectRoot() {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
}

function backendRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(projectRoot(), 'main-app', 'backend');
}

function waitForBackend(timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`http://127.0.0.1:${PORT}/api/health`, response => {
        response.resume();
        if (response.statusCode < 500) return resolve();
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1500, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error(`Backend did not start on port ${PORT}.`));
      setTimeout(check, 500);
    };
    check();
  });
}

function startBackend() {
  const root = backendRoot();
  const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
  backendProcess = spawn(nodeCommand, ['server.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production', PORT: String(PORT) },
    windowsHide: true,
    stdio: 'pipe',
  });
  backendProcess.stdout.on('data', data => console.log(`[backend] ${data}`));
  backendProcess.stderr.on('data', data => console.error(`[backend] ${data}`));
  backendProcess.on('error', error => console.error('[backend] process error', error));
}

async function createWindow() {
  try {
    // Reuse a backend already running on this machine instead of spawning a
    // second server that would fail with EADDRINUSE on port 3008.
    await waitForBackend(1500);
  } catch (_existingBackendError) {
    startBackend();
    try {
      await waitForBackend();
    } catch (error) {
      dialog.showErrorBox('Abyte Dinex could not start', `${error.message}\n\nMake sure MariaDB is running and backend/.env is configured.`);
      app.quit();
      return;
    }
  }

  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1024,
      minHeight: 680,
      backgroundColor: '#f8fafc',
      autoHideMenuBar: true,
      icon: path.join(projectRoot(), 'abyte-dinex.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.on('closed', () => { mainWindow = null; });
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
});
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
});
