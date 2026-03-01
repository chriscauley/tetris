<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import NewGameForm from '../components/NewGameForm.vue'
import UnrestDialog from '../components/UnrestDialog.vue'
import LoginForm from '../components/LoginForm.vue'
import RegisterForm from '../components/RegisterForm.vue'
import { useUser, useLogout } from '../stores/auth.js'

const router = useRouter()
const { user } = useUser()
const { mutate: logout } = useLogout()
const dialogs = reactive({ login: false, register: false })

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
  router.push('/game')
}

const onAuthSuccess = () => {
  dialogs.login = false
  dialogs.register = false
}
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

    <div class="start-menu__form">
      <NewGameForm :defaults :show-cancel="false" @submit="onSubmit" />
    </div>
  </div>

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

.start-menu__form {
  width: 100%;
}
</style>
