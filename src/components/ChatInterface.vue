<template>
  <div ref="chatInterface" class="chat-interface" :class="{ expanded: isExpanded }">
    <div class="chat-header">
      <div class="header-left">
        <template v-if="isAi">
          <font-awesome-icon icon="robot" />
          <span>AI Assistant</span>
        </template>
        <template v-else>
          <div
            class="user-avatar capitalize"
            :class="{
              'group-avatar': user?.type === 'group',
              online: user.type === 'user' && user.isOnline,
            }"
          >
            <font-awesome-icon v-if="user?.type === 'group'" icon="users" />
            <template v-else>{{ user?.username?.[0] }}</template>
          </div>
          <div class="user-info capitalize">
            <span>{{ user?.username }}</span
            ><br />
          </div>
        </template>
      </div>
      <div class="header-actions">
        <button
          v-if="user?.type === 'group' && !false"
          class="group-info-btn"
          @click="toggleGroupMembersModal"
        >
          <font-awesome-icon icon="users" />
        </button>
        <button @click="toggleExpand" class="action-btn">
          <font-awesome-icon :icon="isExpanded ? 'compress' : 'expand'" />
        </button>
        <button @click="$emit('close')" class="action-btn">
          <font-awesome-icon icon="xmark" />
        </button>
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
              <div class="member-avatar">{{ member.name[0] }}</div>
              <span>{{ member.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="messages bg-green-100">
      <MessageList
        ref="messageListRef"
        :messages="chatStore.messages"
        :current-user="chatStore.user"
        :is-loading="isLoadingMessages"
        @load-more="loadMoreMessages"
      />
    </div>

    <div class="message-input bg-green-100">
      <div
        v-if="selectedFile"
        class="flex justify-between items-center bg-gray-200"
        style="padding: 10px; margin-bottom: 10px; border-radius: 10px"
      >
        <div class="text-gray-700">Selected file: {{ selectedFile.name }}</div>
        <button @click="clearSelectedFile" class="text-gray-500 hover:text-gray-700">
          <font-awesome-icon icon="xmark" />
        </button>
      </div>
      <div class="flex w-full gap-5">
        <div class="input-actions">
          <button @click="fileInput?.click()" class="action-btn">
            <font-awesome-icon icon="paperclip" />
          </button>
          <button @click="isRecording ? stopRecording() : startRecording()" class="action-btn">
            <font-awesome-icon :icon="isRecording ? 'stop' : 'video'" />
          </button>
        </div>
        <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Type your message..." />
        <input ref="fileInput" type="file" class="hidden" @change="handleFileUpload" />
        <button @click="sendMessage" class="send-btn">
          <font-awesome-icon icon="paper-plane" />
        </button>
      </div>
    </div>

    <!-- Resize handles -->
    <div class="resize-handle resize-handle-left" @mousedown="(e) => startResize(e, 'left')"></div>
    <div
      class="resize-handle resize-handle-right"
      @mousedown="(e) => startResize(e, 'right')"
    ></div>
    <div class="resize-handle resize-handle-top" @mousedown="(e) => startResize(e, 'top')"></div>
    <div
      class="resize-handle resize-handle-bottom"
      @mousedown="(e) => startResize(e, 'bottom')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useElementSize } from '@vueuse/core'
import RecordRTC from 'recordrtc'
import io from 'socket.io-client'
import MessageList from './MessageList.vue'
import { useChatStore } from '../stores/chat'

const props = defineProps<{
  isAi: boolean
  user?: any
  isFullScreen?: boolean
}>()

const emit = defineEmits(['close'])

const messages = ref([
  { id: 1, text: 'Hello! How can I help you today?', sender: 'ai', type: 'text' },
])

const newMessage = ref('')
const isExpanded = ref(false)
const chatInterface = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isRecording = ref(false)
const recorder = ref<RecordRTC | null>(null)
const socket = ref<any>(null)
const showGroupMembersModal = ref(false)
const chatStore = useChatStore()
const isLoadingMessages = ref(false)
const hasMoreMessages = ref(true)
const messageListRef = ref(null)
const selectedFile = ref<File | null>(null)
const isFileSelected = ref(false)

const { width, height } = useElementSize(chatInterface)

// Resize functionality
let isResizing = false
let currentResizer: string | null = null
let originalWidth = 0
let originalHeight = 0
let originalX = 0
let originalY = 0
let originalLeft = 0
let originalTop = 0

const startResize = (e: MouseEvent, resizer: string) => {
  if (!chatInterface.value) return
  e.preventDefault()
  e.stopPropagation()

  isResizing = true
  currentResizer = resizer
  originalWidth = chatInterface.value.offsetWidth
  originalHeight = chatInterface.value.offsetHeight
  originalX = e.pageX
  originalY = e.pageY
  originalLeft = chatInterface.value.offsetLeft
  originalTop = chatInterface.value.offsetTop

  window.addEventListener('mousemove', resize)
  window.addEventListener('mouseup', stopResize)
}

const resize = (e: MouseEvent) => {
  if (!isResizing || !chatInterface.value) return

  const dx = e.pageX - originalX
  const dy = e.pageY - originalY

  if (currentResizer?.includes('left')) {
    const newWidth = originalWidth - dx
    const newLeft = originalLeft + dx
    if (newWidth > 300) {
      chatInterface.value.style.width = `${newWidth}px`
      chatInterface.value.style.left = `${newLeft}px`
    }
  }
  if (currentResizer?.includes('right')) {
    const newWidth = originalWidth + dx
    if (newWidth > 300) {
      chatInterface.value.style.width = `${newWidth}px`
    }
  }
  if (currentResizer?.includes('top')) {
    const newHeight = originalHeight - dy
    const newTop = originalTop + dy
    if (newHeight > 400) {
      chatInterface.value.style.height = `${newHeight}px`
      chatInterface.value.style.top = `${newTop}px`
    }
  }
  if (currentResizer?.includes('bottom')) {
    const newHeight = originalHeight + dy
    if (newHeight > 400) {
      chatInterface.value.style.height = `${newHeight}px`
    }
  }
}

const stopResize = () => {
  isResizing = false
  currentResizer = null
  window.removeEventListener('mousemove', resize)
  window.removeEventListener('mouseup', stopResize)
}

// Socket.io connection
onMounted(async () => {
  const isInitialized = await chatStore.initialize()
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

const sendMessage = async () => {
  if (!newMessage.value.trim() || !props.user) return

  try {
    await chatStore.sendMessage({
      content: newMessage.value,
      receiverId: String(props.user._id),
    })

    newMessage.value = ''
    clearSelectedFile()
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

const toggleExpand = () => {
  isExpanded.value = false
  emit('toggle-expand', true)
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  selectedFile.value = file
  isFileSelected.value = true

  try {
    await chatStore.sendMessage({
      content: '',
      // receiverId: String(selectedUser.value.id),
      receiverId: String('asdasdasd'),
      attachment: file,
    })
    clearSelectedFile()
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

    const message = {
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

const clearSelectedFile = () => {
  selectedFile.value = null
  isFileSelected.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
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

    &.online {
      border: 2px solid #4caf50;
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
  background-color: var(--secondary-color);
  border-top: 1px solid #eee;
  align-items: center;

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
</style>
