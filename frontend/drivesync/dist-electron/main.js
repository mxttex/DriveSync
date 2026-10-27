import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, spawn } from "node:child_process";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let daemonProcess = null;
let pythonExec;
let daemonDir;
if (app.isPackaged) {
  daemonDir = path.join(process.resourcesPath, "daemon");
  pythonExec = path.join(daemonDir, "venv/bin/python");
} else {
  const projectRoot = path.resolve(__dirname$1, "../../../");
  daemonDir = path.join(projectRoot, "daemon");
  pythonExec = path.join(daemonDir, "venv/bin/python");
}
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.setMenu(null);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
function startDaemon() {
  var _a, _b;
  if (daemonProcess) return;
  daemonProcess = spawn(
    pythonExec,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    { cwd: daemonDir }
  );
  (_a = daemonProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log(`[Daemon stdout]: ${data}`);
  });
  (_b = daemonProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error(`[Daemon log/err]: ${data}`);
  });
  daemonProcess.on("close", (code) => {
    console.log(`Daemon terminato con codice ${code}`);
    daemonProcess = null;
  });
}
function stopDaemon() {
  if (daemonProcess) {
    console.log("Arresto del daemon FastAPI...");
    daemonProcess.kill("SIGTERM");
    daemonProcess = null;
  }
}
app.whenReady().then(() => {
  startDaemon();
  createWindow();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("will-quit", () => {
  stopDaemon();
});
ipcMain.handle("open-in-vscode", async (_event, filePath) => {
  exec(`code ${filePath}`, (error) => {
    console.error("Errore durante l'apertura di VsCode: ", error);
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
