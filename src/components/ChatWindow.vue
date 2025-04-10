<template>
  <div v-if="isExpanded">
    <ExtendedChatWindow
      :user="selectedUser"
      :is-ai="false"
      @close="closeChat"
      @toggle-expand="handleExpand"
      :is-expanded="isExpanded"
    />
  </div>
  <div v-if="!isExpanded" class="chat-container" :class="{ expanded: false }">
    <!-- Chat Toggle Button -->
    <button class="chat-toggle" @click="toggleChat" v-if="!false">
      <font-awesome-icon icon="comments" size="2x" />
    </button>

    <!-- Main Chat Window -->
    <div class="chat-window" :class="{ 'is-open': isOpen || false }">
      <div class="tabs" v-if="!false">
        <button :class="{ active: activeTab === 'chats' }" @click="activeTab = 'chats'">
          <font-awesome-icon icon="users" /> All Chats
        </button>
        <button :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'">
          <font-awesome-icon icon="robot" /> AI Chat
        </button>

        <!-- Dropdown Section -->
        <div ref="dropdownRef" class="relative ml-auto">
          <div
            class="flex justify-center items-center cursor-pointer"
            @click="toggleDropdown"
            style="padding: 8px; margin: 4px"
          >
            <font-awesome-icon icon="ellipsis-vertical" />
          </div>

          <div
            v-if="isMenuOpen"
            class="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg z-50"
            style="padding: 8px"
          >
            <div class="py-1">
              <a
                href="#"
                @click.prevent="onCreateGroup"
                class="block text-sm text-gray-800 rounded-md"
                style="padding: 10px 16px; margin-bottom: 6px"
                @mouseover="hovered = 'group'"
                @mouseleave="hovered = ''"
                :style="
                  hovered === 'group'
                    ? 'background-color: #facc15; box-shadow: 0 2px 8px rgba(0,0,0,0.15);'
                    : ''
                "
              >
                ➕ Create Group
              </a>
              <a
                href="#"
                @click.prevent="onUserStatus"
                class="block text-sm text-gray-800 rounded-md"
                style="padding: 10px 16px"
                @mouseover="hovered = 'status'"
                @mouseleave="hovered = ''"
                :style="
                  hovered === 'status'
                    ? 'background-color: #facc15; box-shadow: 0 2px 8px rgba(0,0,0,0.15);'
                    : ''
                "
              >
                👤 User Status
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="content" :class="{ 'expanded-layout': false }">
        <div class="sidebar">
          <UserList @select-user="selectUser" :selected-user="selectedUser" />
        </div>

        <div class="chat-area" v-if="activeTab === 'ai'">
          <ChatInterface
            :is-ai="true"
            @close="closeChat"
            @toggle-expand="handleExpand"
            :is-expanded="false"
            :is-full-screen="false"
          />
        </div>
      </div>
    </div>

    <!-- User Chat Window -->
    <Transition name="slide">
      <div v-if="selectedUser" class="user-chat-window">
        <ChatInterface
          :user="selectedUser"
          :is-ai="false"
          @close="closeChat"
          @toggle-expand="handleExpand"
          :is-expanded="false"
        />
      </div>
    </Transition>
    <div v-if="showCreateGroupModal">
      <CreateGroupModal
        :users="chatStore.users"
        @create="createGroup"
        @close="
          () => {
            showCreateGroupModal = false
          }
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import UserList from './UserList.vue'
import ChatInterface from './ChatInterface.vue'
import ExtendedChatWindow from './ExtendedChatWindow.vue'
import { useChatStore } from '@/stores/chat'
import CreateGroupModal from './CreateGroupModal.vue'

export interface User {
  id: number
  name: string
  type: 'user' | 'group'
  status?: 'online' | 'offline'
  members?: Array<{ id: number; name: string }>
}

const activeTab = ref('chats')
const selectedUser = ref<User | null>(null)
const isOpen = ref(false)
const isExpanded = ref(false)
const chatStore = useChatStore()
const isMenuOpen = ref(false)
const hovered = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const showCreateGroupModal = ref<boolean>(false)

const toggleChat = () => {
  isOpen.value = !isOpen.value
}

const selectUser = (user: User) => {
  selectedUser.value = user
  chatStore.setCurrentChat(user)
}

const closeChat = () => {
  sessionStorage.removeItem('currentChat')
  chatStore.resetCurrentChat()
  selectedUser.value = null
}

const handleOnline = () => {
  console.log('Browser is online')
  chatStore.connectSocket()
}

const handleExpand = (expanded: boolean) => {
  isExpanded.value = expanded
}

const toggleDropdown = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeDropdown = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isMenuOpen.value = false
  }
}

const onCreateGroup = () => {
  isMenuOpen.value = false
  showCreateGroupModal.value = true
  console.log('Create Group clicked')
}

const onUserStatus = () => {
  isMenuOpen.value = false
  console.log('User Status clicked')
}

const createGroup = (data: any) => {
  console.log(data, ' called creat group')
}

onMounted(async () => {
  document.addEventListener('click', closeDropdown)
  const isInitialized = await chatStore.initialize()
  handleOnline()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<style scoped lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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
  display: flex;
  flex-direction: column;

  &.expanded-layout {
    display: flex;
    flex-direction: row;
    height: 100%;

    .sidebar {
      width: 300px;
      border-right: 1px solid #eee;
      height: 100%;
      background-color: var(--secondary-color);
      overflow: hidden;
      flex-shrink: 0;
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

  .sidebar {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: var(--secondary-color);
  }

  .chat-area {
    flex: 1;
    display: flex;
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
  z-index: 1000;
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
