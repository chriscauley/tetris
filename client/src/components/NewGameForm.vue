<script setup>
import { reactive } from 'vue'

const props = defineProps({
  defaults: Object,
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({
  seed: '',
  boardHeight: props.defaults?.boardHeight ?? 20,
  gravityMode: props.defaults?.gravityMode ?? 'normal',
  gameMode: props.defaults?.gameMode ?? 'a',
  startLevel: props.defaults?.startLevel ?? 1,
  garbageHeight: props.defaults?.garbageHeight ?? 0,
  sparsity: props.defaults?.sparsity ?? 0,
})

function onSubmit() {
  emit('submit', {
    seed: form.seed.trim() || undefined,
    boardHeight: Math.max(15, Math.min(50, Math.floor(Number(form.boardHeight) || 24))),
    gravityMode: form.gravityMode,
    gameMode: form.gameMode,
    startLevel: Math.max(1, Math.min(10, Math.floor(Number(form.startLevel) || 1))),
    garbageHeight: form.gameMode === 'b' ? Math.max(0, Math.min(5, Math.floor(Number(form.garbageHeight) || 0))) : 0,
    sparsity: form.gameMode === 'b' ? Math.max(0, Math.floor(Number(form.sparsity) || 0)) : 0,
  })
}

const gameModeOptions = [
  { value: 'a', label: 'A-Type (Marathon)' },
  { value: 'b', label: 'B-Type (25 Lines)' },
]

const gravityOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'cascade', label: 'Cascade' },
  { value: 'sticky', label: 'Sticky' },
]
</script>

<template>
  <FormKit v-model="form" type="form" :actions="false" @submit="onSubmit">
    <FormKit type="select" name="gameMode" label="Mode" autofocus :options="gameModeOptions" />
    <FormKit type="number" name="startLevel" label="Starting Level" min="1" max="10" />
    <fieldset v-if="form.gameMode === 'b'">
      <legend>B-Type Options</legend>
      <div class="grid gap-4">
        <FormKit type="number" name="garbageHeight" label="Garbage Height" min="0" max="5" />
        <FormKit type="number" name="sparsity" label="Sparsity" min="0" max="5" />
      </div>
    </fieldset>
    <FormKit type="number" name="boardHeight" label="Board Height" min="15" max="50" />
    <FormKit type="text" name="seed" label="Seed" placeholder="Leave blank for random" />
    <FormKit type="select" name="gravityMode" label="Gravity" :options="gravityOptions" />
  </FormKit>
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('cancel')">Cancel</button>
    <button class="btn -primary" @click="onSubmit">Play</button>
  </div>
</template>
