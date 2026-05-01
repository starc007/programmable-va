'use client'

import { useEffect, useState } from 'react'
import { getProvider } from '@/lib/provider'
import type { WalletClient } from 'viem'

export function useTempoClient(): WalletClient | null {
  const [client, setClient] = useState<WalletClient | null>(null)

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = provider.store as any
    const sync = () => {
      const { accounts } = store.getState()
      if (accounts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setClient(provider.getClient() as any)
      } else {
        setClient(null)
      }
    }

    sync()
    return store.subscribe((s: { accounts: unknown[] }) => s.accounts, sync)
  }, [])

  return client
}
