'use client'

import { useEffect, useState } from 'react'
import { getProvider } from '@/lib/provider'
import type { Address } from 'viem'

type AccountState = {
  address: Address | null
  isConnected: boolean
  isConnecting: boolean
}

export function useTempoAccount(): AccountState & {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
} {
  const [state, setState] = useState<AccountState>({
    address: null,
    isConnected: false,
    isConnecting: false,
  })

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = provider.store as any
    const sync = () => {
      const { accounts } = store.getState()
      const addr = accounts[0]?.address ?? null
      setState({ address: addr as Address | null, isConnected: !!addr, isConnecting: false })
    }

    sync()
    return store.subscribe((s: { accounts: unknown[] }) => s.accounts, sync)
  }, [])

  async function connect() {
    const provider = getProvider()
    if (!provider) return
    setState((s) => ({ ...s, isConnecting: true }))
    try {
      await provider.request({ method: 'wallet_connect' })
    } catch {
      setState((s) => ({ ...s, isConnecting: false }))
    }
  }

  async function disconnect() {
    const provider = getProvider()
    if (!provider) return
    await provider.request({ method: 'wallet_disconnect' })
  }

  return { ...state, connect, disconnect }
}
