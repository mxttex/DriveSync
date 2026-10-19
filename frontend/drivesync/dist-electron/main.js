import { app as t, BrowserWindow as p } from "electron";
import { fileURLToPath as R } from "node:url";
import o from "node:path";
import { spawn as _ } from "node:child_process";
const u = R(import.meta.url), c = o.dirname(u);
process.env.APP_ROOT = o.join(c, "..");
const l = process.env.VITE_DEV_SERVER_URL, D = o.join(process.env.APP_ROOT, "dist-electron"), m = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = l ? o.join(process.env.APP_ROOT, "public") : m;
let n = null, e = null, a, i;
if (t.isPackaged)
  i = o.join(process.resourcesPath, "daemon"), a = o.join(i, "venv/bin/python");
else {
  const r = o.resolve(c, "../../../");
  i = o.join(r, "daemon"), a = o.join(i, "venv/bin/python");
}
function f() {
  n = new p({
    icon: o.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: o.join(c, "preload.mjs")
    }
  }), n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), l ? n.loadURL(l) : n.loadFile(o.join(m, "index.html"));
}
function v() {
  var r, d;
  e || (e = _(
    a,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    { cwd: i }
  ), (r = e.stdout) == null || r.on("data", (s) => {
    console.log(`[Daemon stdout]: ${s}`);
  }), (d = e.stderr) == null || d.on("data", (s) => {
    console.error(`[Daemon log/err]: ${s}`);
  }), e.on("close", (s) => {
    console.log(`Daemon terminato con codice ${s}`), e = null;
  }));
}
function P() {
  e && (console.log("Arresto del daemon FastAPI..."), e.kill("SIGTERM"), e = null);
}
t.whenReady().then(() => {
  v(), f();
});
t.on("activate", () => {
  p.getAllWindows().length === 0 && f();
});
t.on("window-all-closed", () => {
  process.platform !== "darwin" && (t.quit(), n = null);
});
t.on("will-quit", () => {
  P();
});
export {
  D as MAIN_DIST,
  m as RENDERER_DIST,
  l as VITE_DEV_SERVER_URL
};
