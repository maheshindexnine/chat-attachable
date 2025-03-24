<script setup lang="ts">
import { onMounted } from 'vue'
import ChatWindow from './components/ChatWindow.vue'

onMounted(() => {
  localStorage.setItem(
    'user',
    JSON.stringify({
      username: 'sahil',
      isOnline: true,
      lastSeen: null,
      _id: '67de6caa11a16236da4deb0d',
      createdAt: '2025-03-22T13:49:31.173Z',
      updatedAt: '2025-03-22T13:49:31.173Z',
      __v: 0,
    }),
  )
})
</script>

<template>
  <div>
    <ChatWindow />
  </div>
</template>
