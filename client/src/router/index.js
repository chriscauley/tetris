import { createRouter, createWebHistory } from 'vue-router'
import StartMenu from '../views/StartMenu.vue'
import GameScreen from '../views/GameScreen.vue'

export default createRouter({
  history: createWebHistory('/tetris/'),
  routes: [
    { path: '/', component: StartMenu },
    { path: '/game', component: GameScreen },
  ],
})
