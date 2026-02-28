import { createApp } from 'vue'
import { plugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import './app.css'
import App from './App.vue'

createApp(App).use(plugin, defaultConfig).mount('#app')
