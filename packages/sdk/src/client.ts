import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  encodePacked,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
} from 'viem'
import { splitForwarderAbi } from './abi.js'
import type { Recipient, SplitRule } from './types.js'

export const tempoTestnet = {
  id: 42431,
  name: 'Moderato (Tempo Testnet)',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.moderato.tempo.xyz'] },
  },
} as const satisfies Chain

export const tempoMainnet = {
  id: 4217,
  name: 'Tempo',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.tempo.xyz'] },
  },
} as const satisfies Chain

export const pathUsd = '0x20c0000000000000000000000000000000000000' as Address

export function createForwarderClient(params: {
  address: Address
  publicClient: PublicClient
  walletClient?: WalletClient
}) {
  return getContract({
    address: params.address,
    abi: splitForwarderAbi,
    client: {
      public: params.publicClient,
      wallet: params.walletClient,
    },
  })
}

export function makeDepositId(txHash: Hex, logIndex: number): Hex {
  return keccak256(encodePacked(['bytes32', 'uint256'], [txHash, BigInt(logIndex)]))
}

export async function getRule(
  publicClient: PublicClient,
  forwarder: Address,
  userTag: Hex,
): Promise<SplitRule> {
  const [recipients, createdAt, active] = await publicClient.readContract({
    address: forwarder,
    abi: splitForwarderAbi,
    functionName: 'getRule',
    args: [userTag as `0x${string}`],
  })
  return {
    recipients: recipients.map((r) => ({ addr: r.addr, percentBps: r.percentBps })),
    createdAt,
    active,
  }
}

export async function setRule(
  walletClient: WalletClient,
  publicClient: PublicClient,
  forwarder: Address,
  userTag: Hex,
  recipients: Recipient[],
): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    address: forwarder,
    abi: splitForwarderAbi,
    functionName: 'setRule',
    args: [
      userTag as `0x${string}`,
      recipients.map((r) => ({ addr: r.addr, percentBps: r.percentBps })),
    ],
    account: walletClient.account,
  })
  return walletClient.writeContract(request)
}

export async function registerForwarder(
  walletClient: WalletClient,
  publicClient: PublicClient,
  forwarder: Address,
  salt: Hex,
): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    address: forwarder,
    abi: splitForwarderAbi,
    functionName: 'register',
    args: [salt],
    account: walletClient.account,
  })
  return walletClient.writeContract(request)
}
