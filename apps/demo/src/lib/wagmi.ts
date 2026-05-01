'use client'

import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { tempoModerato } from 'wagmi/chains'

export const config = createConfig({
  chains: [tempoModerato],
  connectors: [injected()],
  transports: {
    [tempoModerato.id]: http('https://rpc.moderato.tempo.xyz'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
