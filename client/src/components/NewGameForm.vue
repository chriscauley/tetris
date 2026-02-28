<script setup>
import { ref } from 'vue'

const props = defineProps({
  defaults: Object,
})

const emit = defineEmits(['submit', 'cancel'])

const seedInput = ref('')
const boardHeightInput = ref(props.defaults?.boardHeight ?? 20)
const gravityModeInput = ref(props.defaults?.gravityMode ?? 'normal')
const gameModeInput = ref(props.defaults?.gameMode ?? 'a')
const startLevelInput = ref(props.defaults?.startLevel ?? 1)
const garbageHeightInput = ref(props.defaults?.garbageHeight ?? 0)
const sparsityInput = ref(props.defaults?.sparsity ?? 0)

function onSubmit() {
  emit('submit', {
    seed: seedInput.value.trim() || undefined,
    boardHeight: Math.max(15, Math.min(50, Math.floor(Number(boardHeightInput.value) || 24))),
    gravityMode: gravityModeInput.value,
    gameMode: gameModeInput.value,
    startLevel: Math.max(1, Math.min(10, Math.floor(Number(startLevelInput.value) || 1))),
    garbageHeight: gameModeInput.value === 'b' ? Math.max(0, Math.min(5, Math.floor(Number(garbageHeightInput.value) || 0))) : 0,
    sparsity: gameModeInput.value === 'b' ? Math.max(0, Math.floor(Number(sparsityInput.value) || 0)) : 0,
  })
}
</script>

<template>
  <FormKit type="form" @submit="onSubmit" :actions="false">
    <FormKit
      type="select"
      v-model="gameModeInput"
      label="Mode"
      autofocus
      :options="[
        { value: 'a', label: 'A-Type (Marathon)' },
        { value: 'b', label: 'B-Type (25 Lines)' },
      ]"
    />
    <FormKit
      type="number"
      v-model="startLevelInput"
      label="Starting Level"
      min="1"
      max="10"
    />
    <FormKit
      v-if="gameModeInput === 'b'"
      type="number"
      v-model="garbageHeightInput"
      label="Garbage Height"
      min="0"
      max="5"
    />
    <FormKit
      v-if="gameModeInput === 'b'"
      type="number"
      v-model="sparsityInput"
      label="Sparsity"
      min="0"
      max="5"
    />
    <FormKit
      type="number"
      v-model="boardHeightInput"
      label="Board Height"
      min="15"
      max="50"
    />
    <FormKit
      type="text"
      v-model="seedInput"
      label="Seed"
      placeholder="Leave blank for random"
    />
    <FormKit
      type="select"
      v-model="gravityModeInput"
      label="Gravity"
      :options="[
        { value: 'normal', label: 'Normal' },
        { value: 'cascade', label: 'Cascade' },
        { value: 'sticky', label: 'Sticky' },
      ]"
    />
  </FormKit>
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('cancel')">Cancel</button>
    <button class="btn -primary" @click="onSubmit">Play</button>
  </div>
</template>
