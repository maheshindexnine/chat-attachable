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
            <template v-else>{{ user?.name?.[0] }}</template>
          </div>
          <div class="user-info capitalize">
            <span>{{ user?.name }}</span
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
              <div class="member-avatar capitalize">{{ member.name[0] }}</div>
              <span class="capitalize font-semibold">{{ member.name }}</span>
            </div>
          </div>
        </div>
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
        <span class="text-gray-600">Fetching messages...</span>
      </div>
    </div>
    <h5
      class="flex justify-center items-center h-screen text-gray-400 font-semibold"
      v-if="!chatStore.isFetchingUsers && chatStore.messages.length === 0"
    >
      No Messages Found
    </h5>
    <div class="messages" v-if="!chatStore.isFetchingUsers && chatStore.messages">
      <MessageList
        ref="messageListRef"
        :messages="chatStore.messages"
        :current-user="chatStore.user"
        :is-loading="isLoadingMessages"
        @load-more="loadMoreMessages"
        @edit-message="startEditingMessage"
        @reply-message="startReplyingToMessage"
        @forward-message="showForwardMessageModal"
        @delete-message="showDeleteMessageModal"
      />
    </div>

    <!-- need to work here -->
    <!-- Add user suggestions dropdown -->
    <div v-if="showUserSuggestions" class="user-suggestions">
      <div
        v-for="user in userSuggestions"
        :key="user._id"
        class="user-suggestion-item"
        @click="selectUserSuggestion(user)"
      >
        @{{ user.name }}
      </div>
    </div>

    <div class="message-input">
      <!-- user typing code start -->
      <div v-if="typingUser !== ''" id="typing-status" class="typing-status">
        {{ typingUser }}
      </div>
      <!-- user typing code end -->

      <!-- message replying code start -->
      <div v-if="isReplying" class="replying-indicator">
        Replying to: {{ replyingToMessage.content }}
        <button class="cancel-reply" @click="cancelReply">
          <font-awesome-icon icon="times" />
        </button>
      </div>
      <!-- message replying code end -->

      <!-- message editing code start -->
      <div v-if="isEditing" class="editing-indicator">
        Editing message
        <button class="cancel-edit" @click="cancelEdit">
          <font-awesome-icon icon="times" />
        </button>
      </div>
      <!-- message editing code end -->
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
        <div
          class="message-input-field"
          contenteditable="true"
          ref="messageTextarea"
          @input="handleContentEditableInput"
          @keydown.enter.prevent="sendMessage"
          @keydown.esc="cancelEdit"
          placeholder="Type a message... Use @ to mention users"
        ></div>

        <!-- Keep the textarea for model binding but hide it -->
        <textarea v-model="message" style="display: none"></textarea>
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
  <div v-if="showDeleteConfirmation">
    <DeleteMessageModal @confirm="deleteConfirmMessage" @cancel="cancelDeleteMessage" />
  </div>
  <div v-if="showForwardModal">
    <ForwardMessageModal
      :users="chatStore.users"
      :message="forwardingMessage?.content || 'asdasd'"
      @close="showForwardModal = false"
      @forward="forwardMessageToChat"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useElementSize } from '@vueuse/core'
import RecordRTC from 'recordrtc'
import io from 'socket.io-client'
import MessageList from './MessageList.vue'
import { useChatStore } from '../stores/chat'
import DeleteMessageModal from './DeleteMessageModal.vue'
import { watch } from 'vue'
import { computed } from 'vue'
import ForwardMessageModal from './ForwardMessageModal.vue'

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

const message = ref('')
const typingTimeout = ref(null)
const messageTextarea = ref(null)
const typingUser = ref('')
const isEditing = ref(false)
const editingMessageId = ref(null)
const isReplying = ref(false)
const replyingMessageId = ref(null)

// Add new refs for user tagging
const showUserSuggestions = ref(false)
const userSuggestions = ref([])
const currentMention = ref('')
const mentionStartIndex = ref(-1)
const taggedUsers = ref([])
const editingMessage = ref(null)
const replyingToMessage = ref(null)
const showForwardModal = ref(false)
const forwardingMessage = ref(null)
const messageToDelete = ref(null)
const showDeleteConfirmation = ref(false)

const canSend = computed(() => {
  return (message.value && message.value.trim().length > 0) || selectedFile.value
})

const startEditingMessage = (message) => {
  console.log('Starting to edit message:', message)
  isEditing.value = true
  editingMessage.value = message
  editingMessageId.value = message?._id
}

const deleteConfirmMessage = async () => {
  if (!messageToDelete.value) return

  try {
    await chatStore.deleteMessage(messageToDelete.value._id)
    // Close the confirmation modal
    showDeleteConfirmation.value = false
    messageToDelete.value = null
  } catch (error) {
    console.error('Failed to delete message:', error)
  }
}

const cancelDeleteMessage = () => {
  showDeleteConfirmation.value = false
  messageToDelete.value = null
}

const cancelEditingMessage = () => {
  editingMessage.value = null
  editingMessageId.value = null
  isEditing.value = false
}

const startReplyingToMessage = (message) => {
  console.log('Starting to reply to message:', message)
  isReplying.value = true
  replyingMessageId.value = message?._id
  replyingToMessage.value = message
}

const showForwardMessageModal = (message) => {
  console.log('Showing forward message modal for:', message)
  forwardingMessage.value = message
  showForwardModal.value = true
}

const showDeleteMessageModal = (message) => {
  console.log('Showing delete message modal for:', message)
  messageToDelete.value = message
  showDeleteConfirmation.value = true
}

// need to work here
const forwardMessageToChat = async (chat) => {
  if (!forwardingMessage.value) return

  try {
    const chatId = chat.chatId
    const chatType = chat.chatType
    // Prepare the message content
    const content = forwardingMessage.value.content
    const attachment = forwardingMessage.value.attachment

    // Send the message to the selected chat with isForwarded flag
    if (chatType === 'user') {
      await chatStore.sendMessage({
        content,
        receiverId: chatId,
        attachment,
        isForwarded: true,
      })
    } else {
      await chatStore.sendMessage({
        content,
        groupId: chatId,
        attachment,
        isForwarded: true,
      })
    }

    // Close the modal
    showForwardModal.value = false
    forwardingMessage.value = null
  } catch (error) {
    console.error('Error forwarding message:', error)
  }
}
// need to work here
const cancelReplyingToMessage = () => {
  replyingToMessage.value = null
}

const handleTypingTemp = (data) => {
  if (!chatStore.currentChat) return
  console.log(data, ' asdja sndija niwen ri')
  chatStore.sendTypingStatus({
    receiverId: chatStore.currentChat.type === 'user' ? chatStore.currentChat._id : null,
    groupId: chatStore.currentChat.type === 'group' ? chatStore.currentChat._id : null,
    username: data.name,
  })
}

const handleTyping = (event) => {
  handleTypingTemp({ name: chatStore.user.name })

  // Handle @ mentions
  const text = message.value
  const cursorPosition = messageTextarea.value.selectionStart

  // Find @ symbol before cursor
  const lastAtSymbol = text.lastIndexOf('@', cursorPosition - 1)

  if (lastAtSymbol !== -1) {
    // Check if there's a space between the @ and cursor
    const textBetween = text.substring(lastAtSymbol + 1, cursorPosition)
    const hasSpace = textBetween.includes(' ')

    if (!hasSpace) {
      // We have a potential mention
      mentionStartIndex.value = lastAtSymbol
      currentMention.value = textBetween

      // Filter group members based on the current mention text
      if (props.groupMembers && props.groupMembers.length > 0) {
        userSuggestions.value = props.groupMembers.filter((member) =>
          member.username.toLowerCase().includes(currentMention.value.toLowerCase()),
        )
        showUserSuggestions.value = userSuggestions.value.length > 0
      }
    } else {
      // Reset mention state if there's a space
      resetMentionState()
    }
  } else {
    // No @ symbol found, reset mention state
    resetMentionState()
  }
}

// Add function to reset mention state
const resetMentionState = () => {
  showUserSuggestions.value = false
  userSuggestions.value = []
  currentMention.value = ''
  mentionStartIndex.value = -1
}

// Add function to select a user from suggestions
const selectUserSuggestion = (user) => {
  if (mentionStartIndex.value !== -1) {
    const beforeMention = message.value.substring(0, mentionStartIndex.value)
    const afterMention = message.value.substring(
      mentionStartIndex.value + currentMention.value.length + 1,
    )

    // Replace the mention with the username, but don't add styling here
    // We'll handle the styling in the display
    message.value = `${beforeMention}@${user.username} ${afterMention}`

    // Add user to tagged users array if not already there
    if (!taggedUsers.value.some((tagged) => tagged._id === user._id)) {
      taggedUsers.value.push({
        _id: user._id,
        username: user.username,
      })
    }

    // Reset mention state
    resetMentionState()

    // Focus the textarea and set cursor position after the inserted username
    nextTick(() => {
      messageTextarea.value.focus()

      // Calculate the position after the inserted username
      const newCursorPosition = mentionStartIndex.value + user.username.length + 2 // +2 for @ and space

      // Set cursor position
      const textNode = messageTextarea.value.firstChild || messageTextarea.value
      const range = document.createRange()
      const selection = window.getSelection()

      try {
        // If there's text content, set the cursor position
        if (textNode.nodeType === Node.TEXT_NODE) {
          range.setStart(textNode, Math.min(newCursorPosition, textNode.length))
        } else {
          // If the node is an element (like when we have formatted mentions)
          // Insert cursor at the end
          range.selectNodeContents(messageTextarea.value)
          range.collapse(false)
        }

        selection.removeAllRanges()
        selection.addRange(range)
      } catch (e) {
        console.error('Error setting cursor position:', e)
      }
    })
  }
}

const cancelEdit = () => {
  message.value = ''
  isEditing.value = false
  editingMessageId.value = null
  cancelEditingMessage()
}

const cancelReply = () => {
  message.value = ''
  isReplying.value = false
  replyingMessageId.value = null
  emit('cancel-reply')
}

onMounted(() => {
  // Focus the contenteditable div when the component is mounted
  messageTextarea.value.focus()
  window.addEventListener('user-typing', handleUserTyping)
  window.addEventListener('user-stopped-typing', handleUserStoppedTyping)

  // Set placeholder text
  messageTextarea.value.setAttribute('data-placeholder', 'Type a message...')
})

const handleUserTyping = (event) => {
  console.log('user typing start here mahesh ', event.detail)

  const { username, userId, groupId } = event.detail
  console.log('Typing event received in MessageList:', username, userId)

  if (username) {
    typingUser.value = `${username} is typing...`
  } else {
    typingUser.value = ''
  }
  console.log('Typing user:', typingUser.value)
}

const handleUserStoppedTyping = (event) => {
  const { userId } = event.detail
  console.log('Stopped typing event received in MessageList:', userId)
  typingUser.value = ''
}

// Add new function to handle contenteditable input
const handleContentEditableInput = (event) => {
  // Update the message value from the contenteditable div
  message.value = event.target.innerText

  // Call the original handleTyping function
  handleTyping(event)
}

// Improve the function to render mentions in the contenteditable div
const renderMentionsInInput = () => {
  if (!messageTextarea.value) return

  // Save selection and cursor position before modifying the DOM
  const selection = window.getSelection()
  let savedRange = null
  if (selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange()
  }

  const text = message.value
  let html = text

  // Replace all @username patterns with styled versions
  taggedUsers.value.forEach((user) => {
    const pattern = new RegExp(`@${user.username}\\b`, 'g')
    html = html.replace(pattern, `<span class="mention">@${user.username}</span>`)
  })

  // Only update if the HTML has changed to avoid cursor jumping
  if (messageTextarea.value.innerHTML !== html) {
    messageTextarea.value.innerHTML = html

    // Restore cursor position if we saved it
    if (savedRange) {
      try {
        // Try to restore the cursor position
        selection.removeAllRanges()
        selection.addRange(savedRange)
      } catch (e) {
        console.error('Error restoring cursor position:', e)
        // If restoring fails, move cursor to the end as fallback
        const range = document.createRange()
        range.selectNodeContents(messageTextarea.value)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }
}

// Watch for changes in taggedUsers to update the rendering
watch(taggedUsers, renderMentionsInInput, { deep: true })

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
  if (!message.value.trim() || !props.user) return

  try {
    if (isEditing.value) {
      // Check if editMessage method exists in the store
      if (typeof chatStore.editMessage !== 'function') {
        console.error('chatStore.editMessage is not a function!')
        return
      }

      // Handle editing message
      await chatStore.editMessage({
        messageId: editingMessageId.value,
        content: message.value,
        attachment: selectedFile.value,
      })
      // Reset editing state
      isEditing.value = false
      editingMessageId.value = null
    } else if (isReplying.value) {
      await chatStore.sendMessage({
        content: message.value,
        receiverId: String(props.user._id),
        attachment: selectedFile.value,
        replyTo: replyingMessageId.value,
        type: props.user?.type,
      })

      isReplying.value = false
      replyingMessageId.value = null
    } else {
      // await chatStore.sendMessage({
      //   content: message.value,
      //   receiverId: String(props.user._id),
      //   attachment: selectedFile.value,
      //   replyTo: undefined,
      //   type: props.user?.type,
      // })

      await chatStore.sendMessage({
        content: message.value,
        receiverId: String(props.user._id),
        attachment: selectedFile.value,
        replyTo: undefined,
        isForwarded: false,
        taggedUsers: [],
        type: props.user.type,
      })
    }

    message.value = ''
    const el = messageTextarea.value as HTMLDivElement
    if (el) el.innerText = ''
    selectedFile.value = null
  } catch (error) {
    const el = messageTextarea.value as HTMLDivElement
    if (el) el.innerText = ''
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
      // receiverId: String(props.user.id),
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
.message-input {
  padding: 12px;
  border-top: 1px solid #e0e0e0;
  background-color: white;
}

.input-container {
  display: flex;
  align-items: center;
}

textarea {
  flex: 1;
  height: 40px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  margin: 0 8px;
}

button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: #4caf50;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.attachment-button {
  background-color: #f5f5f5;
  color: #666;
}

.attachment-button:hover {
  background-color: #e0e0e0;
}

.attachment-preview {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.preview-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-name {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.remove-file {
  width: 24px;
  height: 24px;
  background-color: #e0e0e0;
  color: #666;
  margin-left: 8px;
  font-size: 12px;
}

.remove-file:hover {
  background-color: #d0d0d0;
}

.editing-indicator {
  background-color: #e3f2fd;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #2196f3;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cancel-edit {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-edit:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.replying-indicator {
  background-color: #e8f5e9;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #4caf50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cancel-reply {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-reply:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

/* Add styles for user suggestions */
.user-suggestions {
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  width: 200px;
  z-index: 10;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 8px;
}

.user-suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}

.user-suggestion-item:hover {
  background-color: #f5f5f5;
}

.typing-status {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  font-style: italic;
}

/* Add styles for mentions */
.mention {
  color: #2196f3 !important;
  font-weight: bold !important;
  background-color: rgba(33, 150, 243, 0.1) !important;
  border-radius: 3px !important;
  padding: 0 3px !important;
}

/* Style for contenteditable input */
.message-input-field {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  overflow-y: auto;
  font-family: inherit;
  font-size: 14px;
  margin: 0 8px;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-input-field:empty:before {
  content: attr(data-placeholder);
  color: #999;
}

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
