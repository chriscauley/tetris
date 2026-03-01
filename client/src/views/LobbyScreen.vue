<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import NewGameForm from '../components/NewGameForm.vue'
import UnrestDialog from '../components/UnrestDialog.vue'
import { useGames, useCreateGame, useJoinGame, useChat, useSendMessage } from '../stores/lobby.js'

const router = useRouter()
const { games, isLoading: gamesLoading } = useGames()
const { mutate: createGame } = useCreateGame()
const { mutate: joinGame } = useJoinGame()
const { messages, isLoading: chatLoading } = useChat()
const { mutate: sendMessage } = useSendMessage()

const showCreateDialog = ref(false)
const chatInput = ref('')
const chatListRef = ref(null)

const defaults = {
  playerCount: 2,
  boardHeight: 20,
  gravityMode: 'normal',
  manualShake: false,
  shakeAnimation: false,
  gameMode: 'a',
  startLevel: 1,
  garbageHeight: 0,
  sparsity: 0,
}

const onCreateGame = (data) => {
  data.seed = data.seed?.trim() || undefined
  createGame(data)
  showCreateDialog.value = false
}

const onSend = () => {
  const text = chatInput.value.trim()
  if (!text) return
  sendMessage(text, {
    onSuccess: async () => {
      chatInput.value = ''
      await nextTick()
      if (chatListRef.value) chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    },
  })
}

const gravityLabel = (v) => ({ normal: 'Normal', cascade: 'Cascade', sticky: 'Sticky' })[v] ?? v
const modeLabel = (v) => ({ a: 'A-Type', b: 'B-Type' })[v] ?? v
</script>

<template>
  <div class="lobby">
    <div class="lobby__header">
      <button class="btn -secondary" @click="router.push('/')">Back</button>
      <h2 class="lobby__title">Online Lobby</h2>
    </div>

    <div class="lobby__body">
      <div class="lobby__games">
        <div class="lobby__panel-header">
          <h3>Open Games</h3>
          <button class="btn -primary" @click="showCreateDialog = true">Create Game</button>
        </div>

        <div v-if="gamesLoading" class="lobby__empty">Loading games...</div>
        <div v-else-if="!games.length" class="lobby__empty">No open games. Create one!</div>
        <table v-else class="lobby__table">
          <thead>
            <tr>
              <th>Host</th>
              <th>Mode</th>
              <th>Level</th>
              <th>Height</th>
              <th>Gravity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="game in games" :key="game.id">
              <td>{{ game.host }}</td>
              <td>{{ modeLabel(game.gameMode) }}</td>
              <td>{{ game.startLevel }}</td>
              <td>{{ game.boardHeight }}</td>
              <td>{{ gravityLabel(game.gravityMode) }}</td>
              <td><button class="btn -primary" @click="joinGame(game.id)">Join</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="lobby__chat">
        <h3>Chat</h3>
        <div ref="chatListRef" class="lobby__messages">
          <div v-if="chatLoading" class="lobby__empty">Loading chat...</div>
          <div v-else-if="!messages.length" class="lobby__empty">No messages yet.</div>
          <div v-for="msg in messages" :key="msg.id" class="lobby__message">
            <span class="lobby__message-user">{{ msg.username }}</span>
            <span>{{ msg.message }}</span>
          </div>
        </div>
        <form class="lobby__chat-input" @submit.prevent="onSend">
          <input v-model="chatInput" class="lobby__input" placeholder="Type a message..." />
          <button class="btn -primary" type="submit">Send</button>
        </form>
      </div>
    </div>
  </div>

  <UnrestDialog :open="showCreateDialog" title="Create Game" @close="showCreateDialog = false">
    <NewGameForm :defaults @submit="onCreateGame" @cancel="showCreateDialog = false" />
  </UnrestDialog>
</template>

<style scoped>
@reference "tailwindcss";

.lobby {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 1.5rem;
  color: white;
  font-family: monospace;
}

.lobby__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.lobby__title {
  margin: 0;
}

.lobby__body {
  display: flex;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.lobby__games {
  flex: 2;
  display: flex;
  flex-direction: column;
  @apply bg-neutral-800 border border-neutral-600 rounded-lg p-4;
}

.lobby__chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  @apply bg-neutral-800 border border-neutral-600 rounded-lg p-4;
}

.lobby__panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.lobby__table {
  @apply w-full border-collapse text-sm;
}

.lobby__table th {
  @apply text-left text-neutral-400 pb-2 border-b border-neutral-600;
}

.lobby__table td {
  @apply py-2 border-b border-neutral-700;
}

.lobby__empty {
  @apply text-neutral-500 text-sm py-4 text-center;
}

.lobby__messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.75rem;
  min-height: 0;
}

.lobby__message {
  @apply text-sm;
}

.lobby__message-user {
  @apply text-indigo-400 font-bold mr-2;
}

.lobby__chat-input {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.lobby__input {
  @apply flex-1 px-3 py-1.5 rounded font-mono text-sm bg-gray-900 text-white border border-neutral-600;
}

.lobby__input::placeholder {
  @apply text-neutral-500;
}
</style>
