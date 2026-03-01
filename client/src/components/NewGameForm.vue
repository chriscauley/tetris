<script setup>
import { reactive } from 'vue'

const props = defineProps({
  defaults: Object,
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({ ...props.defaults })

const onSubmit = () => emit('submit', form)

const range = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i)

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
    <FormKit type="select" name="startLevel" label="Starting Level" number :options="range(1, 10)" />
    <fieldset v-if="form.gameMode === 'b'">
      <legend>B-Type Options</legend>
      <div class="grid gap-4">
        <FormKit type="select" name="garbageHeight" label="Garbage Height" number :options="range(0, 5)" />
        <FormKit type="select" name="sparsity" label="Sparsity" number :options="range(0, 5)" />
      </div>
    </fieldset>
    <FormKit type="select" name="boardHeight" label="Board Height" number :options="range(15, 50)" />
    <FormKit type="text" name="seed" label="Seed" placeholder="Leave blank for random" />
    <FormKit type="select" name="gravityMode" label="Gravity" :options="gravityOptions" />
    <FormKit v-if="form.gravityMode !== 'normal'" type="checkbox" name="manualShake" label="Manual Shake" />
  </FormKit>
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('cancel')">Cancel</button>
    <button class="btn -primary" @click="onSubmit">Play</button>
  </div>
</template>
