<script setup>
import { ref, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import NewGameForm from '../components/NewGameForm.vue'
import UnrestDialog from '../components/UnrestDialog.vue'
import LoginForm from '../components/LoginForm.vue'
import RegisterForm from '../components/RegisterForm.vue'
import { useUser, useLogout } from '../stores/auth.js'

const router = useRouter()
const { user } = useUser()
const { mutate: logout } = useLogout()
const dialogs = reactive({ login: false, register: false, localGame: false })
const onlineError = ref(null)

let defaults = {
  playerCount: 1,
  boardHeight: 20,
  gravityMode: 'normal',
  manualShake: false,
  shakeAnimation: false,
  gameMode: 'a',
  startLevel: 1,
  garbageHeight: 0,
  sparsity: 0,
}
try {
  const saved = JSON.parse(localStorage.getItem('tetris-settings'))
  if (saved) defaults = { ...defaults, ...saved }
} catch {}

const onSubmit = (data) => {
  data.seed = data.seed?.trim() || undefined
  localStorage.setItem('tetris-settings', JSON.stringify(data))
  dialogs.localGame = false
  router.push('/game')
}

const onAuthSuccess = () => {
  dialogs.login = false
  dialogs.register = false
  onlineError.value = null
}

const goOnline = () => {
  if (!user.value) {
    onlineError.value = 'You must log in to continue'
    return
  }
  router.push('/lobby')
}

watch(user, (u) => {
  if (u) onlineError.value = null
})
</script>

<template>
  <div class="start-menu">
    <h1 class="start-menu__title">TETRIS</h1>

    <div class="start-menu__auth">
      <template v-if="user">
        <span class="text-neutral-400 text-sm font-mono">{{ user.username }}</span>
        <button class="btn -secondary" @click="logout()">Log Out</button>
      </template>
      <template v-else>
        <button class="btn -secondary" @click="dialogs.login = true">Log In</button>
        <button class="btn -secondary" @click="dialogs.register = true">Sign Up</button>
      </template>
    </div>

    <div class="start-menu__actions">
      <button class="btn -primary start-menu__play-btn" @click="dialogs.localGame = true">Local Game</button>
      <button class="btn -primary start-menu__play-btn" @click="goOnline">Online Game</button>
      <p v-if="onlineError" class="start-menu__error">{{ onlineError }}</p>
    </div>
  </div>

  <UnrestDialog :open="dialogs.localGame" title="New Game" @close="dialogs.localGame = false">
    <NewGameForm :defaults @submit="onSubmit" @cancel="dialogs.localGame = false" />
  </UnrestDialog>

  <UnrestDialog :open="dialogs.login" title="Log In" @close="dialogs.login = false">
    <LoginForm @success="onAuthSuccess" @cancel="dialogs.login = false" />
  </UnrestDialog>

  <UnrestDialog :open="dialogs.register" title="Sign Up" @close="dialogs.register = false">
    <RegisterForm @success="onAuthSuccess" @cancel="dialogs.register = false" />
  </UnrestDialog>
</template>

<style scoped>
.start-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  max-width: 480px;
  margin: 0 auto;
}

.start-menu__title {
  font-size: 3rem;
  font-weight: bold;
  letter-spacing: 0.2em;
  margin-bottom: 1.5rem;
  color: white;
  font-family: monospace;
}

.start-menu__auth {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.start-menu__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  align-items: center;
}

.start-menu__play-btn {
  width: 100%;
  max-width: 280px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

.start-menu__error {
  color: #f87171;
  font-size: 0.875rem;
  font-family: monospace;
  margin-top: 0.25rem;
}
</style>
