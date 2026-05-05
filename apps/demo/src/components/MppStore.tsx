'use client'

import { useEffect, useState } from 'react'
import { Mppx, tempo } from 'mppx/client'
import { useTempoAccount } from '@/hooks/useTempoAccount'

const MPP_SERVICE_URL = 'http://localhost:8788'

type CatalogItem = {
  id: string
  title: string
  description: string
  price: string
  userTag: string
  virtualAddress: string
  endpoint: string
}

type ContentResult = {
  id: string
  title: string
  content: string
  paymentRoutedThrough: {
    virtualAddress: string
    userTag: string
    forwarder: string
    note: string
  }
}

export function MppStore() {
  const { address } = useTempoAccount()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState<Record<string, ContentResult>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`${MPP_SERVICE_URL}/`)
      .then((r) => r.json())
      .then((data: { items: CatalogItem[] }) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  async function purchase(item: CatalogItem) {
    if (!address) return
    setPurchasing(item.id)
    setErrors((e) => ({ ...e, [item.id]: '' }))

    const mppx = Mppx.create({
      methods: [tempo({ account: address })],
      polyfill: false,
    })

    try {
      const res = await mppx.fetch(`${MPP_SERVICE_URL}${item.endpoint}`)
      if (!res.ok) {
        const text = await res.text()
        setErrors((e) => ({ ...e, [item.id]: `Error ${res.status}: ${text}` }))
        return
      }
      const data = (await res.json()) as ContentResult
      setUnlocked((u) => ({ ...u, [item.id]: data }))
    } catch (err) {
      setErrors((e) => ({ ...e, [item.id]: String(err) }))
    } finally {
      Mppx.restore()
      setPurchasing(null)
    }
  }

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading catalog…</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-zinc-500">
        Could not load catalog. Make sure the mpp-service is running on port 8788.
        <br />
        <code className="text-xs text-zinc-400">cd packages/mpp-service && npx wrangler dev --port 8788</code>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const content = unlocked[item.id]
        const err = errors[item.id]
        const busy = purchasing === item.id

        return (
          <div key={item.id} className="bg-zinc-900 rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{item.description}</div>
              </div>
              <span className="shrink-0 text-sm font-mono text-indigo-400">{item.price}</span>
            </div>

            <div className="text-xs font-mono text-zinc-600 space-y-0.5">
              <div>userTag: <span className="text-zinc-400">{item.userTag}</span></div>
              <div className="break-all">virtual address: <span className="text-zinc-400">{item.virtualAddress}</span></div>
            </div>

            {content ? (
              <div className="space-y-2">
                <div className="bg-zinc-800 rounded p-3 text-sm text-zinc-200 leading-relaxed">
                  {content.content}
                </div>
                <div className="text-xs text-zinc-600">
                  Payment routed: {content.paymentRoutedThrough.note}
                </div>
                <a
                  href={`/watch/${item.userTag}`}
                  className="inline-block text-xs text-indigo-400 hover:text-indigo-300"
                >
                  watch splits for this VA →
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => purchase(item)}
                  disabled={busy}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium transition-colors"
                >
                  {busy ? 'paying…' : `Buy for ${item.price}`}
                </button>
                <a
                  href={`/watch/${item.userTag}`}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  watch live splits →
                </a>
              </div>
            )}

            {err && <p className="text-xs text-red-400 break-all">{err}</p>}
          </div>
        )
      })}
    </div>
  )
}
