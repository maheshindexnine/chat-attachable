<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  selectedUser: any
}>()

const emit = defineEmits(['select-user'])

// Mock users and groups data
const chats = ref([
  { id: 1, name: 'John Doe', type: 'user', status: 'online' },
  { id: 2, name: 'Jane Smith', type: 'user', status: 'offline' },
  { id: 3, name: 'Mike Johnson', type: 'user', status: 'online' },
  {
    id: 4,
    name: 'Project Team',
    type: 'group',
    members: [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' },
      { id: 3, name: 'Mike Johnson' },
    ],
  },
  {
    id: 5,
    name: 'Marketing Team',
    type: 'group',
    members: [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' },
    ],
  },
])

const selectChat = (chat: any) => {
  emit('select-user', chat)
}
</script>

<template>
  <div class="user-list">
    <div
      v-for="chat in chats"
      :key="chat.id"
      class="user-item"
      :class="{
        selected: selectedUser?.id === chat.id,
        online: chat.type === 'user' && chat.status === 'online',
      }"
      @click="selectChat(chat)"
    >
      <div class="user-avatar" :class="{ 'group-avatar': chat.type === 'group' }">
        <font-awesome-icon v-if="chat.type === 'group'" icon="users" />
        <template v-else>{{ chat.name[0] }}</template>
      </div>
      <div class="user-info">
        <div class="user-name">{{ chat.name }}</div>
        <div class="user-status">
          <template v-if="chat.type === 'user'">{{ chat.status }}</template>
          <template v-else>{{ chat.members.length }} members</template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-list {
  height: 100%;
  overflow-y: auto;
  padding: 10px;

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
  }

  &.online .user-avatar {
    border: 2px solid #4caf50;
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
}

.user-name {
  font-weight: 500;
}

.user-status {
  font-size: 0.8em;
  color: #666;
}
</style>
