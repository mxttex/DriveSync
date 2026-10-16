import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ChildProcess, spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
let win: BrowserWindow | null
let daemonProcess: ChildProcess | null = null

const projectRoot = path.join(__dirname, '../..')
const pythonExec = path.join(projectRoot, 'daemon/venv/bin/python')
const daemonDir = path.join(projectRoot, 'daemon')


function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function startDaemon(){
  if(daemonProcess) return

  daemonProcess = spawn(
    pythonExec,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    { cwd: daemonDir }
  )

  daemonProcess.stdout?.on('data', (data) => {
    console.log(`[Daemon stdout]: ${data}`)
  })

  daemonProcess.stderr?.on('data', (data) => {
    console.error(`[Daemon log/err]: ${data}`)
  })

  daemonProcess.on('close', (code) => {
    console.log(`Daemon terminato con codice ${code}`)
    daemonProcess = null
  })
}

function stopDaemon() {
  if (daemonProcess) {
    console.log('Arresto del daemon FastAPI...')
    daemonProcess.kill('SIGTERM')
    daemonProcess = null
  }

}
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  startDaemon()
  createWindow()
})

app.on('will-quit', () => {
  stopDaemon()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
