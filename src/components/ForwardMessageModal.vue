<template>
  <div class="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg" style="padding: 24px">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <label class="text-xl text-gray-800 font-bold" style="margin: 10px 0"
          >Forward Message</label
        >
        <button class="text-gray-500 hover:text-gray-800" @click="$emit('close')">
          <font-awesome-icon icon="times" />
        </button>
      </div>

      <hr />

      <label class="block text-gray-700 font-medium mb-2" style="margin: 10px 0"
        >Forward Message
      </label>
      <div class="bg-gray-200 rounded-xl" style="padding: 10px; margin: 10px 0">
        <h4>{{ message }}</h4>
      </div>

      <!-- User List -->
      <label class="block text-gray-700 font-medium mb-2" style="margin: 10px 0">Forward to</label>
      <div
        class="rounded-lg border border-gray-200 overflow-y-auto"
        style="max-height: 250px; padding: 8px"
      >
        <div style="margin-bottom: 20px">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users..."
            class="w-full rounded-lg border border-gray-300 focus:ring-yellow-400 focus:border-yellow-400"
            style="padding: 5px"
          />
        </div>
        <div
          v-for="user in filteredUsers"
          :key="user._id"
          class="flex items-center justify-between hover:bg-yellow-100 rounded-md cursor-pointer"
          style="padding: 10px 12px; margin-bottom: 6px"
          @click="forwardTo(user?._id, user?.type)"
        >
          <div class="flex items-center">
            <div
              class="text-white flex items-center justify-center rounded-full"
              style="width: 36px; height: 36px; font-weight: 600; margin-right: 10px"
              :style="{ backgroundColor: user?.backgroundColor }"
            >
              {{ user.name.charAt(0).toUpperCase() }}
            </div>
            <div class="text-gray-800 text-sm">
              <div class="capitalize">{{ user.name }}</div>
              <div class="text-xs text-green-500" v-if="user.isOnline">Online</div>
              <div class="text-xs text-red-500" v-else>Offline</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps } from 'vue'
import type { User } from './ChatWindow.vue'

const props = defineProps<{ users: User[]; message: string }>()
const emit = defineEmits(['close', 'forward'])

const groupName = ref('')
const selectedUserIds = ref<number[]>([])
const searchQuery = ref('')

const selectedUsers = computed(() => {
  return props.users?.filter((u) => selectedUserIds.value.includes(u._id))
})

const filteredUsers = computed(() => {
  return props.users?.filter((u) => u.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const forwardTo = (chatId, chatType) => {
  emit('forward', { chatId, chatType })
}
</script>

<style scoped>
/* Tailwind handles most styles */
</style>
