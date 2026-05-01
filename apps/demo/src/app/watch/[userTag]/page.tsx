'use client'

import { use, useEffect, useState } from 'react'
import { type Address, type Hex, formatUnits } from 'viem'
import { watchSplits } from '@programmable-vas/sdk'
import { publicClient } from '@/lib/provider'
import Link from 'next/link'

type SplitEvent = {
  userTag: Hex
  token: Address
  amount: bigint
  recipientCount: bigint
  at: Date
}

export default function WatchPage({ params }: { params: Promise<{ userTag: string }> }) {
  const { userTag } = use(params)
  const [forwarderAddress, setForwarderAddress] = useState('')
  const [events, setEvents] = useState<SplitEvent[]>([])
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!watching || !forwarderAddress) return

    let stopWatch: (() => void) | null = null
    let active = true

    async function start() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stopWatch = watchSplits(publicClient as any, forwarderAddress as Address, (event) => {
          if (event.userTag.toLowerCase() !== userTag.toLowerCase()) return
          if (active) setEvents((prev) => [{ ...event, at: new Date() }, ...prev])
        })
      } catch (err) {
        if (active) setError(String(err))
      }
    }

    start()

    return () => {
      active = false
      stopWatch?.()
    }
  }, [watching, forwarderAddress, userTag])

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← back
        </Link>
        <h1 className="text-xl font-bold">Live Split Watch</h1>
      </div>

      <div className="bg-zinc-900 rounded-lg p-4 text-xs font-mono space-y-1">
        <div className="text-zinc-500">userTag</div>
        <div className="text-indigo-400">{userTag}</div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Forwarder address</label>
          <input
            value={forwarderAddress}
            onChange={(e) => setForwarderAddress(e.target.value)}
            placeholder="0x..."
            className="w-full bg-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={() => setWatching((w) => !w)}
          disabled={!forwarderAddress}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40 ${
            watching
              ? 'bg-red-900 hover:bg-red-800 text-red-200'
              : 'bg-green-900 hover:bg-green-800 text-green-200'
          }`}
        >
          {watching ? '■ stop watching' : '▶ start watching'}
        </button>

        {watching && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            watching for Split events…
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">
          Split Events {events.length > 0 && `(${events.length})`}
        </h2>

        {events.length === 0 && (
          <div className="text-sm text-zinc-600 py-6 text-center border border-dashed border-zinc-800 rounded-lg">
            No splits yet. Pay the virtual address for this userTag from another wallet.
          </div>
        )}

        {events.map((event, i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{event.at.toLocaleTimeString()}</span>
              <span>{Number(event.recipientCount)} recipients</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">{formatUnits(event.amount, 6)}</span>
              <span className="text-zinc-500 ml-1">pathUSD</span>
            </div>
            <div className="font-mono text-xs text-zinc-500 break-all">
              token: {event.token}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
