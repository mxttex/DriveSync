import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
createRequire(import.meta.url);
fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let daemonProcess = null;
const projectRoot = path.join(__dirname$1, "../..");
const pythonExec = path.join(projectRoot, "daemon/venv/bin/python");
const daemonDir = path.join(projectRoot, "daemon");
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
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
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  startDaemon();
  createWindow();
});
app.on("will-quit", () => {
  stopDaemon();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
