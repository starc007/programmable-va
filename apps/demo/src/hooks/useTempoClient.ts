'use client'

import { useEffect, useState } from 'react'
import { type WalletClient } from 'viem'
import { getProvider, getWalletClient } from '@/lib/provider'

export function useTempoClient(): WalletClient | null {
  const [client, setClient] = useState<WalletClient | null>(null)

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = provider.store as any
    const sync = () => {
      const { accounts } = store.getState()
      const address = accounts[0]?.address ?? null
      setClient(address ? getWalletClient(address) : null)
    }

    sync()
    return store.subscribe((s: { accounts: unknown[] }) => s.accounts, sync)
  }, [])

  return client
}
