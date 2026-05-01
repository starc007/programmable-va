import { mineSalt } from '@programmable-vas/sdk'

const CHUNK = 50_000

self.onmessage = (e: MessageEvent<{ address: string }>) => {
  const { address } = e.data
  let start = 0n

  while (true) {
    const result = mineSalt({ address: address as `0x${string}`, start, count: CHUNK })
    if (result) {
      self.postMessage({ type: 'done', result })
      return
    }
    start += BigInt(CHUNK)
    self.postMessage({ type: 'progress', tried: Number(start) })
  }
}
