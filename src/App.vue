<script setup lang="ts">
import ChatWindow from './components/ChatWindow.vue'
import { ref } from 'vue'
import { useChatStore } from './stores/chat'

const username = ref('')
const chatStore = useChatStore()
const loginUser = () => {
  if (username.value !== '') {
    chatStore.login(username.value)
  } else {
    alert('Username field is empty')
  }
}
</script>

<template>
  <div>
    <!-- Tempary code start -->
    <div v-if="!chatStore.user">
      <input type="text" class="border-2" v-model="username" />
      <button @click="loginUser">Login</button>
    </div>
    <div v-else>User Name - {{ chatStore.user.username }}</div>
    <!-- Tempary code end -->

    <ChatWindow />
  </div>
</template>
