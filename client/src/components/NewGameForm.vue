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
    boardHeight: form.boardHeight,
    gravityMode: form.gravityMode,
    gameMode: form.gameMode,
    startLevel: form.startLevel,
    garbageHeight: form.gameMode === 'b' ? form.garbageHeight : 0,
    sparsity: form.gameMode === 'b' ? form.sparsity : 0,
  })
}

const range = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i)

const startLevelOptions = range(1, 10)
const garbageHeightOptions = range(0, 5)
const sparsityOptions = range(0, 5)
const boardHeightOptions = range(15, 50)

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
    <FormKit type="select" name="startLevel" label="Starting Level" number :options="startLevelOptions" />
    <fieldset v-if="form.gameMode === 'b'">
      <legend>B-Type Options</legend>
      <div class="grid gap-4">
        <FormKit type="select" name="garbageHeight" label="Garbage Height" number :options="garbageHeightOptions" />
        <FormKit type="select" name="sparsity" label="Sparsity" number :options="sparsityOptions" />
      </div>
    </fieldset>
    <FormKit type="select" name="boardHeight" label="Board Height" number :options="boardHeightOptions" />
    <FormKit type="text" name="seed" label="Seed" placeholder="Leave blank for random" />
    <FormKit type="select" name="gravityMode" label="Gravity" :options="gravityOptions" />
  </FormKit>
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('cancel')">Cancel</button>
    <button class="btn -primary" @click="onSubmit">Play</button>
  </div>
</template>
