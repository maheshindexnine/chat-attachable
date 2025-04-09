<template>
  <div class="message-list" ref="messageListRef" @scroll="handleScroll">
    <div v-if="isTyping" class="typing-indicator">{{ typingUser }} is typing...</div>

    <div v-if="isLoading && messages.length === 0" class="loading-indicator">
      Loading messages...
    </div>
    <div
      v-for="(message, index) in displayMessages"
      :key="message._id"
      class="message-container"
      :class="{ 'own-message': isOwnMessage(message) }"
    >
      <div class="message-bubble">
        <div class="message-sender" v-if="!isOwnMessage(message) && isGroupMessage(message)">
          {{ message.sender.name }}
        </div>
        <div class="message-content" v-if="message.content">
          {{ message.content }}
        </div>
        <div class="message-attachment" v-if="message.attachment">
          <img
            v-if="isImageAttachment(message.attachment)"
            :src="getAttachmentUrl(message.attachment)"
            alt="Image attachment"
            class="attachment-image"
            @click="openAttachment(message.attachment)"
          />
          <div v-else class="file-attachment" @click="openAttachment(message.attachment)">
            <span class="file-icon">📎</span>
            <span class="file-name">{{ message.attachment.originalName }}</span>
          </div>
        </div>
        <div class="message-time">
          {{ formatTime(message.createdAt) }}
          <span class="read-status" v-if="isOwnMessage(message) && message.read">✓</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useChatStore } from '../stores/chat'

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  currentUser: {
    type: Object,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['load-more'])
const chatStore = useChatStore()
const messageListRef = ref(null)
const isLoadingMore = ref(false)
const isTyping = ref(false)
const typingUser = ref('')
const typingTimeout = ref(null)
const lastScrollHeight = ref(0)
const lastScrollPosition = ref(0)
const previousMessageCount = ref(0)
const typingEventHandler = ref(null)

// Call related refs
const callActive = ref(false)
const callType = ref(null) // 'audio' or 'video'
const callStatus = ref('Connecting...')
const callConnected = ref(false)
const callStartTime = ref(null)
const callDuration = ref(0)
const isMuted = ref(false)
const isVideoEnabled = ref(true)
const localVideo = ref(null)
const remoteVideo = ref(null)
const peerConnection = ref(null)
const localStream = ref(null)
const remoteStream = ref(null)
const callInterval = ref(null)
const socket = ref(null)
const audioDevices = ref([])
const selectedAudioDevice = ref(null)

// Add new refs for incoming call handling
const incomingCall = ref(null)
const incomingCallHandler = ref(null)
const incomingCallNew = ref(null)

// Add new refs for screen sharing
const isScreenSharing = ref(false)
const screenStream = ref(null)

// Create a computed property that sorts messages by timestamp
const displayMessages = computed(() => {
  // Sort messages by timestamp in ascending order (oldest first)
  const sortedMessages = [...props.messages].sort((a, b) => {
    const timeA = a.createdAt
      ? new Date(a.createdAt).getTime()
      : new Date(parseInt(a._id.substring(0, 8), 16) * 1000).getTime()
    const timeB = b.createdAt
      ? new Date(b.createdAt).getTime()
      : new Date(parseInt(b._id.substring(0, 8), 16) * 1000).getTime()
    return timeA - timeB // Ascending order (oldest first)
  })

  return sortedMessages
})

const isOwnMessage = (message) => {
  return message.sender?._id === props.currentUser?._id
}

const isGroupMessage = (message) => {
  return !!message.group
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''

  const messageDate = new Date(timestamp)
  const now = new Date()

  // Check if dates are the same day
  const isSameDay = (date1, date2) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    )
  }

  const isToday = isSameDay(messageDate, now)
  const isThisYear = messageDate.getFullYear() === now.getFullYear()

  // Format time in 12-hour format with AM/PM
  let hours = messageDate.getHours()
  const minutes = messageDate.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12 // Convert 0 to 12
  const timeString = `${hours}:${minutes} ${ampm}`

  let formattedDate

  if (isToday) {
    // If message is from today, just show the time
    formattedDate = timeString
  } else if (isThisYear) {
    // If message is from this year, show date and month without year
    const day = messageDate.getDate()
    const month = messageDate.toLocaleString('default', { month: 'short' })
    formattedDate = `${day} ${month}, ${timeString}`
  } else {
    // If message is from a different year, include the year
    const day = messageDate.getDate()
    const month = messageDate.toLocaleString('default', { month: 'short' })
    const year = messageDate.getFullYear()
    formattedDate = `${day} ${month} ${year}, ${timeString}`
  }

  return formattedDate
}

const handleScroll = () => {
  if (!messageListRef.value) return

  // If scrolled to top, load more messages
  if (messageListRef.value.scrollTop < 50 && !isLoadingMore.value) {
    isLoadingMore.value = true

    // Save current scroll position and height before loading more
    lastScrollHeight.value = messageListRef.value.scrollHeight
    lastScrollPosition.value = messageListRef.value.scrollTop
    previousMessageCount.value = props.messages.length

    emit('load-more')

    // Reset loading state after a timeout
    setTimeout(() => {
      isLoadingMore.value = false
    }, 1000)
  }
}

onMounted(() => {
  console.log('MessageList component mounted')

  // Scroll to bottom initially
  setTimeout(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  }, 100)

  // Define the typing event handler function
  const handleTypingEvent = (event) => {
    console.log('Typing event received in MessageList:', event.detail)

    // Show typing indicator
    isTyping.value = true
    typingUser.value = event.detail.name

    // Clear previous timeout
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }

    // Set new timeout to clear typing indicator after 3 seconds
    typingTimeout.value = setTimeout(() => {
      console.log('Clearing typing indicator in MessageList')
      isTyping.value = false
    }, 3000)
  }

  // Listen for typing events
  console.log('Adding user-typing event listener to window')
  window.addEventListener('user-typing', handleTypingEvent)

  // Store the handler for cleanup
  typingEventHandler.value = handleTypingEvent

  // Initialize socket connection for signaling
  socket.value = chatStore.getSocket()

  // Set up socket event listeners for WebRTC signaling
  if (socket.value) {
    socket.value.on('callOffer', handleCallOffer)
    socket.value.on('callAnswer', handleCallAnswer)
    socket.value.on('iceCandidate', handleIceCandidate)
    socket.value.on('callEnded', handleCallEnded)
  }

  // Get available audio devices
  getAudioDevices()

  // Request permission for media devices early
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      // Stop the tracks immediately, we just want the permissions
      stream.getTracks().forEach((track) => track.stop())
      console.log('Media permissions granted')
    })
    .catch((err) => console.error('Error getting media permissions:', err))

  // Define the incoming call event handler
  const handleIncomingCall = (event) => {
    console.log('Incoming call event received in MessageList:', event.detail)

    // Check if this is a call initiated by the current user
    if (event.detail.from === chatStore.user._id) {
      console.log('Ignoring incoming call event for call initiated by current user')
      return
    }

    // Store the incoming call data
    incomingCall.value = {
      from: event.detail.from,
      callType: event.detail.callType,
      offer: event.detail.offer,
    }

    // Play a ringtone sound
    playRingtone()
  }

  // Listen for incoming call events
  console.log('Adding incoming-call event listener to window')
  window.addEventListener('incoming-call', handleIncomingCall)

  // Store the handler for cleanup
  incomingCallHandler.value = handleIncomingCall

  // Add screen share event listener
  const handleScreenShare = (event) => {
    const { from, stream } = event.detail
    console.log('Screen share event received from:', from, stream)

    if (stream && remoteVideo.value) {
      // The other user started sharing their screen
      // The actual stream will come through the existing peer connection
      callStatus.value = 'Remote user is sharing screen'
    } else {
      // The other user stopped sharing their screen
      callStatus.value = 'Connected'
    }
  }

  window.addEventListener('screen-share', handleScreenShare)
})

onUnmounted(() => {
  console.log('MessageList component unmounting, removing event listeners')
  if (typingEventHandler.value) {
    window.removeEventListener('user-typing', typingEventHandler.value)
  }
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value)
  }

  // Clean up event listeners
  if (socket.value) {
    socket.value.off('callOffer', handleCallOffer)
    socket.value.off('callAnswer', handleCallAnswer)
    socket.value.off('iceCandidate', handleIceCandidate)
    socket.value.off('callEnded', handleCallEnded)
  }

  // End any active call when component is unmounted
  if (callActive.value) {
    endCall()
  }

  if (incomingCallHandler.value) {
    window.removeEventListener('incoming-call', incomingCallHandler.value)
  }

  // Stop ringtone if playing
  stopRingtone()

  // Stop screen sharing if active
  if (isScreenSharing.value && screenStream.value) {
    screenStream.value.getTracks().forEach((track) => track.stop())
  }

  // Remove screen share event listener
  window.removeEventListener('screen-share', handleScreenShare)
})

const handleScreenShare = () => {
  if (!messageListRef.value) return

  // Check if a call is already active
  if (messageListRef.value.callActive) {
    // If a call is already active, just toggle screen sharing
    messageListRef.value.toggleScreenShare()
  } else {
    // If no call is active, start a video call first and then share screen
    messageListRef.value.startVideoCall(() => {
      // This callback will be executed after the call is established
      setTimeout(() => {
        messageListRef.value.toggleScreenShare()
      }, 2000) // Give some time for the call to fully connect
    })
  }
}

watch(
  () => props.messages.length,
  async (newLength, oldLength) => {
    await nextTick()

    // If we're loading more messages (older messages)
    if (newLength > oldLength && isLoadingMore.value) {
      console.log('Loading more messages, adjusting scroll position')

      // Calculate how many new messages were added
      const newMessagesCount = newLength - previousMessageCount.value

      if (messageListRef.value) {
        // Get the height of the new messages
        const messageElements = messageListRef.value.querySelectorAll('.message-container')
        let newMessagesHeight = 0

        // Sum up the height of the new messages (they should be at the top)
        for (let i = 0; i < newMessagesCount && i < messageElements.length; i++) {
          newMessagesHeight += messageElements[i].offsetHeight + 16 // 16px for margin-bottom
        }

        // Adjust scroll position to account for new messages
        messageListRef.value.scrollTop = newMessagesHeight
      }
    } else if (newLength > oldLength) {
      // For new messages (sent or received), scroll to bottom
      await nextTick()
      if (messageListRef.value) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight
      }
    }
  },
)

// Add this watch to debug when messages prop changes
// watch(
//   () => props.messages,
//   (newMessages) => {
//     console.log("Messages prop changed:", newMessages.length);
//     console.log("Last message:", newMessages[newMessages.length - 1]);
//   },
//   { deep: true }
// );

const isImageAttachment = (attachment) => {
  if (!attachment || !attachment.mimeType) return false
  return attachment.mimeType.startsWith('image/')
}

const getAttachmentUrl = (attachment) => {
  const apiUrl = 'http://localhost:3000'
  console.log('API URL from env:', apiUrl) // Debug log

  if (!apiUrl) {
    console.warn('VITE_API_URL is not defined in environment variables')
    // Fallback to relative URL if API URL is not available
    return `/uploads/${attachment.filename}`
  }

  return `${apiUrl}/uploads/${attachment.filename}`
}

const openAttachment = (attachment) => {
  const url = getAttachmentUrl(attachment)
  window.open(url, '_blank')
}

// Function to enumerate available audio devices
const getAudioDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioDevices.value = devices.filter((device) => device.kind === 'audioinput')
    console.log('Available audio devices:', audioDevices.value)

    // Select the first device by default
    if (audioDevices.value.length > 0 && !selectedAudioDevice.value) {
      selectedAudioDevice.value = audioDevices.value[0].deviceId
    }
  } catch (error) {
    console.error('Error enumerating audio devices:', error)
  }
}

// Function to start a video call
const startVideoCall = async (callback) => {
  try {
    // Get available audio devices first
    await getAudioDevices()
    await initializeCall('video')
    createOffer()

    // For group calls, we need to send the offer to all members
    if (chatStore.currentChat.type === 'group') {
      console.log('Sending call offer to group:', chatStore.currentChat._id)
      socket.value.emit('callOffer', {
        to: `group:${chatStore.currentChat._id}`,
        from: chatStore.user._id,
        offer: offer,
        callType: 'video',
        isGroup: true,
      })
    } else {
      // ... existing code for direct calls ...
    }

    // ... rest of existing code ...

    // If there's a callback, call it
    if (typeof callback === 'function') {
      callback()
    }
  } catch (error) {
    console.error('Error starting video call:', error)
  }
}

// Function to start an audio call
const startAudioCall = async () => {
  try {
    // Get available audio devices first
    await getAudioDevices()
    await initializeCall('audio')
    createOffer()
  } catch (error) {
    console.error('Failed to start audio call:', error)
    callStatus.value = 'Failed to start call'
  }
}

// Initialize call setup
const initializeCall = async (type) => {
  // Reset any existing call
  if (callActive.value) {
    await endCall()
  }

  callType.value = type
  callActive.value = true
  callStatus.value = 'Initializing...'

  // Get user media with echo cancellation to prevent feedback loops
  // and use the selected audio device if available
  const constraints = {
    audio: {
      deviceId: selectedAudioDevice.value ? { exact: selectedAudioDevice.value } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // Reduce sensitivity to prevent feedback
      volume: 0.8,
    },
    video:
      type === 'video'
        ? {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 },
          }
        : false,
  }

  try {
    console.log('Requesting media with constraints:', constraints)
    localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
    console.log(
      'Got local media stream:',
      localStream.value
        .getTracks()
        .map((t) => `${t.kind} (${t.label})`)
        .join(', '),
    )

    // Set up local video preview
    if (type === 'video' && localVideo.value) {
      localVideo.value.srcObject = localStream.value
    }

    // Create peer connection with comprehensive STUN/TURN servers
    // Including a local TURN server configuration for same-machine testing
    peerConnection.value = new RTCPeerConnection({
      iceServers: [
        // Public STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.sipgate.net:3478' },

        // Local TURN server configuration
        // This assumes you have a TURN server running on your backend
        // You would need to implement this on your NestJS backend
        {
          urls: 'turn:localhost:3000',
          username: 'webrtc',
          credential: 'turnserver',
        },
      ],
      // Use all available ICE candidates
      iceTransportPolicy: 'all',
      // Enable unified plan for better compatibility
      sdpSemantics: 'unified-plan',
      // Improve audio processing
      rtcpMuxPolicy: 'require',
      bundlePolicy: 'max-bundle',
    })

    console.log('Created peer connection with local TURN server')

    // Add local tracks to the connection
    localStream.value.getTracks().forEach((track) => {
      console.log('Adding track to peer connection:', track.kind)
      peerConnection.value.addTrack(track, localStream.value)
    })

    // Set up event handlers with better logging
    peerConnection.value.onicecandidate = (event) => {
      if (event.candidate) {
        // console.log(
        //   "Generated ICE candidate:",
        //   event.candidate.candidate.substring(0, 50) + "..."
        // );
        console.log('Sending ICE candidate to:', incomingCallNew.value)
        sendIceCandidate(event.candidate)
      }
    }

    peerConnection.value.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind)

      if (!remoteStream.value) {
        remoteStream.value = new MediaStream()
        console.log('Created new remote stream')
      }

      // Add the track to the remote stream
      remoteStream.value.addTrack(event.track)
      console.log(
        'Added track to remote stream, now has tracks:',
        remoteStream.value
          .getTracks()
          .map((t) => t.kind)
          .join(', '),
      )

      // Set the remote video source
      if (remoteVideo.value) {
        remoteVideo.value.srcObject = remoteStream.value
        // Ensure audio is enabled and volume is up
        remoteVideo.value.muted = false
        remoteVideo.value.volume = 1.0
        console.log('Set remote video element source, muted=false, volume=1.0')

        // Force audio output to default device
        if (remoteVideo.value.setSinkId) {
          remoteVideo.value
            .setSinkId('default')
            .then(() => console.log('Set audio output to default device'))
            .catch((err) => console.error('Error setting audio output:', err))
        }

        // Ensure audio plays automatically
        remoteVideo.value
          .play()
          .then(() => console.log('Remote video playback started'))
          .catch((err) => console.error('Error starting playback:', err))
      }
    }

    // More detailed connection state logging
    peerConnection.value.onconnectionstatechange = () => {
      console.log('Connection state changed to:', peerConnection.value.connectionState)

      if (peerConnection.value.connectionState === 'connected') {
        callStatus.value = 'Connected'
        startCallTimer()
      } else if (
        ['disconnected', 'failed', 'closed'].includes(peerConnection.value.connectionState)
      ) {
        callStatus.value = 'Disconnected'
        setTimeout(() => endCall(), 2000)
      }
    }

    // Add ice connection state monitoring
    peerConnection.value.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed to:', peerConnection.value.iceConnectionState)

      // Try to restart ICE if it fails
      if (peerConnection.value.iceConnectionState === 'failed') {
        console.log('ICE connection failed, attempting to restart')
        peerConnection.value.restartIce()
      }
    }

    // Monitor signaling state
    peerConnection.value.onsignalingstatechange = () => {
      console.log('Signaling state changed to:', peerConnection.value.signalingState)
    }
  } catch (error) {
    console.error('Error during call initialization:', error)
    callStatus.value = 'Failed to access media devices'
    setTimeout(() => endCall(), 2000)
    throw error
  }
}

// Create and send an offer
const createOffer = async () => {
  if (!peerConnection.value) return

  try {
    callStatus.value = 'Creating offer...'

    // Create offer with audio preferences
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType.value === 'video',
      voiceActivityDetection: true,
    }

    const offer = await peerConnection.value.createOffer(offerOptions)

    await peerConnection.value.setLocalDescription(offer)
    console.log('Set local description (offer)')

    callStatus.value = 'Calling...'

    // Send the offer to the remote peer
    if (chatStore.currentChat) {
      const socket = chatStore.getSocket()
      if (socket) {
        socket.emit('callOffer', {
          to: chatStore.currentChat._id,
          from: chatStore.user._id,
          offer: offer,
          callType: callType.value,
          isGroup: chatStore.currentChat.type === 'group',
        })
        console.log(
          'Sent offer to:',
          chatStore.currentChat._id,
          'isGroup:',
          chatStore.currentChat.type === 'group',
        )
      }
    }
  } catch (error) {
    console.error('Error creating offer:', error)
    callStatus.value = 'Call failed'
    setTimeout(() => endCall(), 2000)
  }
}

// Handle an incoming call offer
const handleCallOffer = async (data) => {
  console.log('Received call offer:', data)

  // Instead of automatically accepting, just store the incoming call data
  // This will trigger the incoming call UI
  incomingCall.value = {
    from: data.from,
    callType: data.callType,
    offer: data.offer,
  }

  // Play ringtone
  playRingtone()
}

// Handle an incoming call answer
const handleCallAnswer = async (data) => {
  try {
    // console.log("Received call answer:", data);

    if (callActive.value && peerConnection.value) {
      await peerConnection.value.setRemoteDescription(new RTCSessionDescription(data.answer))
      console.log('Set remote description (answer)')
      callStatus.value = 'Call connected'
    }
  } catch (error) {
    console.error('Error handling call answer:', error)
    callStatus.value = 'Connection failed'
    setTimeout(() => endCall(), 2000)
  }
}

// Send an ICE candidate to the remote peer
const sendIceCandidate = (candidate) => {
  if (chatStore.currentChat) {
    const socket = chatStore.getSocket()
    if (socket) {
      console.log('Sending ICE candidate to:', {
        to: incomingCallNew.value?.from || chatStore.currentChat._id,
      })
      socket.emit('iceCandidateNew', {
        to: incomingCallNew.value?.from || chatStore.currentChat._id,
        candidate: candidate,
      })
    }
  }
}

// Handle an incoming ICE candidate
const handleIceCandidate = async (data) => {
  try {
    console.log('Received ICE candidate')

    if (callActive.value && peerConnection.value) {
      // Add the ICE candidate to the peer connection
      await peerConnection.value.addIceCandidate(new RTCIceCandidate(data.candidate))
      console.log('Added ICE candidate')
    }
  } catch (error) {
    console.error('Error handling ICE candidate:', error)
  }
}

// Handle call ended event
const handleCallEnded = (data) => {
  console.log('Received call ended:', data)

  // If this is just a decline in a group call, and not from the current user,
  // we should ignore it and let the call continue for others
  if (data.isDecline && data.isGroup && data.from !== chatStore.user._id) {
    console.log('Someone declined the group call, but call continues for others')
    return
  }

  if (callActive.value) {
    callStatus.value = `Call ended: ${data.reason || 'Remote peer disconnected'}`

    setTimeout(() => {
      endCall()
    }, 2000)
  }
}

// End the call
const endCall = async () => {
  console.log('Ending call')

  // Clear the call duration timer
  if (callInterval.value) {
    clearInterval(callInterval.value)
    callInterval.value = null
  }

  // Close the peer connection
  if (peerConnection.value) {
    peerConnection.value.close()
    peerConnection.value = null
  }

  // Stop all local media tracks
  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => {
      track.stop()
      console.log('Stopped local track:', track.kind)
    })
    localStream.value = null
  }

  // Clear the remote stream
  if (remoteStream.value) {
    remoteStream.value = null
  }

  // Clear video elements
  if (localVideo.value) {
    localVideo.value.srcObject = null
  }

  if (remoteVideo.value) {
    remoteVideo.value.srcObject = null
  }

  // Reset call state
  callActive.value = false
  callType.value = null
  callStartTime.value = null
  callDuration.value = 0
  isMuted.value = false
  isVideoEnabled.value = true

  // Notify the remote peer that the call has ended
  if (chatStore.currentChat) {
    const socket = chatStore.getSocket()
    if (socket) {
      // Determine if it's a group call
      const isGroup = chatStore.currentChat.type === 'group'
      socket.emit('callEnded', {
        to: isGroup
          ? `group:${chatStore.currentChat._id}`
          : incomingCallNew.value?.from || chatStore.currentChat._id,
        reason: 'ended',
        isGroup: isGroup,
      })
      console.log(
        'Sent call ended to:',
        isGroup
          ? `group:${chatStore.currentChat._id}`
          : incomingCallNew.value?.from || chatStore.currentChat._id,
      )
    }
  }

  // Stop screen sharing if active
  if (isScreenSharing.value && screenStream.value) {
    screenStream.value.getTracks().forEach((track) => track.stop())
    screenStream.value = null
    isScreenSharing.value = false
  }

  return true
}

// Start the call duration timer
const startCallTimer = () => {
  callStartTime.value = Date.now()
  callInterval.value = setInterval(() => {
    if (callStartTime.value) {
      callDuration.value = Math.floor((Date.now() - callStartTime.value) / 1000)
    }
  }, 1000)
}

// Format the call duration for display
const formatCallDuration = () => {
  const minutes = Math.floor(callDuration.value / 60)
  const seconds = callDuration.value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// Toggle mute state
const toggleMute = () => {
  if (localStream.value) {
    const audioTracks = localStream.value.getAudioTracks()
    if (audioTracks.length > 0) {
      audioTracks[0].enabled = !audioTracks[0].enabled
      isMuted.value = !audioTracks[0].enabled
      console.log('Audio muted:', isMuted.value)
    }
  }
}

// Toggle video state
const toggleVideo = () => {
  if (localStream.value && callType.value === 'video') {
    const videoTracks = localStream.value.getVideoTracks()
    if (videoTracks.length > 0) {
      videoTracks[0].enabled = !videoTracks[0].enabled
      isVideoEnabled.value = videoTracks[0].enabled
      console.log('Video enabled:', isVideoEnabled.value)
    }
  }
}

// Get call recipient name
const getCallRecipientName = () => {
  if (chatStore.currentChat) {
    return chatStore.currentChat.name || 'Group'
  }
  return 'Unknown'
}

// Get call recipient initials
const getCallRecipientInitials = () => {
  const name = getCallRecipientName()
  if (!name) return '?'

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

// Add ringtone functionality
const ringtone = ref(null)

const playRingtone = () => {
  // Create an audio element for the ringtone
  ringtone.value = new Audio('/sounds/ringtone.mp3') // You'll need to add this file
  ringtone.value.loop = true
  ringtone.value.play().catch((err) => console.error('Error playing ringtone:', err))
}

const stopRingtone = () => {
  if (ringtone.value) {
    ringtone.value.pause()
    ringtone.value.currentTime = 0
    ringtone.value = null
  }
}

// Get caller name
const getCallerName = () => {
  if (!incomingCall.value) return 'Unknown'

  const caller = chatStore.users.find((u) => u._id === incomingCall.value.from)
  return caller ? caller.name : 'Unknown User'
}

// Accept incoming call
const acceptCall = async () => {
  try {
    stopRingtone()

    // Initialize call with the received call type
    incomingCallNew.value = incomingCall.value
    await initializeCall(incomingCall.value.callType)

    callStatus.value = 'Connecting...'

    // Set the remote description from the offer
    await peerConnection.value.setRemoteDescription(
      new RTCSessionDescription(incomingCall.value.offer),
    )
    // console.log("Set remote description (offer)");

    // Create an answer
    const answer = await peerConnection.value.createAnswer()
    await peerConnection.value.setLocalDescription(answer)
    // console.log("Set local description (answer)");

    // Send the answer back
    const socket = chatStore.getSocket()
    if (socket) {
      socket.emit('callAnswer', {
        to: incomingCall.value.from,
        from: chatStore.user._id,
        answer: answer,
      })
      console.log('Sent answer to:', incomingCall.value.from)
    }

    // Clear the incoming call data
    incomingCall.value = null
  } catch (error) {
    console.error('Error accepting call:', error)
    callStatus.value = 'Failed to connect'
    setTimeout(() => endCall(), 2000)
  }
}

// Decline incoming call
const declineCall = () => {
  stopRingtone()

  // Send call declined message
  const socket = chatStore.getSocket()
  if (socket && incomingCall.value) {
    // Check if this is a group call
    const isGroupCall = chatStore.currentChat && chatStore.currentChat.type === 'group'

    socket.emit('callEnded', {
      to: incomingCall.value.from,
      reason: 'declined',
      // Add flag to indicate this is just a decline, not ending the whole call
      isDecline: true,
      // Include group information if it's a group call
      isGroup: isGroupCall,
    })

    console.log('Sent call declined to:', incomingCall.value.from, 'isGroup:', isGroupCall)
  }

  // Clear the incoming call data
  incomingCall.value = null
}

// Function to toggle screen sharing
const toggleScreenShare = async () => {
  try {
    if (isScreenSharing.value) {
      // Stop screen sharing
      if (screenStream.value) {
        screenStream.value.getTracks().forEach((track) => track.stop())
        screenStream.value = null
      }

      // Restore video track if video was enabled
      if (isVideoEnabled.value && localStream.value) {
        const videoTrack = localStream.value.getVideoTracks()[0]
        if (videoTrack && peerConnection.value) {
          const senders = peerConnection.value.getSenders()
          const videoSender = senders.find(
            (sender) => sender.track && sender.track.kind === 'video',
          )

          if (videoSender) {
            videoSender.replaceTrack(videoTrack)
          }
        }
      }

      isScreenSharing.value = false

      // Notify the other peer that screen sharing has stopped
      const socket = chatStore.getSocket()
      if (socket) {
        const isGroup = chatStore.currentChat.type === 'group'
        socket.emit('screenShare', {
          to: isGroup
            ? `group:${chatStore.currentChat._id}`
            : incomingCallNew.value?.from || chatStore.currentChat._id,
          from: chatStore.user._id,
          stream: null,
          isGroup: isGroup,
        })
      }
    } else {
      // Start screen sharing
      screenStream.value = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })

      // Replace the video track with the screen track
      if (peerConnection.value) {
        const screenTrack = screenStream.value.getVideoTracks()[0]

        const senders = peerConnection.value.getSenders()
        const videoSender = senders.find((sender) => sender.track && sender.track.kind === 'video')

        if (videoSender && screenTrack) {
          await videoSender.replaceTrack(screenTrack)

          // Update local video preview
          if (localVideo.value) {
            localVideo.value.srcObject = screenStream.value
          }

          isScreenSharing.value = true

          // Notify the other peer about screen sharing
          const socket = chatStore.getSocket()
          if (socket) {
            const isGroup = chatStore.currentChat.type === 'group'
            socket.emit('screenShare', {
              to: isGroup
                ? `group:${chatStore.currentChat._id}`
                : incomingCallNew.value?.from || chatStore.currentChat._id,
              from: chatStore.user._id,
              stream: true,
              isGroup: isGroup,
            })
          }

          // Handle the screen sharing being stopped by the browser UI
          screenTrack.onended = () => {
            toggleScreenShare()
          }
        }
      }
    }
  } catch (error) {
    console.error('Error toggling screen share:', error)
    isScreenSharing.value = false
  }
}

// Expose methods to parent component
defineExpose({
  startVideoCall,
  startAudioCall,
})
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.message-container {
  display: flex;
  margin-bottom: 16px;
}

.own-message {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 12px;
  border-radius: 16px;
  background-color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.own-message .message-bubble {
  background-color: #e8f5e9;
}

.message-sender {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  margin-bottom: 4px;
}

.message-content {
  word-wrap: break-word;
}

.message-time {
  font-size: 0.75rem;
  color: #888;
  margin-top: 4px;
  align-self: flex-end;
  white-space: nowrap;
}

.read-status {
  color: #4caf50;
  margin-left: 4px;
}

.typing-indicator {
  padding: 8px 12px;
  border-radius: 16px;
  background-color: white;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  font-style: italic;
}

.loading-indicator {
  text-align: center;
  padding: 16px;
  color: #666;
}

.message-attachment {
  margin-top: 8px;
}

.attachment-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
}

.file-attachment {
  display: flex;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
}

.file-name {
  font-size: 14px;
  word-break: break-all;
}

.call-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.call-container {
  width: 80%;
  max-width: 800px;
  background-color: #fff;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}

.call-header {
  padding: 16px;
  background-color: #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.call-header h3 {
  margin: 0;
  font-size: 18px;
}

.call-timer,
.call-status {
  font-size: 14px;
  color: #666;
}

.video-container {
  position: relative;
  width: 100%;
  height: 60vh;
  background-color: #000;
}

.remote-video {
  width: 100%;
  height: 100%;
}

.remote-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-video {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 150px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid white;
}

.local-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.audio-call-container {
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.avatar.large {
  width: 120px;
  height: 120px;
  font-size: 48px;
  background-color: #4caf50;
  color: white;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.call-actions {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 16px;
  background-color: #f5f5f5;
}

.call-action-button {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.call-action-button.mute {
  background-color: #2196f3;
  color: white;
}

.call-action-button.video-toggle {
  background-color: #9c27b0;
  color: white;
}

.call-action-button.screen-share {
  background-color: #9c27b0;
  color: white;
}

.call-action-button.end-call {
  background-color: #f44336;
  color: white;
}

.call-action-button:hover {
  transform: scale(1.1);
}

.call-action-button.active {
  background-color: #757575;
}

.call-action-button.screen-share.active {
  background-color: #6a1b9a;
  color: white;
}

/* Add styles for incoming call notification */
.incoming-call-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 1100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.incoming-call-container {
  width: 350px;
  background-color: #fff;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}

.incoming-call-header {
  padding: 20px;
  background-color: #f5f5f5;
  text-align: center;
}

.incoming-call-header h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
}

.caller-info {
  font-size: 16px;
  color: #666;
}

.incoming-call-actions {
  display: flex;
  justify-content: space-around;
  padding: 20px;
  background-color: #f5f5f5;
}

.call-action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.call-action-button svg {
  font-size: 24px;
  margin-bottom: 5px;
}

.call-action-button.accept {
  background-color: #4caf50;
}

.call-action-button.decline {
  background-color: #f44336;
}

.call-action-button:hover {
  transform: scale(1.1);
}
</style>
