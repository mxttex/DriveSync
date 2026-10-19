<script setup lang="ts">
interface DriveFile {
  id?: string
  name?: string
  md5?: string
}

const props = withDefaults(defineProps<{
  file?: DriveFile
}>(), {
  file: () => ({ name: 'Senza nome', id: '', md5: '' })
})
</script>

<template>
  <div class="file-item">
    <div class="file-icon drive">cloud</div>
    <div class="file-info">
      <!-- Uso dell'optional chaining e fallback per il nome -->
      <span class="file-name">{{ props.file?.name || 'File sconosciuto' }}</span>
      
      <!-- Controllo sicuro su md5 prima di fare substring -->
      <span class="file-meta">
        MD5: {{ props.file?.md5 ? props.file.md5.substring(0, 8) + '...' : 'N/D' }}
      </span>
    </div>
  </div>
</template>