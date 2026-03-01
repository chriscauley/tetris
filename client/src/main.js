import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { plugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import './app.css'
import App from './App.vue'

createApp(App).use(VueQueryPlugin).use(plugin, defaultConfig).mount('#app')
