<template>
  <div class="user-list">
    <div class="search-container">
      <div class="search-input-wrapper">
        <font-awesome-icon icon="search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search users and groups..."
          class="search-input"
        />
      </div>
    </div>
    <div v-if="chatStore.isFetchingUsers" class="flex justify-center items-center h-screen">
      <div>
        <div
          style="margin-left: 40%; margin-bottom: 10px"
          class="w-10 h-10 rounded-full flex items-center justify-center animate-spin"
        >
          <div class="w-10 h-10 rounded-full border-2 border-yellow-300 border-dashed"></div>
        </div>
        <span class="text-gray-600">Fetching users and groups...</span>
      </div>
    </div>
    <h4
      v-if="(!filteredChats || filteredChats?.length === 0) && !chatStore.isFetchingUsers"
      class="flex justify-center items-center h-screen text-gray-400 font-semibold"
    >
      No users or groups found.
    </h4>
    <div
      class="users-container"
      v-if="filteredChats.length && !chatStore.isFetchingUsers"
      ref="usersContainer"
    >
      <div
        v-for="chat in filteredChats"
        :key="chat._id"
        class="user-item"
        :class="{
          selected: selectedUser?._id === chat._id,
          online: chat?.isOnline,
        }"
        @click="selectChat(chat)"
      >
        <div
          :style="{ backgroundColor: chat?.backgroundColor }"
          class="user-avatar capitalize"
          :class="{
            'group-avatar': chat?.type === 'group',
            online: chat.type === 'user' && chat.isOnline,
          }"
        >
          <font-awesome-icon v-if="chat?.type === 'group'" icon="users" />
          <template v-else>{{ chat?.name?.charAt(0) }}</template>
          <template>{{ chat?.name?.charAt(0) }}</template>
        </div>
        <div class="user-info">
          <div class="user-name capitalize">{{ chat.name }}</div>
          <div class="user-status">
            <template v-if="chat?.type === 'user'">{{ chat.status }}</template>
            <!-- <template v-else>{{ chat.members?.length || 0 }} members</template> -->
          </div>
        </div>
        <div
          v-if="getUnreadCount(chat._id, false) > 0"
          class="text-xs rounded-full bg-green-400 w-7 flex justify-center text-white font-bold"
          style="padding: 5px"
        >
          {{ getUnreadCount(chat._id, false) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { onMounted } from 'vue'
import { watch } from 'vue'
import { onUnmounted } from 'vue'

interface User {
  _id: string
  name: string
  isOnline?: boolean
  lastSeen?: string | null
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{
  selectedUser: User | null
}>()

const emit = defineEmits(['select-user'])

const chatStore = useChatStore()
const searchQuery = ref('')

const filteredChats = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return chatStore.users

  return chatStore.users.filter((chat) => {
    return chat.name.toLowerCase().includes(query)
  })
})

const selectChat = (chat: User) => {
  emit('select-user', chat)
}

const getUnreadCount = (chatId: string, isGroup: string) => {
  return chatStore.getUnreadCount(chatId, isGroup)
}

const page = ref(1)
const usersContainer = ref<HTMLElement | null>(null)

const handleScroll = () => {
  if (!usersContainer.value || chatStore.isFetchingUsers) return

  const el = usersContainer.value
  const scrollPosition = el.scrollTop + el.clientHeight
  const scrollHeight = el.scrollHeight

  // If scrolled past 80%
  if (scrollPosition >= scrollHeight * 0.8) {
    page.value += 1
    chatStore.fetchUsers(page.value)
  }
}

onMounted(async () => {
  await chatStore.fetchUsers()

  if (usersContainer.value) {
    usersContainer.value.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  if (usersContainer.value) {
    usersContainer.value.removeEventListener('scroll', handleScroll)
  }
})
</script>

<style scoped lang="scss">
.user-list {
  height: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0; /* Crucial for Firefox */
}

.search-container {
  padding: 10px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0; /* Prevent search container from shrinking */
  background-color: var(--secondary-color); /* Ensure consistent background */
  position: relative; /* For shadow */
  z-index: 1; /* Keep shadow above scrolling content */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); /* Subtle shadow for depth */
}

.search-input-wrapper {
  position: relative;

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
    font-size: 14px;
  }
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 35px;
  border: 1px solid #ddd;
  border-radius: 20px;
  outline: none;
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary-color);
  }

  &::placeholder {
    color: #999;
  }
}

.users-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
  min-height: 0; /* Crucial for Firefox */
  position: relative;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
}

.user-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f5f5;
  }

  &.selected {
    background-color: var(--primary-color);

    .user-name,
    .user-status {
      color: white;
    }
  }

  &.online .user-avatar {
    border: 2px solid #4caf50;
  }

  &:last-child {
    margin-bottom: 0; /* Remove margin from last item */
  }
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-weight: bold;

  &.group-avatar {
    background-color: #9c27b0;
    color: white;
  }
}

.user-info {
  flex: 1;
  min-width: 0; /* Prevent text overflow issues */
}

.user-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  font-size: 0.8em;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
