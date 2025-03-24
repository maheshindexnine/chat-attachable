<template>
  <div class="bg-green-100 min-h-screen flex">
    <div class="w-1/6 bg-white">
      <div class="bg-yellow-300 border-r-2 border-yellow-400" style="padding: 5px 0">
        <h2 class="text-xl text-center font-bold" style="font-weight: 600">Mahesh Gaikwad</h2>
        <p class="text-xs text-center text-green-600">( Online )</p>
      </div>
      <UserList @select-user="selectUser" :selected-user="selectedUser" />
    </div>
    <div class="w-5/6">
      <div class="bg-yellow-300 flex justify-between" style="padding: 15px">
        <div class="flex gap-3 items-center">
          <div
            class="user-avatar capitalize"
            :class="{ 'group-avatar': selectedUser?.type === 'group' }"
          >
            <font-awesome-icon v-if="selectedUser?.type === 'group'" icon="users" />
            <template v-else>{{ selectedUser?.username?.[0] }}</template>
          </div>
          <div class="user-info">
            <span class="capitalize">{{ selectedUser?.username }}</span>
          </div>
        </div>
        <div class="flex gap-5 items-center">
          <button
            v-if="selectedUser?.type === 'group' && !false"
            class="group-info-btn"
            @click="toggleGroupMembersModal"
          >
            <font-awesome-icon icon="users" />
          </button>
          <button @click="toggleExpand" class="action-btn">
            <font-awesome-icon icon="compress" />
          </button>
          <button
            @click="
              () => {
                toggleExpand()
                $emit('close')
              }
            "
            class="action-btn"
          >
            <font-awesome-icon icon="xmark" />
          </button>
        </div>
      </div>
      <div>
        <div style="max-height: 85vh; overflow-y: auto">
          <MessageList
            ref="messageListRef"
            :messages="chatStore.messages"
            :current-user="chatStore.user"
            :is-loading="isLoadingMessages"
            @load-more="loadMoreMessages"
          />
        </div>
        <div class="message-input">
          <div class="input-actions">
            <button @click="fileInput?.click()" class="action-btn">
              <font-awesome-icon icon="paperclip" />
            </button>
            <button @click="isRecording ? stopRecording() : startRecording()" class="action-btn">
              <font-awesome-icon :icon="isRecording ? 'stop' : 'video'" />
            </button>
          </div>
          <input
            v-model="newMessage"
            @keyup.enter="sendMessage"
            placeholder="Type your message..."
          />
          <input ref="fileInput" type="file" class="hidden" @change="handleFileUpload" />
          <button @click="sendMessage" class="send-btn">
            <font-awesome-icon icon="paper-plane" />
          </button>
        </div>
      </div>
    </div>
  </div>
  <!-- Group Members Modal -->
  <div v-if="showGroupMembersModal" class="modal-overlay" @click="toggleGroupMembersModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Group Members</h3>
        <button @click="toggleGroupMembersModal" class="close-btn">
          <font-awesome-icon icon="xmark" />
        </button>
      </div>
      <div class="modal-body">
        <div class="member-list">
          <div v-for="member in user?.members" :key="member.id" class="member-item">
            <div class="member-avatar">{{ member?.username[0] }}</div>
            <span>{{ member?.username }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import UserList from './UserList.vue'
import MessageList from './MessageList.vue'
import RecordRTC from 'recordrtc'
import io, { Socket } from 'socket.io-client'
import type { User } from '../stores/chat'
import { useChatStore } from '../stores/chat'

interface LocalUser {
  id: number
  name: string
  type: 'user' | 'group'
  status?: 'online' | 'offline'
  members?: Array<{ id: number; name: string }>
}

interface Message {
  id: number
  sender: string
  type: 'text' | 'image' | 'video' | 'file'
  text?: string
  content?: string
  fileName?: string
}

const props = defineProps<{
  isAi: boolean
  user?: LocalUser
  isFullScreen?: boolean
}>()

const emit = defineEmits(['close', 'toggle-expand'])
const chatStore = useChatStore()

const messages = ref<Message[]>([
  { id: 1, text: 'Hello! How can I help you today?', sender: 'ai', type: 'text' },
])

const newMessage = ref('')
const isRecording = ref(false)
const recorder = ref<RecordRTC | null>(null)
const socket = ref<Socket | null>(null)
const showGroupMembersModal = ref(false)
const selectedUser = ref<LocalUser | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isLoadingMessages = ref(false)
const hasMoreMessages = ref(true)
const messageListRef = ref(null)

// Watch for changes in the user prop
watch(
  () => props.user,
  (newUser) => {
    selectedUser.value = newUser || null
    if (newUser) {
      const chatUser: User = {
        _id: String(newUser.id),
        username: newUser?.username,
      }
      chatStore.setCurrentChat({ ...chatUser, type: 'user', _id: '67de6c9d11a16236da4deb08' })
    }
  },
  { immediate: true },
)

const selectUser = (user: LocalUser) => {
  selectedUser.value = user
  const chatUser: User = {
    _id: String(user?._id),
    username: user?.username,
  }
  chatStore.setCurrentChat({ ...chatUser, type: 'user' })
}

// Socket.io connection
onMounted(async () => {
  // socket.value = io('http://localhost:3000')
  const isInitialized = await chatStore.initialize()
  // socket.value.on('message', (message: Message) => {
  //   messages.value.push(message)
  // })

  handleOnline()
})

const handleOnline = () => {
  console.log('Browser is online')
  chatStore.connectSocket()
  if (chatStore.user) {
  }
}

onUnmounted(() => {
  socket.value?.disconnect()
  stopRecording()
})

const loadMessages = async () => {
  if (!chatStore.currentChat) return

  isLoadingMessages.value = true
  try {
    const messages = await chatStore.fetchMessages({
      chatId: chatStore.currentChat._id,
      chatType: chatStore.currentChat.type,
      skip: 0,
      limit: 20,
    })

    hasMoreMessages.value = messages.length === 20
    messagesPage.value = 1
  } catch (error) {
    console.error('Error loading messages:', error)
  } finally {
    isLoadingMessages.value = false
  }
}

const loadMoreMessages = async () => {
  if (!chatStore.currentChat || !hasMoreMessages.value || isLoadingMessages.value) return

  isLoadingMessages.value = true
  try {
    const messages = await chatStore.fetchMessages({
      chatId: chatStore.currentChat._id,
      chatType: chatStore.currentChat.type,
      skip: messagesPage.value * 20,
      limit: 20,
    })

    hasMoreMessages.value = messages.length === 20
    messagesPage.value++
  } catch (error) {
    console.error('Error loading more messages:', error)
  } finally {
    isLoadingMessages.value = false
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedUser.value) return

  try {
    await chatStore.sendMessage({
      content: newMessage.value,
      receiverId: String(selectedUser.value.id),
    })

    newMessage.value = ''
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length || !selectedUser.value) return

  const file = target.files[0]
  try {
    await chatStore.sendMessage({
      content: '',
      receiverId: String(selectedUser.value.id),
      attachment: file,
    })
  } catch (error) {
    console.error('Error sending file:', error)
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    recorder.value = new RecordRTC(stream, {
      type: 'video',
      mimeType: 'video/webm',
    })

    recorder.value.startRecording()
    isRecording.value = true
  } catch (error) {
    console.error('Error starting recording:', error)
  }
}

const stopRecording = () => {
  if (!recorder.value || !isRecording.value) return

  recorder.value.stopRecording(() => {
    const blob = recorder.value?.getBlob()
    if (!blob) return

    const message: Message = {
      id: Date.now(),
      sender: 'user',
      type: 'video',
      content: URL.createObjectURL(blob),
    }

    messages.value.push(message)
    socket.value?.emit('message', message)

    isRecording.value = false
    recorder.value = null
  })
}

const toggleGroupMembersModal = () => {
  showGroupMembersModal.value = !showGroupMembersModal.value
}

const toggleExpand = () => {
  emit('toggle-expand', false)
}
</script>

<style scoped lang="scss">
.chat-interface {
  position: relative;
  width: 300px;
  height: 400px;
  background-color: var(--secondary-color);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &.expanded {
    position: fixed;
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
    width: calc(100% - 10px) !important;
    height: calc(100% - 10px) !important;
    z-index: 9999;
  }
}

.chat-header {
  padding: 15px;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 500;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-info-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-color);
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-color);
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  .user-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: var(--secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;

    &.group-avatar {
      background-color: #9c27b0;
      color: white;
    }
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1.2em;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }
}

.modal-body {
  padding: 15px;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background-color: #f5f5f5;

  .member-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  max-width: 80%;
  padding: 10px;
  border-radius: 12px;
  word-break: break-word;

  &.user {
    align-self: flex-end;
    background-color: var(--chat-bubble-user);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  &.ai {
    align-self: flex-start;
    background-color: var(--chat-bubble-ai);
  }

  .message-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
  }

  .message-video {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
  }

  .file-message {
    display: flex;
    align-items: center;
    gap: 8px;

    svg {
      font-size: 1.2em;
    }
  }
}

.message-input {
  padding: 15px;
  display: flex;
  gap: 10px;
  background-color: var(--secondary-color);
  border-top: 1px solid #eee;
  align-items: center;
  position: absolute;
  bottom: 0;
  width: 80%;
  border-radius: 20px;
  margin-left: 20px;
  margin-bottom: 20px;

  .input-actions {
    display: flex;
    gap: 8px;
  }

  input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 20px;
    outline: none;

    &:focus {
      border-color: var(--primary-color);
    }
  }

  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background-color: var(--secondary-color);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background-color: #f5f5f5;
    }
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background-color: var(--primary-color);
    color: var(--text-color);
    cursor: pointer;
    transition: transform 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      transform: scale(1.05);
    }
  }
}

.hidden {
  display: none;
}

.resize-handle {
  position: absolute;
  background-color: transparent;
  z-index: 1;

  &.resize-handle-left {
    top: 0;
    left: 0;
    width: 5px;
    height: 100%;
    cursor: w-resize;
  }

  &.resize-handle-right {
    top: 0;
    right: 0;
    width: 5px;
    height: 100%;
    cursor: e-resize;
  }

  &.resize-handle-top {
    top: 0;
    left: 0;
    width: 100%;
    height: 5px;
    cursor: n-resize;
  }

  &.resize-handle-bottom {
    bottom: 0;
    left: 0;
    width: 100%;
    height: 5px;
    cursor: s-resize;
  }
}

.chat-header {
  padding: 15px;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 500;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-info-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-color);
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-color);
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  .user-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: var(--secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;

    &.group-avatar {
      background-color: #9c27b0;
      color: white;
    }
  }
}
</style>
