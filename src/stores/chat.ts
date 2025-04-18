import { defineStore } from 'pinia'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'

const API_URL = 'http://localhost:3000'
let socket: Socket | null = null

export interface User {
  _id: string
  name: string
  createdAt?: string
  isOnline?: boolean
  lastSeen?: string | null
  updatedAt?: string
}

interface Group {
  _id: string
  name: string
  members: User[]
  createdBy: string
  createdAt?: string
  updatedAt?: string
  type: 'group'
}

interface Message {
  _id: string
  content: string
  sender: string | User
  receiver?: string
  groupId?: string
  attachment?: {
    url: string
    type: string
    filename: string
  }
  read?: boolean
  createdAt: string
  updatedAt: string
  replyTo?: string
  isForwarded?: boolean
  taggedUsers?: Array
}

interface ChatState {
  user: User | null
  users: User[]
  groups: Group[]
  currentChat: (User & { type: 'user' }) | Group | null
  messages: Message[]
  onlineUsers: Record<string, boolean>
  unreadMessages: Record<string, number>
  typingUsers: Record<string, boolean>
  isFetchingUsers: Boolean
  isFetchingMessages: Boolean
}

interface MessageParams {
  chatId: string
  chatType: 'user' | 'group'
  skip?: number
  limit?: number
}

interface SendMessageParams {
  content: string
  receiverId?: string
  groupId?: string
  attachment?: File
  replyTo?: string
  isForwarded?: boolean
  taggedUsers?: Array
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    user: null,
    users: [],
    groups: [],
    currentChat: null,
    messages: [],
    onlineUsers: {},
    unreadMessages: {},
    typingUsers: {},
    isFetchingUsers: false,
    isFetchingMessages: false,
    typingUsers: {},
  }),

  actions: {
    async initialize(): Promise<boolean> {
      const savedUser = JSON.parse(localStorage.getItem('user') || 'null')
      console.log('frontend2:', savedUser)
      if (savedUser) {
        this.user = savedUser
        this.connectSocket()
        await Promise.all([this.fetchUsers(), this.fetchGroups()])

        const userGroups = this.groups.filter((group) =>
          group.members.some((member) => member._id === this.user?._id),
        )

        userGroups?.forEach((group) => {
          this.joinGroup(group._id)
        })

        const savedChat = JSON.parse(localStorage.getItem('currentChat') || 'null')
        if (savedChat) {
          let chat
          if (savedChat.type === 'user') {
            chat = this.users.find((u) => u._id === savedChat._id)
            if (chat) {
              chat = { ...chat, type: 'user' as const }
            }
          } else {
            chat = this.groups.find((g) => g._id === savedChat._id)
            if (chat) {
              chat = { ...chat, type: 'group' as const }
            }
          }

          if (chat) {
            this.setCurrentChat(chat)
            await this.fetchMessages({
              chatId: chat._id,
              chatType: chat.type,
              skip: 0,
              limit: 20,
            })
          }
        }
        return true
      }
      return false
    },

    getUnreadCount(chatId: string, isGroup: string) {
      const key = isGroup ? `group:${chatId}` : `user:${chatId}`
      return this.unreadMessages[chatId] || 0
    },

    async login(name: string): Promise<User> {
      try {
        if (!name?.trim()) {
          throw new Error('name is required')
        }

        const normalizedname = name.trim()
        let user: User | null = null

        try {
          const response = await axios.get<User>(`${API_URL}/users/name/${normalizedname}`)
          user = response.data
          console.log('Found existing user:', user)
        } catch (error) {
          console.log('User not found, will create new user')
        }

        if (!user) {
          try {
            const response = await axios.post<User>(`${API_URL}/users`, {
              name: normalizedname,
            })
            user = response.data
            console.log('Created new user:', user)
          } catch (error) {
            console.error('Error creating user:', error)

            if (axios.isAxiosError(error) && error.response?.status === 409) {
              const response = await axios.get<User>(`${API_URL}/users/username/${normalizedname}`)
              user = response.data
              console.log('Retrieved existing user after conflict:', user)
            } else {
              throw error
            }
          }
        }

        if (!user) {
          throw new Error('Failed to login or create user')
        }

        this.user = user
        localStorage.setItem('user', JSON.stringify(user))
        this.connectSocket()

        return user
      } catch (error) {
        console.error('Login error:', error)
        throw error
      }
    },

    async fetchUsers(page = 1): Promise<User[]> {
      try {
        this.isFetchingUsers = true
        const savedUser = JSON.parse(localStorage.getItem('user') || 'null')
        if (savedUser) {
          const { data }: any = await axios.get<User[]>(`${API_URL}/users/v1?page=${page}&limit=10`)
          this.users = [...this.users, ...data?.data?.filter((user) => user._id !== savedUser?._id)]
          this.isFetchingUsers = false
          return this.users
        }
      } catch (error) {
        this.isFetchingUsers = false
        console.error('Error fetching users:', error)
        throw error
      }
    },

    async fetchGroups(): Promise<Group[]> {
      try {
        const { data } = await axios.get<Group[]>(`${API_URL}/groups`)
        this.groups = data
        return data
      } catch (error) {
        console.error('Error fetching groups:', error)
        throw error
      }
    },

    async createGroup({ name, members }: { name: string; members: string[] }): Promise<Group> {
      try {
        const { data } = await axios.post<Group>(`${API_URL}/groups`, {
          name,
          members: [...members, this.user?._id],
          createdBy: this.user?._id,
        })

        this.fetchUsers()
        return data
      } catch (error) {
        console.error('Error creating group:', error)
        throw error
      }
    },

    async fetchMessages({
      chatId,
      chatType,
      skip = 0,
      limit = 20,
    }: MessageParams): Promise<Message[]> {
      try {
        this.isFetchingMessages = true
        console.log('frontend1:', chatId, chatType)
        const endpoint =
          chatType === 'user'
            ? `${API_URL}/messages/direct/${this.user?._id}/${chatId}`
            : `${API_URL}/messages/group/${chatId}`

        const { data } = await axios.get<Message[]>(endpoint, {
          params: { skip, limit },
        })

        if (skip === 0) {
          this.messages = data
        } else {
          this.messages = [...data, ...this.messages]
        }
        this.isFetchingMessages = false
        return data
      } catch (error) {
        this.isFetchingMessages = false
        console.error('Error fetching messages:', error)
        throw error
      }
    },

    connectSocket(): void {
      if (socket?.connected) {
        console.log('Socket already connected')
        return
      }

      try {
        console.log('Connecting to socket...')
        socket = io(API_URL, {
          query: {
            userId: this.user?._id,
          },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })

        socket.on('connect', () => {
          console.log('Socket connected')
        })

        socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error)
        })

        socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason)
        })

        socket.on('newMessage', (message: Message) => {
          console.log('New message received:', message)

          if (message.sender && typeof message.sender === 'string') {
            const senderUser = this.users.find((u) => u._id === message.sender)
            if (senderUser) {
              message.sender = senderUser
            } else {
              message.sender = { _id: message.sender as string, name: 'Unknown' }
            }
          }

          if (
            this.currentChat &&
            ((this.currentChat.type === 'user' &&
              (message.sender?._id === this.currentChat._id ||
                message.receiver === this.currentChat._id)) ||
              (this.currentChat.type === 'group' && message.groupId === this.currentChat._id))
          ) {
            this.messages.push(message)
            this.markMessageAsRead(message._id)
          } else {
            const chatId = message.groupId || (message.sender as User)._id
            this.unreadMessages[chatId] = (this.unreadMessages[chatId] || 0) + 1
          }
        })

        socket.on('messageRead', ({ messageId }: { messageId: string }) => {
          const message = this.messages.find((m) => m._id === messageId)
          if (message) {
            message.read = true
          }
        })

        socket.on('userOnline', ({ userId }: { userId: string }) => {
          this.onlineUsers[userId] = true
        })

        socket.on('userOffline', ({ userId }: { userId: string }) => {
          this.onlineUsers[userId] = false
        })

        // Add typing event handlers
        socket.on('userTyping', (data) => {
          console.log('User typing:', data)
          const { userId, username, groupId } = data

          // Skip if it's the current user
          if (userId === this.user._id) return

          // Add to typing users
          this.typingUsers[userId] = {
            userId,
            username,
            timestamp: Date.now(),
            groupId,
          }

          // Dispatch custom event for components to react
          window.dispatchEvent(
            new CustomEvent('user-typing', {
              detail: { userId, username, groupId },
            }),
          )
        })

        socket.on('userStoppedTyping', (data) => {
          console.log('User stopped typing:', data)
          const { userId } = data

          // Remove from typing users
          // delete this.typingUsers[userId];

          // Dispatch custom event
          window.dispatchEvent(
            new CustomEvent('user-stopped-typing', {
              detail: { userId },
            }),
          )
        })
      } catch (error) {
        console.error('Socket connection error:', error)
      }
    },

    async sendMessage({
      content,
      receiverId,
      groupId,
      attachment,
      replyTo,
      isForwarded,
      taggedUsers,
    }: SendMessageParams): Promise<void> {
      try {
        let messageData: Partial<Message> & { content: string } = {
          content,
          sender: this.user?._id as string,
        }

        if (receiverId) {
          messageData.receiver = receiverId
        } else if (groupId) {
          messageData.group = groupId
        }

        // Add reply information if provided
        if (replyTo) {
          messageData.replyTo = replyTo
        }

        // Add forwarded flag if provided
        if (isForwarded) {
          messageData.isForwarded = true
        }

        // Add tagged users if provided
        if (taggedUsers && taggedUsers.length > 0) {
          messageData.taggedUsers = taggedUsers
        }

        if (attachment) {
          messageData = await this.uploadAttachment(messageData, attachment)
        }

        console.log('3 messageData')
        console.log(messageData, ' messageData ***************** ', replyTo)

        socket?.emit('sendMessage', messageData)
      } catch (error) {
        console.error('Error sending message:', error)
        throw error
      }
    },

    async editMessage({ messageId, content, attachment }) {
      console.log('Store: editMessage called with:', {
        messageId,
        content,
        attachment,
      })

      try {
        // First check if the message exists in our local state
        const messageIndex = this.messages.findIndex((m) => m._id === messageId)
        if (messageIndex === -1) {
          console.error('Message not found in local state:', messageId)
          return
        }

        // Make API call to update the message in the database
        const response = await axios.put(`${API_URL}/messages/${messageId}`, {
          content,
          edited: true,
        })

        // Update the message in local state
        if (response.data) {
          this.messages[messageIndex] = response.data
        } else {
          // Fallback if response doesn't contain the updated message
          this.messages[messageIndex].content = content
          this.messages[messageIndex].edited = true
        }

        console.log('Message updated in local state:', this.messages[messageIndex])

        // Emit socket event to notify other users about the edited message
        if (socket) {
          socket.emit('messageEdited', {
            messageId,
            content,
            userId: this.user._id,
          })
        }

        return this.messages[messageIndex]
      } catch (error) {
        console.error('Error editing message:', error)
        throw error
      }
    },

    // Add a new method to delete a message
    async deleteMessage(messageId: string) {
      try {
        const { data } = await axios.delete(`${API_URL}/messages/${messageId}`)

        // Emit a socket event to notify other users about the deleted message
        if (socket) {
          socket.emit('messageDeleted', {
            messageId: messageId,
            userId: this.user?._id,
          })
        }

        return data
      } catch (error) {
        console.error('Error deleting message:', error)
        throw error
      }
    },

    async uploadAttachment(
      messageData: Partial<Message> & { content: string },
      attachment: File,
    ): Promise<Partial<Message> & { content: string }> {
      try {
        const formData = new FormData()
        if (messageData.receiver) {
          formData.append('receiver', messageData.receiver)
        }
        // else if (messageData.group) {
        //   formData.append('group', messageData.group)
        // }

        formData.append('sender', messageData.sender)
        formData.append('file', attachment)

        if (messageData.content) {
          formData.append('content', messageData.content)
        }

        const { data } = await axios.post(`${API_URL}/messages/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        return {
          ...messageData,
          attachment: {
            url: data.url,
            type: attachment.type,
            filename: attachment.name,
          },
        }
      } catch (error) {
        console.error('Error uploading attachment:', error)
        throw error
      }
    },

    joinGroup(groupId: string): void {
      socket?.emit('joinGroup', { groupId })
    },

    leaveGroup(groupId: string): void {
      socket?.emit('leaveGroup', { groupId })
    },

    sendTypingStatus({ receiverId, groupId, username }) {
      if (!socket || !socket.connected) {
        console.log('Socket not connected, reconnecting...')
        this.connectSocket()
      }

      const typingData = {
        userId: this.user?._id,
        username,
        receiverId,
        groupId,
      }

      // Add timestamp to typing data to help with expiration
      typingData.timestamp = Date.now()

      // console.log("Sending typing event to server:", typingData);
      // console.log("Socket connected?", socket?.connected);
      // console.log("Socket ID:", socket?.id);

      socket?.emit('typing', typingData, (acknowledgement) => {
        // This callback will be executed if the server acknowledges the event
        console.log('Server acknowledged typing event:', acknowledgement)
      })
    },

    markMessageAsRead(messageId: string): void {
      socket?.emit('markAsRead', { messageId })
    },

    markAsRead(messageId: string): void {
      socket?.emit('markAsRead', { messageId })
    },

    clearUnreadCount({ chatId, isGroup }: { chatId: string; isGroup: boolean }): void {
      this.unreadMessages[chatId] = 0
    },

    setCurrentChat(chat: (User & { type: 'user' }) | Group): void {
      this.currentChat = chat
      localStorage.setItem('currentChat', JSON.stringify(chat))

      if (chat) {
        this.clearUnreadCount({
          chatId: chat._id,
          isGroup: chat.type === 'group',
        })
        console.log('set current chat is here ', chat)

        this.fetchMessages({
          chatId: chat._id,
          chatType: chat.type,
          skip: 0,
          limit: 20,
        })

        if (chat.type === 'group') {
          this.joinGroup(chat._id)
        }
      }
    },

    logout(): void {
      this.user = null
      this.users = []
      this.groups = []
      this.currentChat = null
      this.messages = []
      this.onlineUsers = {}
      this.unreadMessages = {}
      this.typingUsers = {}

      localStorage.removeItem('user')
      localStorage.removeItem('currentChat')

      if (socket?.connected) {
        socket.disconnect()
      }
    },

    resetCurrentChat() {
      this.currentChat = null
    },

    getSocket(): Socket | null {
      return socket
    },

    async addUserToGroup(groupId: string, userId: string): Promise<void> {
      try {
        await axios.post(`${API_URL}/groups/${groupId}/members`, {
          userId,
        })

        const group = this.groups.find((g) => g._id === groupId)
        if (group) {
          const user = this.users.find((u) => u._id === userId)
          if (user && !group.members.some((m) => m._id === userId)) {
            group.members.push(user)
          }
        }
      } catch (error) {
        console.error('Error adding user to group:', error)
        throw error
      }
    },

    async removeUserFromGroup(groupId: string, userId: string): Promise<void> {
      try {
        await axios.delete(`${API_URL}/groups/${groupId}/members/${userId}`)

        const group = this.groups.find((g) => g._id === groupId)
        if (group) {
          group.members = group.members.filter((m) => m._id !== userId)
        }
      } catch (error) {
        console.error('Error removing user from group:', error)
        throw error
      }
    },
  },
})
