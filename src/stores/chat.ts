import { defineStore } from 'pinia'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'

// const API_URL = import.meta.env.VITE_API_URL
const API_URL = 'http://localhost:3000'
let socket: Socket | null = null

export interface User {
  _id: string
  name: string
  createdAt?: string
  isOnline?: boolean
  lastSeen?: string | null
  updatedAt?: string
  type?: 'user' | 'group'
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
  edited?: boolean
  createdAt: string
  updatedAt: string
}

interface TypingUser {
  userId: string
  name: string
  timestamp: number
  groupId?: string
}

interface ChatState {
  user: User | null
  users: User[]
  groups: Group[]
  currentChat: (User & { type: 'user' }) | Group | null
  messages: Message[]
  onlineUsers: Record<string, boolean>
  unreadMessages: Record<string, number>
  typingUsers: Record<string, TypingUser>
  isFetchingUsers: boolean
  isFetchingMessages: boolean
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
  type: 'user' | 'group'
  replyTo?: string
  isForwarded?: boolean
  taggedUsers?: string[]
}

interface MessageData {
  _id?: string
  content: string
  sender: string | undefined
  receiver?: string
  group?: string
  replyTo?: string
  isForwarded?: boolean
  taggedUsers?: string[]
  attachment?: any
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
  }),

  actions: {
    async initialize(): Promise<boolean> {
      const savedUser = JSON.parse(localStorage.getItem('user') || 'null')
      console.log('frontend2:', savedUser)
      if (savedUser) {
        this.user = savedUser
        this.connectSocket()

        // Fetch users and groups
        await Promise.all([this.fetchGroups()])

        const userGroups = this.groups.filter((group) =>
          group.members.some((member) => member._id === this.user?._id),
        )

        userGroups?.forEach((group) => {
          this.joinGroup(group._id)
        })

        // Restore current chat if it was saved
        const savedChat = JSON.parse(localStorage.getItem('currentChat') || 'null')
        if (savedChat) {
          // Find the actual chat object with all properties
          let chat
          if (savedChat.type === 'user') {
            chat = this.users.find((u) => u._id === savedChat._id)
            if (chat) chat.type = 'user'
          } else {
            chat = this.groups.find((g) => g._id === savedChat._id)
            if (chat) chat.type = 'group'
          }

          if (chat) {
            this.setCurrentChat(chat as (User & { type: 'user' }) | Group)

            // Fetch messages for the current chat
            this.fetchMessages({
              chatId: chat._id,
              chatType: chat.type as 'user' | 'group',
              skip: 0,
              limit: 20,
            })
          }
        }

        return true
      }

      return false
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

    async fetchGroups() {
      try {
        const { data } = await axios.get(`${API_URL}/groups`)
        this.groups = data
        return data
      } catch (error) {
        console.error('Error fetching groups:', error)
        throw error
      }
    },

    async createGroup({ name, members }: { name: string; members: string[] }): Promise<Group> {
      try {
        const { data } = await axios.post(`${API_URL}/groups`, {
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

        const { data } = await axios.get(endpoint, {
          params: { skip, limit },
        })

        // If it's the first page, replace messages
        if (skip === 0) {
          this.messages = data
        } else {
          // Otherwise, prepend to existing messages
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

    connectSocket() {
      if (socket && socket.connected) {
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

        // Add typing event handlers
        socket.on('userTyping', (data) => {
          console.log('User typing:', data)
          const { userId, name, groupId } = data

          // Skip if it's the current user
          if (userId === this.user?._id) return

          // Add to typing users
          this.typingUsers[userId] = {
            userId,
            name,
            timestamp: Date.now(),
            groupId,
          }

          // Dispatch custom event for components to react
          window.dispatchEvent(
            new CustomEvent('user-typing', {
              detail: { userId, name, groupId },
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

        socket.on('newMessage', (message) => {
          console.log('New message received:', message)

          // // Log the call stack to see which function triggered this event handler
          // const stackTrace = new Error().stack;
          // console.log("Call stack:", stackTrace);

          // Add sender object if it's not already there
          if (message.sender && typeof message.sender === 'string') {
            const senderUser = this.users.find((u) => u._id === message.sender)
            if (senderUser) {
              message.sender = senderUser
            } else {
              message.sender = { _id: message.sender, name: 'Unknown' }
            }
          }

          // Format attachment data if present
          if (message.attachment) {
            // console.log("Message has attachment:", message.attachment);
            // Ensure attachment data is properly structured
            if (typeof message.attachment === 'string') {
              try {
                message.attachment = JSON.parse(message.attachment)
              } catch (e) {
                console.error('Failed to parse attachment JSON:', e)
              }
            }
          }

          // Add to messages if it's for the current chat
          if (this.currentChat) {
            const isForCurrentChat =
              (this.currentChat.type === 'user' &&
                ((message.sender._id === this.currentChat._id &&
                  message.receiver === this.user?._id) ||
                  (message.sender._id === this.user?._id &&
                    message.receiver === this.currentChat._id))) ||
              (this.currentChat.type === 'group' && message.group === this.currentChat._id)

            if (isForCurrentChat) {
              this.messages.push(message)

              // Scroll to bottom after message is added
              setTimeout(() => {
                const messageList = document.querySelector('.message-list')
                if (messageList) {
                  messageList.scrollTop = messageList.scrollHeight
                }
              }, 50)
            } else {
              // Increment unread count for other chats
              const chatId = message.group || message.sender._id
              const isGroup = !!message.group
              const key = isGroup ? `group:${chatId}` : `user:${chatId}`

              if (message.sender._id !== this.user?._id) {
                this.unreadMessages[key] = (this.unreadMessages[key] || 0) + 1
              }
            }
          } else {
            // Increment unread count when no chat is selected
            const chatId = message.group || message.sender._id
            const isGroup = !!message.group
            const key = isGroup ? `group:${chatId}` : `user:${chatId}`

            if (message.sender._id !== this.user?._id) {
              this.unreadMessages[key] = (this.unreadMessages[key] || 0) + 1
            }
          }
        })

        socket.on('userConnected', (userId) => {
          console.log('User connected:', userId)
          this.onlineUsers[userId] = true
        })

        socket.on('userDisconnected', (userId) => {
          console.log('User disconnected:', userId)
          this.onlineUsers[userId] = false
        })

        socket.on('onlineUsers', (userIds) => {
          console.log('Online users:', userIds)
          // Reset all users to offline
          this.onlineUsers = {}
          // Set online users
          userIds.forEach((userId: string) => {
            this.onlineUsers[userId] = true
          })
        })

        socket.on('messageRead', (messageId) => {
          console.log('Message read:', messageId)
          // Find message and mark as read
          const message = this.messages.find((m) => m._id === messageId)
          if (message) {
            message.read = true
          }
        })

        // Add new event handlers for call notifications
        socket.on('callOffer', (data) => {
          console.log('Call offer received in store:', data)
          // Dispatch a custom event for the call notification
          window.dispatchEvent(
            new CustomEvent('incoming-call', {
              detail: {
                from: data.from,
                callType: data.callType,
                offer: data.offer,
              },
            }),
          )
        })

        socket.on('messageEdited', (data) => {
          console.log('Received messageEdited event:', data)
          const { messageId, content, userId } = data

          // Find the message in our local state
          const messageIndex = this.messages.findIndex((m) => m._id === messageId)
          if (messageIndex !== -1) {
            // Update the message content and edited status
            this.messages[messageIndex].content = content
            this.messages[messageIndex].edited = true

            console.log('Updated message in receiver:', this.messages[messageIndex])
          }
        })
      } catch (error) {
        console.error('Error connecting to socket:', error)
      }
    },

    sendMessage({
      content,
      receiverId,
      attachment,
      replyTo,
      isForwarded,
      taggedUsers,
      type,
    }: SendMessageParams) {
      // Make sure content is a string and not empty or we have an attachment
      if ((!content || typeof content !== 'string' || !content.trim()) && !attachment) {
        console.error('Invalid message content:', content)
        return
      }

      const messageData: MessageData = {
        content: content ? content.trim() : '',
        sender: this.user?._id,
      }

      if (type === 'user') {
        messageData.receiver = receiverId
      } else if (type === 'group') {
        messageData.group = receiverId
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

      if (!socket || !socket.connected) {
        this.connectSocket()
      }

      console.log('Sending message:', messageData)

      if (attachment && isForwarded) {
        messageData.attachment = attachment
      }

      // If there's an attachment, use the upload endpoint
      if (attachment && !isForwarded) {
        this.uploadAttachment(messageData, attachment)
        console.log('frontend5:')
      } else {
        // Otherwise, send as a regular message
        socket?.emit('sendMessage', messageData)
        console.log('frontend4:')
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

    joinGroup(groupId: string) {
      if (!socket || !socket.connected) {
        this.connectSocket()
      }

      socket?.emit('joinGroup', groupId)
    },

    leaveGroup(groupId: string) {
      if (!socket || !socket.connected) {
        this.connectSocket()
      }

      socket?.emit('leaveGroup', groupId)
    },

    sendTypingStatus({
      receiverId,
      groupId,
      name,
    }: {
      receiverId: string
      groupId: string
      name: string
    }) {
      if (!socket || !socket.connected) {
        console.log('Socket not connected, reconnecting...')
        this.connectSocket()
      }

      const typingData = {
        userId: this.user?._id,
        name,
        receiverId,
        groupId,
        timestamp: Date.now(),
      }

      // console.log("Sending typing event to server:", typingData);
      // console.log("Socket connected?", socket?.connected);
      // console.log("Socket ID:", socket?.id);

      socket?.emit('typing', typingData, (acknowledgement: any) => {
        // This callback will be executed if the server acknowledges the event
        console.log('Server acknowledged typing event:', acknowledgement)
      })
    },

    markMessageAsRead(messageId: string) {
      // Make sure we're using the actual MongoDB _id, not a timestamp
      if (!messageId || typeof messageId !== 'string' || !messageId.match(/^[0-9a-fA-F]{24}$/)) {
        console.error('Invalid message ID format:', messageId)
        return
      }

      if (socket) {
        console.log('Marking message as read:', messageId)
        socket?.emit('markAsRead', messageId)

        // Also update the local state
        const message = this.messages.find((m) => m._id === messageId)
        if (message) {
          message.read = true
        }
      }
    },

    // Add an alias for backward compatibility
    markAsRead(messageId: string) {
      console.warn('markAsRead is deprecated, use markMessageAsRead instead')
      this.markMessageAsRead(messageId)
    },

    clearUnreadCount({ chatId, isGroup }: { chatId: string; isGroup: boolean }) {
      const key = isGroup ? `group:${chatId}` : `user:${chatId}`
      this.unreadMessages[key] = 0
    },

    // setCurrentChat(chat: (User & { type: 'user' }) | Group) {
    //   this.currentChat = chat

    //   // Save current chat to localStorage
    //   localStorage.setItem(
    //     'currentChat',
    //     JSON.stringify({
    //       _id: chat._id,
    //       type: chat.type,
    //     }),
    //   )

    //   if (chat) {
    //     // Clear unread count
    //     this.clearUnreadCount({
    //       chatId: chat._id,
    //       isGroup: chat.type === 'group',
    //     })

    //     // Join group if it's a group chat
    //     // if (chat.type === "group") {
    //     //   this.joinGroup(chat._id);
    //     // }
    //   }
    // },

    setCurrentChat(chat: (User & { type: 'user' }) | Group): void {
      this.currentChat = chat
      localStorage.setItem('currentChat', JSON.stringify(chat))

      if (chat) {
        this.clearUnreadCount({
          chatId: chat._id,
          isGroup: chat.type === 'group',
        })

        this.fetchMessages({
          chatId: chat._id,
          chatType: chat.type,
          skip: 0,
          limit: 20,
        })

        // if (chat.type === 'group') {
        //   this.joinGroup(chat._id)
        // }
      }
    },

    logout() {
      // Disconnect socket
      if (socket) {
        socket.disconnect()
        socket = null
      }

      // Clear user data
      this.user = null
      this.users = []
      this.groups = []
      this.currentChat = null
      this.messages = []
      this.onlineUsers = {}
      this.unreadMessages = {}

      // Clear localStorage
      localStorage.removeItem('user')
      localStorage.removeItem('currentChat')
    },

    // Add a method to get the socket instance
    getSocket() {
      return socket
    },

    async addUserToGroup(groupId: string, userId: string) {
      try {
        const { data } = await axios.post(`${API_URL}/groups/${groupId}/members/${userId}`)

        // Update the group in the local state
        const groupIndex = this.groups.findIndex((group) => group._id === groupId)
        if (groupIndex !== -1) {
          this.groups[groupIndex] = data

          // If this is the current chat, update it as well
          if (this.currentChat && this.currentChat._id === groupId) {
            this.currentChat = data
          }
        }

        return data
      } catch (error) {
        console.error('Error adding user to group:', error)
        throw error
      }
    },

    async removeUserFromGroup(groupId: string, userId: string) {
      try {
        const { data } = await axios.delete(`${API_URL}/groups/${groupId}/members/${userId}`)

        // Update the group in the local state
        const groupIndex = this.groups.findIndex((group) => group._id === groupId)
        if (groupIndex !== -1) {
          this.groups[groupIndex] = data

          // If this is the current chat, update it as well
          if (this.currentChat && this.currentChat._id === groupId) {
            this.currentChat = data
          }
        }

        return data
      } catch (error) {
        console.error('Error adding user to group:', error)
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

    async editMessage({
      messageId,
      content,
      attachment,
    }: {
      messageId: string
      content: string
      attachment: File
    }) {
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
            userId: this.user?._id,
          })
        }

        return this.messages[messageIndex]
      } catch (error) {
        console.error('Error editing message:', error)
        throw error
      }
    },
  },

  getters: {
    getUnreadCount: (state) => (chatId: string, isGroup: boolean) => {
      const key = isGroup ? `group:${chatId}` : `user:${chatId}`
      return state.unreadMessages[key] || 0
    },

    isUserOnline: (state) => (userId: string) => {
      return !!state.onlineUsers[userId]
    },

    otherUsers: (state) => {
      return state.users.filter((user) => user._id !== state.user?._id)
    },

    // getTypingUsers: (state) => {
    //   const typingnames = Object.values(state.typingUsers).map(
    //     (user) => user.name
    //   );

    //   if (typingnames.length === 0) {
    //     return null;
    //   } else if (typingnames.length === 1) {
    //     return `${typingnames[0]} is typing...`;
    //   } else if (typingnames.length === 2) {
    //     return `${typingnames[0]} and ${typingnames[1]} are typing...`;
    //   } else {
    //     return "Several people are typing...";
    //   }
    // },
  },
})
