import {
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { VirtualAddress } from 'ox/tempo'
import { splitForwarderAbi } from './abi.js'
import { makeDepositId } from './client.js'
import type { DepositEvent } from './types.js'

/** Watch for Split events on a forwarder — for live demo UI updates. */
export function watchSplits(
  publicClient: PublicClient,
  forwarder: Address,
  onSplit: (event: {
    userTag: Hex
    token: Address
    amount: bigint
    recipientCount: bigint
    txHash: Hex | null
  }) => void,
): () => void {
  return publicClient.watchContractEvent({
    address: forwarder,
    abi: splitForwarderAbi,
    eventName: 'Split',
    onLogs: (logs) => {
      for (const log of logs) {
        if (!log.args.userTag || !log.args.token) continue
        onSplit({
          userTag: log.args.userTag as Hex,
          token: log.args.token as Address,
          amount: log.args.amount ?? 0n,
          recipientCount: log.args.recipientCount ?? 0n,
          txHash: (log.transactionHash as Hex) ?? null,
        })
      }
    },
  })
}

/**
 * Poll for TIP-20 Transfer events to the forwarder address.
 * Returns unprocessed deposit events since `fromBlock`.
 * Used by the keeper to find deposits that need processing.
 */
export async function getPendingDeposits(
  publicClient: PublicClient,
  forwarder: Address,
  token: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<DepositEvent[]> {
  const transferEvent = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  )

  const logs = await publicClient.getLogs({
    address: token,
    event: transferEvent,
    args: { to: forwarder },
    fromBlock,
    toBlock,
  })

  const deposits: DepositEvent[] = []

  for (const log of logs) {
    if (!log.transactionHash || log.logIndex === null) continue

    // The `from` on a virtual-address hop is the virtual address itself.
    // Decode it to get the userTag.
    const fromAddr = log.args.from
    if (!fromAddr || !VirtualAddress.isVirtual(fromAddr)) continue

    const { userTag } = VirtualAddress.parse(fromAddr)

    deposits.push({
      userTag: userTag as Hex,
      token,
      amount: log.args.value ?? 0n,
      depositId: makeDepositId(log.transactionHash, log.logIndex),
      blockNumber: log.blockNumber ?? fromBlock,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
    })
  }

  return deposits
}
