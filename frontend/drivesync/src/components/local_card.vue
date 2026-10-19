<template>
  <div class="file-icon">pdf</div>
  <div class="file-info">
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
</script>