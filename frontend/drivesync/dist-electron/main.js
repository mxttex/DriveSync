import { app as s, BrowserWindow as p, ipcMain as _ } from "electron";
import { fileURLToPath as f } from "node:url";
import o from "node:path";
import { exec as v, spawn as R } from "node:child_process";
const E = f(import.meta.url), d = o.dirname(E);
process.env.APP_ROOT = o.join(d, "..");
const a = process.env.VITE_DEV_SERVER_URL, I = o.join(process.env.APP_ROOT, "dist-electron"), m = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = a ? o.join(process.env.APP_ROOT, "public") : m;
let n = null, e = null, c, i;
if (s.isPackaged)
  i = o.join(process.resourcesPath, "daemon"), c = o.join(i, "venv/bin/python");
else {
  const r = o.resolve(d, "../../../");
  i = o.join(r, "daemon"), c = o.join(i, "venv/bin/python");
}
function u() {
  n = new p({
    icon: o.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: o.join(d, "preload.mjs")
    }
  }), n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), a ? n.loadURL(a) : n.loadFile(o.join(m, "index.html"));
}
function P() {
  var r, l;
  e || (e = R(
    c,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    { cwd: i }
  ), (r = e.stdout) == null || r.on("data", (t) => {
    console.log(`[Daemon stdout]: ${t}`);
  }), (l = e.stderr) == null || l.on("data", (t) => {
    console.error(`[Daemon log/err]: ${t}`);
  }), e.on("close", (t) => {
    console.log(`Daemon terminato con codice ${t}`), e = null;
  }));
}
function w() {
  e && (console.log("Arresto del daemon FastAPI..."), e.kill("SIGTERM"), e = null);
}
s.whenReady().then(() => {
  P(), u();
});
s.on("activate", () => {
  p.getAllWindows().length === 0 && u();
});
s.on("window-all-closed", () => {
  process.platform !== "darwin" && (s.quit(), n = null);
});
s.on("will-quit", () => {
  w();
});
_.handle("open-in-vscode", async (r, l) => {
  v(`code ${l}`, (t) => {
    console.error("Errore durante l'apertura di VsCode: ", t);
  });
});
export {
  I as MAIN_DIST,
  m as RENDERER_DIST,
  a as VITE_DEV_SERVER_URL
};
