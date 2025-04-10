<template>
  <div class="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg" style="padding: 24px">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <label class="text-xl text-gray-800 font-bold" style="margin: 10px 0">Create Group</label>
        <button class="text-gray-500 hover:text-gray-800" @click="$emit('close')">
          <font-awesome-icon icon="times" />
        </button>
      </div>

      <hr />
      <!-- Group Name Input -->
      <div style="margin-bottom: 20px">
        <label class="block text-gray-700 font-medium mb-2" style="margin: 10px 0"
          >Group Name</label
        >
        <input
          v-model="groupName"
          type="text"
          placeholder="Enter group name"
          class="w-full rounded-lg border border-gray-300 focus:ring-yellow-400 focus:border-yellow-400"
          style="padding: 5px"
        />
      </div>

      <!-- Selected Users -->
      <label class="block text-gray-700 font-medium mb-2" style="margin: 10px 0"
        >Selected Members</label
      >
      <h5 v-if="!selectedUsers.length" class="text-gray-500 font-semibold">No Memebers Selected</h5>
      <div
        v-if="selectedUsers.length"
        class="flex items-center flex-wrap border-1 border-gray-300"
        style="padding: 10px"
      >
        <div
          v-for="user in selectedUsers"
          :key="user._id"
          class="flex items-center justify-center gap-3 bg-yellow-400 text-white rounded-full"
          style="width: 36px; height: 36px; font-weight: 600; margin-right: 5px"
          :title="user.name"
        >
          {{ user.name.charAt(0).toUpperCase() }}
        </div>
      </div>

      <!-- User List -->
      <label class="block text-gray-700 font-medium mb-2" style="margin: 10px 0"
        >Select Members</label
      >
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
          class="flex items-center justify-between hover:bg-yellow-100 rounded-md"
          style="padding: 10px 12px; margin-bottom: 6px"
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
              <div class="text-xs text-gray-500" v-if="user.isOnline">Online</div>
              <div class="text-xs text-gray-500" v-else>Online</div>
            </div>
          </div>
          <input
            type="checkbox"
            v-model="selectedUserIds"
            :value="user._id"
            class="form-checkbox text-yellow-500"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end mt-6" style="margin-top: 10px">
        <button
          @click="$emit('close')"
          class="mr-4 text-gray-700 hover:text-gray-900"
          style="padding: 8px 16px"
        >
          Cancel
        </button>
        <button
          :disabled="!groupName || !selectedUsers.length"
          class="bg-yellow-400 text-white font-medium rounded-lg shadow-md hover:shadow-lg disabled:opacity-50"
          style="padding: 8px 16px"
          @click="createGroup"
        >
          Create Group
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps } from 'vue'
import type { User } from './ChatWindow.vue'

const props = defineProps<{ users: User[] }>()
const emit = defineEmits(['close', 'create'])

const groupName = ref('')
const selectedUserIds = ref<number[]>([])
const searchQuery = ref('')

const selectedUsers = computed(() => {
  return props.users.filter((u) => selectedUserIds.value.includes(u._id))
})

const filteredUsers = computed(() => {
  return props.users.filter(
    (u) => u.type === 'user' && u.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

const createGroup = () => {
  const group = {
    name: groupName.value,
    members: selectedUserIds.value,
  }
  emit('create', group)
  emit('close')
}
</script>

<style scoped>
/* Tailwind handles most styles */
</style>
