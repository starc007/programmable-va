'use client'

import { useState } from 'react'
import { type Address, type Hex } from 'viem'
import { ConnectWallet } from '@/components/ConnectWallet'
import { ForwarderSetup } from '@/components/ForwarderSetup'
import { RulesEditor } from '@/components/RulesEditor'
import { useTempoAccount } from '@/hooks/useTempoAccount'

export default function Home() {
  const { isConnected } = useTempoAccount()
  const [forwarder, setForwarder] = useState<{ address: Address; masterId: Hex } | null>(null)

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Programmable Virtual Addresses</h1>
        <p className="text-sm text-zinc-400">
          TIP-1022 split-routing forwarder on Tempo. Deploy a forwarder, set split rules, and watch
          deposits fan out automatically.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <span className="text-sm text-zinc-500">Tempo</span>
        <ConnectWallet />
      </div>

      {!isConnected && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Connect your wallet to get started.
        </div>
      )}

      {isConnected && !forwarder && (
        <ForwarderSetup
          onForwarderReady={(address, masterId) => setForwarder({ address, masterId })}
        />
      )}

      {isConnected && forwarder && (
        <>
          <div className="bg-zinc-900 rounded-lg p-4 text-xs font-mono space-y-1">
            <div className="text-zinc-500">Forwarder</div>
            <div className="text-zinc-200">{forwarder.address}</div>
            <div className="text-zinc-500 mt-1">masterId</div>
            <div className="text-indigo-400">{forwarder.masterId}</div>
          </div>

          <RulesEditor forwarder={forwarder.address} masterId={forwarder.masterId} />
        </>
      )}
    </main>
  )
}
