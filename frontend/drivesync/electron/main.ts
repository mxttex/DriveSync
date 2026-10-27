import { app, BrowserWindow, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ChildProcess, exec, spawn } from 'node:child_process'

// const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null
let daemonProcess: ChildProcess | null = null

let pythonExec: string
let daemonDir: string

if (app.isPackaged) {
  daemonDir = path.join(process.resourcesPath, 'daemon')
  pythonExec = path.join(daemonDir, 'venv/bin/python')
} else {
  const projectRoot = path.resolve(__dirname, '../../../')
  daemonDir = path.join(projectRoot, 'daemon')
  pythonExec = path.join(daemonDir, 'venv/bin/python')
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.setMenu(null)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function startDaemon() {
  if (daemonProcess) return

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

// Lifecycle Events
app.whenReady().then(() => {
  startDaemon()
  createWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('will-quit', () => {
  stopDaemon()
})

ipcMain.handle(('open-in-vscode'), async (_event, filePath: string) => {
  exec(`code ${filePath}`, error => {
    console.error('Errore durante l\'apertura di VsCode: ', error)
  })
})