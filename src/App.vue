<script setup lang="ts">
import { ref } from 'vue'

import type { Connection } from '@/api/goatcounter'
import { DEMO_CONNECTION, isDemoAddress } from '@/demo'
import { loadConnection, saveConnection } from '@/lib/storage'

import ConnectView from './components/ConnectView.vue'
import DashboardView from './components/DashboardView.vue'

// The demo never touches the connection kept in this browser
const connection = ref<Connection | null>(isDemoAddress() ? DEMO_CONNECTION : loadConnection())

const connect = (value: Connection) => {
  saveConnection(value)
  connection.value = value
}

const disconnect = () => {
  if (connection.value?.demo) {
    // Leaving the demo: back to your own dashboard if you have one, else to the sign-in form
    history.replaceState(null, '', location.pathname)
    connection.value = loadConnection()
    return
  }
  saveConnection(null)
  connection.value = null
}
</script>

<template>
  <DashboardView v-if="connection" :key="connection.demo ? 'demo' : connection.url" :connection @disconnect="disconnect" />
  <ConnectView v-else @connect="connect" />
</template>
