import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faComments,
  faUsers,
  faRobot,
  faPaperPlane,
  faPaperclip,
  faVideo,
  faStop,
  faExpand,
  faCompress,
  faTimes,
  faEllipsisV,
  faSearch,
} from '@fortawesome/free-solid-svg-icons'

import App from './App.vue'

// Add icons to the library
library.add(
  faComments,
  faUsers,
  faRobot,
  faPaperPlane,
  faPaperclip,
  faVideo,
  faStop,
  faExpand,
  faCompress,
  faTimes,
  faEllipsisV,
  faSearch,
)

const app = createApp(App)

app.use(createPinia())
// Register Font Awesome component globally
app.component('font-awesome-icon', FontAwesomeIcon)

app.mount('#app')
