<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { onMounted } from 'vue'

interface User {
  _id: string
  username: string
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
    return chat.username.toLowerCase().includes(query)
  })
})

const selectChat = (chat: User) => {
  emit('select-user', chat)
}

const getUnreadCount = (chatId: string, isGroup: string) => {
  return chatStore.getUnreadCount(chatId, isGroup)
}

onMounted(async () => {
  await chatStore.fetchUsers()
})
</script>

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
    <div class="users-container">
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
          class="user-avatar capitalize"
          :class="{
            'group-avatar': chat?.type === 'group',
            online: chat.type === 'user' && chat.isOnline,
          }"
        >
          <font-awesome-icon v-if="chat?.type === 'group'" icon="users" />
          <template v-else>{{ chat.username[0] }}</template>
          <template>{{ chat?.username[0] }}</template>
        </div>
        <div class="user-info">
          <div class="user-name capitalize">{{ chat.username }}</div>
          <div class="user-status">
            <template v-if="chat?.type === 'user'">{{ chat.status }}</template>
            <!-- <template v-else>{{ chat.members?.length || 0 }} members</template> -->
          </div>
        </div>
        <div
          v-if="getUnreadCount(chat._id, false) > 0"
          class="text-xs bg-green-400 rounded-full"
          style="padding: 5px"
        >
          {{ getUnreadCount(chat._id, false) }}
        </div>
      </div>
    </div>
  </div>
</template>

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
