import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Mppx, tempo } from 'mppx/server'
import { deriveUserTag, deriveVirtualAddress } from '@programmable-vas/sdk'

interface Env {
  MPP_SECRET_KEY: string
  MASTER_ID: string
  FORWARDER_ADDRESS: string
  TOKEN_ADDRESS: string
}

// All items share one splitKey → one userTag → one rule to configure in the forwarder
const SPLIT_KEY = 'mpp-store'

const CATALOG = [
  {
    id: 'report-q1-2026',
    title: 'Q1 2026 Ecosystem Report',
    description: 'Deep dive into Tempo protocol growth, TVL, and developer activity.',
    price: '0.10',
    content: 'Full report: Tempo TVL grew 340% in Q1 2026. 1,200 new wallets onboarded. Top dApps: split-routing forwarders, MPP-gated APIs, programmable virtual addresses.',
  },
  {
    id: 'tutorial-tip1022',
    title: 'TIP-1022 Integration Guide',
    description: 'Step-by-step guide to integrating virtual addresses in your dApp.',
    price: '0.05',
    content: 'Step 1: Deploy SplitForwarder via CREATE2 factory. Step 2: Mine TIP-1022 registration salt with VirtualMaster.mineSaltAsync. Step 3: Call register(salt). Step 4: Derive virtual addresses with VirtualAddress.from({ masterId, userTag }).',
  },
  {
    id: 'alpha-call-may',
    title: 'May Alpha Call Notes',
    description: 'Key insights and signals from the May alpha call.',
    price: '0.25',
    content: 'Key signals: programmable routing primitives gaining traction, keeper incentive models being explored, MPP + VA composability confirmed working end-to-end.',
  },
]

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*', exposeHeaders: ['WWW-Authenticate', 'Payment-Receipt'] }))

// List all catalog items with their virtual addresses
app.get('/', (c) => {
  const masterId = c.env.MASTER_ID as `0x${string}`
  return c.json({
    service: 'programmable-vas-mpp-service',
    description: 'MPP-gated content — payments route through programmable virtual addresses',
    forwarder: c.env.FORWARDER_ADDRESS,
    masterId,
    items: CATALOG.map((item) => {
      const userTag = deriveUserTag(SPLIT_KEY)
      const virtualAddress = deriveVirtualAddress({ masterId, userTag })
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        price: `${item.price} pathUSD`,
        userTag,
        virtualAddress,
        endpoint: `/content/${item.id}`,
      }
    }),
  })
})

// MPP-gated content endpoint
app.get('/content/:id', async (c) => {
  const { id } = c.req.param()
  const item = CATALOG.find((i) => i.id === id)
  if (!item) return c.json({ error: 'Not found' }, 404)

  const masterId = c.env.MASTER_ID as `0x${string}`
  const userTag = deriveUserTag(SPLIT_KEY)
  const virtualAddress = deriveVirtualAddress({ masterId, userTag })

  const mppx = Mppx.create({
    secretKey: c.env.MPP_SECRET_KEY,
    methods: [
      tempo.charge({
        currency: c.env.TOKEN_ADDRESS as `0x${string}`,
        // Payment goes directly to the virtual address — TIP-1022 routes to forwarder
        recipient: virtualAddress as `0x${string}`,
        testnet: true,
        html: true,
        feePayer: true,
      }),
    ],
  })

  const result = await mppx.charge({
    amount: item.price,
    description: item.title,
  })(c.req.raw)

  if (result.status === 402) return result.challenge

  return result.withReceipt(
    c.json({
      id: item.id,
      title: item.title,
      content: item.content,
      paymentRoutedThrough: {
        virtualAddress,
        userTag,
        forwarder: c.env.FORWARDER_ADDRESS,
        note: 'Payment auto-routed via TIP-1022 → SplitForwarder → recipients',
      },
    }),
  )
})

// Show virtual address + userTag for any item (no payment needed)
app.get('/address/:id', (c) => {
  const { id } = c.req.param()
  const item = CATALOG.find((i) => i.id === id)
  if (!item) return c.json({ error: 'Not found' }, 404)

  const masterId = c.env.MASTER_ID as `0x${string}`
  const userTag = deriveUserTag(SPLIT_KEY)
  const virtualAddress = deriveVirtualAddress({ masterId, userTag })

  return c.json({ id, userTag, virtualAddress, masterId })
})

export default { fetch: app.fetch }
