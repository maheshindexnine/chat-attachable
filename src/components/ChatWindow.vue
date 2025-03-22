<script setup lang="ts">
import { ref } from 'vue'
import UserList from './UserList.vue'
import ChatInterface from './ChatInterface.vue'

const activeTab = ref('chats')
const selectedUser = ref(null)
const isOpen = ref(false)
const isExpanded = ref(false)

const toggleChat = () => {
  isOpen.value = !isOpen.value
}

const selectUser = (user: any) => {
  selectedUser.value = user
}

const closeChat = () => {
  selectedUser.value = null
}

const handleExpand = (expanded: boolean) => {
  isExpanded.value = expanded
}
</script>

<template>
  <div class="chat-container" :class="{ expanded: isExpanded }">
    <!-- Chat Toggle Button -->
    <button class="chat-toggle" @click="toggleChat" v-if="!isExpanded">
      <font-awesome-icon icon="comments" size="2x" />
    </button>

    <!-- Main Chat Window -->
    <div class="chat-window" :class="{ 'is-open': isOpen || isExpanded }">
      <div class="tabs" v-if="!isExpanded">
        <button :class="{ active: activeTab === 'chats' }" @click="activeTab = 'chats'">
          <font-awesome-icon icon="users" /> All Chats
        </button>
        <button :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'">
          <font-awesome-icon icon="robot" /> AI Chat
        </button>
      </div>

      <div class="content" :class="{ 'expanded-layout': isExpanded }">
        <div class="sidebar" v-if="isExpanded || (!isExpanded && activeTab === 'chats')">
          <UserList @select-user="selectUser" :selected-user="selectedUser" />
        </div>

        <div class="chat-area" v-if="isExpanded || selectedUser || activeTab === 'ai'">
          <ChatInterface
            v-if="activeTab === 'ai'"
            :is-ai="true"
            @close="closeChat"
            @toggle-expand="handleExpand"
            :is-expanded="isExpanded"
            :is-full-screen="isExpanded"
          />
          <ChatInterface
            v-else-if="selectedUser"
            :user="selectedUser"
            :is-ai="false"
            @close="closeChat"
            @toggle-expand="handleExpand"
            :is-expanded="isExpanded"
            :is-full-screen="isExpanded"
          />
        </div>
      </div>
    </div>

    <!-- User Chat Window (only shown in non-expanded mode) -->
    <Transition name="slide">
      <div v-if="selectedUser && !isExpanded" class="user-chat-window">
        <ChatInterface
          :user="selectedUser"
          :is-ai="false"
          @close="closeChat"
          @toggle-expand="handleExpand"
          :is-expanded="isExpanded"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;

  &.expanded {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    background-color: var(--background-color);
  }
}

.chat-toggle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--primary-color);
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

.chat-window {
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 300px;
  height: 400px;
  background: var(--secondary-color);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: none;
  overflow: hidden;

  &.is-open {
    display: flex;
    flex-direction: column;
  }
}

.chat-container.expanded .chat-window {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  margin: 0;
}

.tabs {
  display: flex;
  background: var(--primary-color);
  padding: 10px;

  button {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: var(--text-color);
    cursor: pointer;
    font-weight: 500;

    &.active {
      background: var(--secondary-color);
      border-radius: 8px;
    }
  }
}

.content {
  flex: 1;
  overflow: hidden;

  &.expanded-layout {
    display: flex;
    height: 100vh;

    .sidebar {
      width: 300px;
      border-right: 1px solid #eee;
      height: 100%;
      background-color: var(--secondary-color);
      overflow-y: auto;
      padding: 0;

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

    .chat-area {
      flex: 1;
      height: 100%;
      display: flex;

      .chat-interface {
        flex: 1;
        margin: 0;
        border-radius: 0;
        box-shadow: none;
      }
    }
  }
}

.user-chat-window {
  position: absolute;
  bottom: 80px;
  right: 320px;
  width: 300px;
  height: 400px;
  background: var(--secondary-color);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
