'use client'

import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address, type Hex } from 'viem'
import {
  splitForwarderAbi,
  deriveUserTag,
  deriveVirtualAddress,
  type Recipient,
} from '@programmable-vas/sdk'

type Rule = {
  userTag: Hex
  label: string
  recipients: Recipient[]
  virtualAddress: string
}

type Props = {
  forwarder: Address
  masterId: Hex
}

export function RulesEditor({ forwarder, masterId }: Props) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [rules, setRules] = useState<Rule[]>([])
  const [label, setLabel] = useState('')
  const [recipients, setRecipients] = useState<{ addr: string; bps: string }[]>([
    { addr: '', bps: '' },
    { addr: '', bps: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function totalBps() {
    return recipients.reduce((sum, r) => sum + (parseInt(r.bps) || 0), 0)
  }

  async function addRule() {
    if (!address || !publicClient || !walletClient || !label) return
    const total = totalBps()
    if (total !== 10000) {
      setError(`basis points must sum to 10000 (currently ${total})`)
      return
    }
    setError('')
    setSubmitting(true)

    try {
      const userTag = deriveUserTag(label)
      const virtualAddress = deriveVirtualAddress({ masterId, userTag })

      const parsedRecipients: Recipient[] = recipients
        .filter((r) => r.addr && r.bps)
        .map((r) => ({ addr: r.addr as Address, percentBps: parseInt(r.bps) }))

      const { request } = await publicClient.simulateContract({
        address: forwarder,
        abi: splitForwarderAbi,
        functionName: 'setRule',
        args: [userTag as `0x${string}`, parsedRecipients.map(r => ({ addr: r.addr, percentBps: r.percentBps }))],
        account: address,
      })

      const hash = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash })

      setRules((prev) => [...prev, { userTag, label, recipients: parsedRecipients, virtualAddress }])
      setLabel('')
      setRecipients([{ addr: '', bps: '' }, { addr: '', bps: '' }])
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3">2. Create Split Rules</h2>

        <div className="space-y-3 bg-zinc-900 rounded-lg p-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Rule label (used to derive userTag)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. creator-split-v1"
              className="w-full bg-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block">Recipients (basis points, must sum to 10000)</label>
            {recipients.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={r.addr}
                  onChange={(e) => setRecipients((prev) => prev.map((p, j) => j === i ? { ...p, addr: e.target.value } : p))}
                  placeholder="0x... address"
                  className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  value={r.bps}
                  onChange={(e) => setRecipients((prev) => prev.map((p, j) => j === i ? { ...p, bps: e.target.value } : p))}
                  placeholder="bps"
                  className="w-24 bg-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={() => setRecipients((prev) => [...prev, { addr: '', bps: '' }])}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                + add recipient
              </button>
              <span className="text-xs text-zinc-600 ml-auto">
                total: <span className={totalBps() === 10000 ? 'text-green-400' : 'text-yellow-400'}>{totalBps()}</span> / 10000
              </span>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={addRule}
            disabled={submitting || !label || totalBps() !== 10000}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium transition-colors"
          >
            {submitting ? 'submitting…' : 'create rule'}
          </button>
        </div>
      </div>

      {rules.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">Active Rules</h3>
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.userTag} className="bg-zinc-900 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{rule.label}</span>
                  <span className="text-xs font-mono text-zinc-500">{rule.userTag}</span>
                </div>
                <div className="text-xs font-mono text-indigo-400 break-all">
                  Virtual address: {rule.virtualAddress}
                </div>
                <div className="space-y-1">
                  {rule.recipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-zinc-400">{r.addr}</span>
                      <span className="text-zinc-500">{(r.percentBps / 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`/watch/${rule.userTag}`}
                  className="inline-block text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                >
                  watch live splits →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
