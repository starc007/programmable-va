import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  tempoTestnet,
  getPendingDeposits,
  splitForwarderAbi,
} from '@programmable-vas/sdk'
import type { DepositEvent } from '@programmable-vas/sdk'
import type { Env } from './types.js'

const BLOCK_LAG = 2n
let lastProcessedBlock: bigint | null = null

export async function runCron(env: Env): Promise<void> {
  const forwarder = env.FORWARDER_ADDRESS as Address
  const token = env.TOKEN_ADDRESS as Address

  const publicClient = createPublicClient({
    chain: tempoTestnet,
    transport: http(env.RPC_URL),
  })

  const currentBlock = await publicClient.getBlockNumber()
  const toBlock = currentBlock - BLOCK_LAG
  const fromBlock = lastProcessedBlock !== null ? lastProcessedBlock + 1n : toBlock - 100n

  if (fromBlock > toBlock) return

  const deposits = await getPendingDeposits(publicClient, forwarder, token, fromBlock, toBlock)

  if (deposits.length > 0) {
    await processBatch(env, publicClient, forwarder, deposits)
  }

  lastProcessedBlock = toBlock
}

async function processBatch(
  env: Env,
  publicClient: ReturnType<typeof createPublicClient>,
  forwarder: Address,
  deposits: DepositEvent[],
): Promise<void> {
  const account = privateKeyToAccount(env.KEEPER_PRIVATE_KEY as Hex)
  const walletClient = createWalletClient({
    account,
    chain: tempoTestnet,
    transport: http(env.RPC_URL),
  })

  // filter out already-processed deposits on-chain
  const unprocessed = await filterUnprocessed(publicClient, forwarder, deposits)
  if (unprocessed.length === 0) return

  console.log(`processing ${unprocessed.length} deposit(s)`)

  const { request } = await publicClient.simulateContract({
    address: forwarder,
    abi: splitForwarderAbi,
    functionName: 'processBatch',
    args: [
      unprocessed.map((d) => d.userTag as `0x${string}`),
      unprocessed.map((d) => d.token),
      unprocessed.map((d) => d.amount),
      unprocessed.map((d) => d.depositId as `0x${string}`),
    ],
    account,
  })

  const hash = await walletClient.writeContract(request)
  console.log(`processBatch tx: ${hash}`)
}

async function filterUnprocessed(
  publicClient: ReturnType<typeof createPublicClient>,
  forwarder: Address,
  deposits: DepositEvent[],
): Promise<DepositEvent[]> {
  const results = await Promise.all(
    deposits.map(async (d) => {
      const isProcessed = await publicClient.readContract({
        address: forwarder,
        abi: splitForwarderAbi,
        functionName: 'processed',
        args: [
          // keccak256(abi.encode(userTag, depositId)) - matches contract logic
          // We pass depositId directly; contract does its own key derivation
          // so we need the same key the contract uses
          (await computeProcessedKey(publicClient, forwarder, d)) as `0x${string}`,
        ],
      })
      return isProcessed ? null : d
    }),
  )
  return results.filter((d): d is DepositEvent => d !== null)
}

// Compute processed key off-chain matching contract: keccak256(abi.encode(userTag, depositId))
async function computeProcessedKey(
  _publicClient: ReturnType<typeof createPublicClient>,
  _forwarder: Address,
  deposit: DepositEvent,
): Promise<Hex> {
  const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem')
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes6, bytes32'), [
      deposit.userTag as `0x${string}`,
      deposit.depositId as `0x${string}`,
    ]),
  )
}
