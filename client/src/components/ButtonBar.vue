<script setup>
defineProps({
  user: Object,
  playerCount: Number,
})

defineEmits([
  'new-game',
  'copy-state',
  'show-state',
  'copy-replay',
  'show-replay',
  'load-replay',
  'show-replay-tests',
  'show-controls',
  'show-debug',
  'login',
  'register',
  'logout',
])
</script>

<template>
  <div class="btn-row">
    <template v-if="user">
      <span class="text-neutral-400 text-sm font-mono self-center">{{ user.username }}</span>
      <button class="btn -secondary" @click="$emit('logout')">Log Out</button>
    </template>
    <template v-else>
      <button class="btn -secondary" @click="$emit('login')">Log In</button>
      <button class="btn -secondary" @click="$emit('register')">Sign Up</button>
    </template>
    <button class="btn -secondary" @click="$emit('new-game')">New Game</button>
    <template v-if="playerCount === 1">
      <button class="btn -secondary" @click="$emit('copy-state')">Copy State</button>
      <button class="btn -secondary" @click="$emit('show-state')">Show State</button>
      <button class="btn -secondary" @click="$emit('copy-replay')">Copy Replay</button>
      <button class="btn -secondary" @click="$emit('show-replay')">Show Replay</button>
      <button class="btn -secondary" @click="$emit('load-replay')">Load Replay</button>
      <button class="btn -secondary" @click="$emit('show-replay-tests')">Replay Tests</button>
      <button class="btn -secondary" @click="$emit('show-controls')">Controls</button>
      <button class="btn -secondary" @click="$emit('show-debug')">Debug</button>
    </template>
  </div>
</template>
