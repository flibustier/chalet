<script setup lang="ts">
import { ref } from 'vue'

import type { Connection } from '@/api/goatcounter'
import { loadConnection, saveConnection } from '@/lib/storage'

import ConnectView from './components/ConnectView.vue'
import DashboardView from './components/DashboardView.vue'

const connection = ref<Connection | null>(loadConnection())

const connect = (value: Connection) => {
  saveConnection(value)
  connection.value = value
}

const disconnect = () => {
  saveConnection(null)
  connection.value = null
}
</script>

<template>
  <DashboardView v-if="connection" :connection @disconnect="disconnect" />
  <ConnectView v-else @connect="connect" />
</template>
