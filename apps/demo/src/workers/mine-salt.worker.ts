import { mineSalt } from '@programmable-vas/sdk'

const CHUNK = 100_000

self.onmessage = (e: MessageEvent<{ address: string; start: number; stride: number }>) => {
  const { address, start, stride } = e.data
  let current = BigInt(start)
  const bigStride = BigInt(stride)

  while (true) {
    const result = mineSalt({ address: address as `0x${string}`, start: current, count: CHUNK })
    if (result) {
      self.postMessage({ type: 'done', result })
      return
    }
    current += bigStride
    self.postMessage({ type: 'progress', tried: Number(current) })
  }
}
