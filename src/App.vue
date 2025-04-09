<script setup lang="ts">
import ChatWindow from './components/ChatWindow.vue'
import { ref } from 'vue'
import { useChatStore } from './stores/chat'

const name = ref('')
const chatStore = useChatStore()
const loginUser = () => {
  if (name.value !== '') {
    chatStore.login(name.value)
  } else {
    alert('name field is empty')
  }
}
</script>

<template>
  <div class="">
    <!-- Tempary code start -->
    <!-- <div v-if="!chatStore.user">
      <input type="text" class="border-2" v-model="name" />
      <button @click="loginUser">Login</button>
    </div>
    <div v-else>User Name - {{ chatStore.user.name }}</div> -->
    <!-- Tempary code end -->

    <ChatWindow />
  </div>
</template>
