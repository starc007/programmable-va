'use client'

import { Provider, dialog, Storage } from 'accounts'
import { createPublicClient, http } from 'viem'
import { tempoModerato } from 'wagmi/chains'

// Singleton — created once on the client
let _provider: ReturnType<typeof Provider.create> | null = null

export function getProvider() {
  if (typeof window === 'undefined') return null
  if (!_provider) {
    _provider = Provider.create({
      adapter: dialog(),
      testnet: true,
      storage: Storage.idb(),
    })
  }
  return _provider
}

export const publicClient = createPublicClient({
  chain: tempoModerato,
  transport: http('https://rpc.moderato.tempo.xyz'),
})
