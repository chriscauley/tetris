<script setup>
import { reactive, ref } from 'vue'

const ACTION_LABELS = {
  left: 'Move Left',
  right: 'Move Right',
  softdrop: 'Soft Drop',
  rotate_cw: 'Rotate CW',
  rotate_ccw: 'Rotate CCW',
  harddrop: 'Hard Drop',
  hold: 'Hold',
  shake: 'Shake',
}

const CODE_DISPLAY = {
  ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193',
  Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
}

const displayCode = (code) => CODE_DISPLAY[code] || code.replace(/^Key/, '').replace(/^Digit/, '')

const props = defineProps({ defaults: Object })
const emit = defineEmits(['submit', 'cancel'])

const keyMap = reactive(Object.fromEntries(
  Object.entries(props.defaults).map(([action, codes]) => [action, [...codes]])
))
const listening = ref(null)

const startListening = (action) => { listening.value = action }

const onCapture = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const action = listening.value
  if (!action) return
  if (e.code === 'Escape') { listening.value = null; return }
  // Remove this code from any other action
  for (const codes of Object.values(keyMap)) {
    const idx = codes.indexOf(e.code)
    if (idx !== -1) codes.splice(idx, 1)
  }
  if (!keyMap[action].includes(e.code)) keyMap[action].push(e.code)
  listening.value = null
}

const removeCode = (action, code) => {
  const codes = keyMap[action]
  const idx = codes.indexOf(code)
  if (idx !== -1) codes.splice(idx, 1)
}

const onSubmit = () => emit('submit', Object.fromEntries(
  Object.entries(keyMap).map(([action, codes]) => [action, [...codes]])
))
</script>

<template>
  <div class="controls-form" @keydown="listening ? onCapture($event) : null">
    <div v-for="(codes, action) in keyMap" :key="action" class="controls-row">
      <span class="controls-label">{{ ACTION_LABELS[action] || action }}</span>
      <div class="controls-keys">
        <span v-for="code in codes" :key="code" class="key-tag">
          {{ displayCode(code) }}
          <button class="key-remove" type="button" @click="removeCode(action, code)">&times;</button>
        </span>
        <button v-if="listening !== action" class="btn -small -secondary" type="button" @click="startListening(action)">+</button>
        <span v-else class="key-listening">Press a key...</span>
      </div>
    </div>
  </div>
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('cancel')">Cancel</button>
    <button class="btn -primary" type="button" @click="onSubmit">Save</button>
  </div>
</template>

<style scoped>
.controls-form { display: flex; flex-direction: column; gap: 0.5rem; }
.controls-row { display: flex; align-items: center; gap: 0.75rem; }
.controls-label { width: 7rem; text-align: right; font-size: 0.85rem; color: #a3a3a3; flex-shrink: 0; }
.controls-keys { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
.key-tag { display: inline-flex; align-items: center; gap: 0.25rem; background: #404040; color: #e5e5e5; padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; }
.key-remove { background: none; border: none; color: #a3a3a3; cursor: pointer; padding: 0 0.15rem; font-size: 1rem; line-height: 1; }
.key-remove:hover { color: #ef4444; }
.key-listening { font-size: 0.8rem; color: #facc15; }
</style>
