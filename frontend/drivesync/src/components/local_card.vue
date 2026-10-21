<template>
  <div class="file-icon">pdf</div>
  <div class="file-info" @click="handleclickCard">
    <span class="file-name">{{ file?.name || 'Senza nome' }}</span>
    <span class="file-meta">{{ props.file?.size || 'N/D' }}</span>
  </div>
</template>

<script setup lang="ts">
import { LocalFile } from '../types';
const props = withDefaults(defineProps<{
  file?: LocalFile
}>(), {
  file: () => ({ name: 'Senza nome', id: '', size: '' })
})

const handleclickCard = async () => {
  if(props.file.path){
    const lastSlashIndex = props.file.path.lastIndexOf('/')
    const folderPath = lastSlashIndex !== -1 
      ? props.file.path.substring(0, lastSlashIndex) 
      : props.file.path
    window.electronAPI?.openInVSCode(folderPath)
  }
}

</script>