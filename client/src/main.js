import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { plugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import './app.css'
import App from './App.vue'
import router from './router/index.js'

createApp(App).use(router).use(VueQueryPlugin).use(plugin, defaultConfig).mount('#app')
