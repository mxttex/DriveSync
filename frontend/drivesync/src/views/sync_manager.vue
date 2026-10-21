<template>
    <div class="app-container">
        <!-- Sidebar / Navigation -->
        <aside class="sidebar">
            <div class="brand">
                <div class="logo-icon">DS</div>
                <h2>DriveSync</h2>
            </div>

            <div class="status-card">
                <span class="status-label">Stato Daemon</span>
                <div class="status-badge" :class="isDaemonReady ? 'online' : 'offline'">
                    <span class="status-dot"></span>
                    {{ isDaemonReady ? 'Connesso' : 'Disconnesso' }}
                </div>
            </div>

            <nav class="nav-menu">
                <button class="nav-item active">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Dashboard
                </button>
            </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="main-content">
            <!-- Top Action Bar -->
            <header class="top-bar">
                <div>
                    <h1>Gestione Sincronizzazione</h1>
                    <p class="subtitle">Confronto tra note locali e Google Drive</p>
                </div>

                <button class="btn-primary" :disabled="!isDaemonReady || isSyncing" @click="startSync">
                    <svg v-if="!isSyncing" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <path
                            d="M21.5 2v6h-6M2.13 15.57a10 10 0 0 0 18.03-3M2.5 22v-6h6M21.87 8.43a10 10 0 0 0-18.03 3" />
                    </svg>
                    <span>{{ isSyncing ? 'Sincronizzazione...' : 'Sincronizza Ora' }}</span>
                </button>
            </header>

            <!-- Grid File Lists -->
            <section class="grid-container">
                <!-- Card File Locali -->
                <div class="card">
                    <div class="card-header">
                        <h3>File Locali</h3>
                        <span class="count-tag">{{ localFiles.length }}</span>
                    </div>
                    <div class="file-list-wrapper">
                        <ul v-if="localFiles.length" class="file-list">
                            <li v-for="file in localFiles" :key="file.path" class="file-item">
                                <LocalCard :file="file" />
                            </li>
                        </ul>
                        <div v-else class="empty-state">Nessun PDF trovato nella cartella locale</div>
                    </div>
                </div>

                <!-- Card File Drive -->
                <div class="card">
                    <div class="card-header">
                        <h3>Google Drive</h3>
                        <span class="count-tag">{{ remoteFiles?.length || 0 }}</span>
                    </div>
                    <div class="file-list-wrapper">
                        <ul v-if="remoteFiles?.length" class="file-list">
                            <li v-for="file in remoteFiles" :key="file.id" class="file-item">
                                <DriveCard :file="file" />
                            </li>
                        </ul>
                        <div v-else class="empty-state">Nessun file presente su Google Drive</div>
                    </div>
                </div>

            </section>

            <!-- Console Logs Panel -->
            <section class="card console-card">
                <div class="card-header">
                    <h3>Log Attività</h3>
                </div>
                <div class="console-wrapper">
                    <div v-if="syncLogs.length" class="console-logs">
                        <div v-for="(log, i) in syncLogs" :key="i" class="log-line">
                            <span class="log-time">></span> {{ log }}
                        </div>
                    </div>
                    <div v-else class="empty-state">In attesa di operazioni...</div>
                </div>
            </section>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DriveCard from '../components/drive_card.vue'
import LocalCard from '../components/local_card.vue'
import { DriveFile } from '../types.ts'
const isDaemonReady = ref(false)
const isSyncing = ref(false)
const localFiles = ref<any[]>([])
const remoteFiles = ref<any[]>([])
const syncLogs = ref<string[]>([])

const BASE_URL = 'http://localhost:8000'

const checkDeamon = async (retries = 10, delay: 500): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(`${BASE_URL}/health`)
            if (res.ok) {
                isDaemonReady.value = true
                return true
            }

        } catch (error) {
            console.log(`Tentativo ${i + 1}/${retries} fallito, attendo ${delay}ms...`)
        }
        await new Promise((resolve) => setTimeout(resolve, delay))
    }

    return false;
}

const startSync = async () => {
    try {
        const res = await fetch(`${BASE_URL}/sync`, { method: 'POST' })
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)
        
        const data = await res.json()
        
        if (data.logs && Array.isArray(data.logs)) {
            syncLogs.value = [...syncLogs.value, ...data.logs]
        }
        
        // Ricarica le liste file aggiornate su UI
        await loadFiles('DRIVE')
        await loadFiles('LOCAL')
    } catch (error) {
        console.error('Errore durante la sincronizzazione:', error)
    }
}

const loadFiles = async (position: string) => {
    try {
        let URL: string = ''
        let dest: any
        if (position == 'DRIVE') {
            URL = `${BASE_URL}/getRemoteFiles`
            dest = remoteFiles
        } else {
            URL = `${BASE_URL}/getLocalFiles`
            dest = localFiles
        }
        await fetch(URL, {
            method: 'GET'
        })
            .then(res => res.json())
            .then(
                res => {
                    dest.value = res.files || []
                });
    } catch (error) {
        console.error(error)
    }
}


onMounted(async () => {
    const isReady = await checkDeamon(10, 500)
    if (isReady) {
        await Promise.all([
            loadFiles('DRIVE'),
            loadFiles('LOCAL')
        ])
        checkDifferences()
    } else {
        console.error('Daemon non disponibile su http://127.0.0.1:8000')
    }
})

const checkDifferences = () => { 
    const remoteMap = new Map<string, DriveFile>(
            remoteFiles.value.map((remote => [remote.name, remote])
    ))

    for(const file of localFiles.value){
        if(!file.name) continue

        const remote = remoteMap.get(file.name)

        if(!remote){
            syncLogs.value.push(`[NUOVO] ${file.name} non è presente in remoto`)
        }
        else if(file.md5 !== remote.md5){
            syncLogs.value.push(`[DA AGGIORNARE] ${file.name} non è aggiornato nella cartella remota`)
        }
        else{
            syncLogs.value.push(`[OK] ${file.name} è già aggiornato`)
        }

    }

}

</script>

<style>
/* CSS Reset & Variables */
:root {
    --bg-dark: #0f172a;
    --bg-card: #1e293b;
    --bg-hover: #334155;
    --border-color: #334155;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --accent-color: #38bdf8;
    --accent-hover: #0284c7;
    --success-color: #4ade80;
    --error-color: #f87171;
    --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    background-color: var(--bg-dark);
    color: var(--text-main);
    font-family: var(--font-family);
    overflow: hidden;
    user-select: none;
}

.app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
}

/* Sidebar */
.sidebar {
    width: 240px;
    background-color: #0b0f19;
    border-right: 1px solid var(--border-color);
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.logo-icon {
    background-color: var(--accent-color);
    color: #000;
    font-weight: 800;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.9rem;
}

.brand h2 {
    font-size: 1.1rem;
    font-weight: 600;
}

.status-card {
    background-color: var(--bg-card);
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.status-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.status-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--text-muted);
}

.status-badge.online {
    color: var(--success-color);
}

.status-badge.online .status-dot {
    background-color: var(--success-color);
}

.status-badge.offline {
    color: var(--error-color);
}

.status-badge.offline .status-dot {
    background-color: var(--error-color);
}

.nav-menu {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
}

.nav-item.active,
.nav-item:hover {
    background-color: var(--bg-card);
    color: var(--text-main);
}

/* Main Content */
.main-content {
    flex: 1;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
}

.top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.top-bar h1 {
    font-size: 1.5rem;
    font-weight: 600;
}

.subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 0.2rem;
}

.btn-primary {
    background-color: var(--accent-color);
    color: #000;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Grid & Cards */
.grid-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}

.card {
    background-color: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.card-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-header h3 {
    font-size: 1rem;
    font-weight: 600;
}

.count-tag {
    background-color: var(--bg-hover);
    color: var(--accent-color);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
}

.file-list-wrapper {
    height: 220px;
    overflow-y: auto;
    padding: 0.5rem;
}

.file-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.file-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.02);
}

.file-item:hover {
    background-color: var(--bg-hover);
}

.file-icon {
    background-color: #ef4444;
    color: white;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
}

.file-icon.drive {
    background-color: #0284c7;
}

.file-info {
    display: flex;
    flex-direction: column;
}

.file-name {
    font-size: 0.85rem;
    font-weight: 500;
}

.file-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.85rem;
    color: var(--text-muted);
}

/* Console Logs */
.console-card {
    flex: 1;
    min-height: 150px;
}

.console-wrapper {
    padding: 0.75rem;
    font-family: monospace;
    font-size: 0.85rem;
    height: 100%;
    overflow-y: auto;
    background-color: #090d16;
}

.console-logs {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.log-line {
    color: var(--text-main);
}

.log-time {
    color: var(--accent-color);
    font-weight: bold;
}
</style>