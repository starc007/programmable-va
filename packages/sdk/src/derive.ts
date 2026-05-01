import { VirtualAddress, VirtualMaster } from 'ox/tempo'
import type { Hex } from 'viem'
import { keccak256, toBytes, concat, pad } from 'viem'

export { VirtualMaster }

/** Derive a TIP-1022 virtual address from masterId + userTag. */
export function deriveVirtualAddress(params: {
  masterId: Hex
  userTag: Hex
}): `0x${string}` {
  return VirtualAddress.from(params) as `0x${string}`
}

/** Parse masterId and userTag from a virtual address. */
export function parseVirtualAddress(address: string) {
  return VirtualAddress.parse(address)
}

/**
 * Derive a deterministic 6-byte userTag from any string key.
 * Useful for per-user or per-challenge tags.
 */
export function deriveUserTag(key: string): Hex {
  const hash = keccak256(toBytes(key))
  return `0x${hash.slice(2, 14)}` as Hex // first 6 bytes
}

/**
 * Mine a valid registration salt for a given forwarder address.
 * Requires first 4 bytes of keccak256(address || salt) to be zero.
 * Runs up to `count` iterations starting from `start`.
 */
export function mineSalt(params: {
  address: `0x${string}`
  start?: bigint
  count: number
}) {
  return VirtualMaster.mineSalt(params)
}
