import { createPublicClient, http, parseAbiItem } from "viem";
import { ritualTestnet } from "./wagmiConfig";

export interface FlagResult {
  name: string;
  flagged: boolean;
  severity: "low" | "medium" | "high";
  detail: string;
}

export interface WalletData {
  transactionCount: number;
  walletAgeInDays: number;
  uniqueCounterparties: number;
  largestInflow: string;
  largestOutflow: string;
  mostActiveDay: string;
  avgDailyTransactions: number;
}

interface TxRecord {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  blockNumber: bigint;
  blockTimestamp?: number;
}

export async function analyzeWallet(address: string): Promise<{
  walletData: WalletData;
  flags: FlagResult[];
}> {
  const client = createPublicClient({
    chain: ritualTestnet,
    transport: http("https://rpc.ritualfoundation.org"),
  });

  const addr = address.toLowerCase() as `0x${string}`;

  // Get latest block
  const latestBlock = await client.getBlockNumber();

  // Fetch last 1000 blocks of logs — use BigInt(0) NOT 0n
  const fromBlock = latestBlock > BigInt(1000) ? latestBlock - BigInt(1000) : BigInt(0);

  // Get sent and received transfers using getLogs
  let sentLogs: { blockNumber: bigint; topics: readonly `0x${string}`[]; data: `0x${string}` }[] = [];
  let receivedLogs: typeof sentLogs = [];

  try {
    sentLogs = await client.getLogs({
      fromBlock,
      toBlock: latestBlock,
    });
  } catch {
    // Some RPCs don't support full getLogs — fallback gracefully
  }

  // Get block timestamps for age calculation
  const latestBlockData = await client.getBlock({ blockNumber: latestBlock });
  const latestTimestamp = Number(latestBlockData.timestamp);
  const nowMs = latestTimestamp * 1000;

  // Build synthetic tx list from native transfers by scanning recent blocks
  // We'll pull the last 200 blocks for detailed tx inspection
  const scanBlocks = latestBlock > BigInt(200) ? BigInt(200) : latestBlock;
  const startBlock = latestBlock - scanBlocks + BigInt(1);

  const transactions: TxRecord[] = [];
  const blockTimestamps: Map<bigint, number> = new Map();

  // Fetch blocks in batches
  const batchSize = 20;
  const blockNums: bigint[] = [];
  for (let b = startBlock; b <= latestBlock; b++) {
    blockNums.push(b);
  }

  // Sample every 5th block to avoid rate limits
  const sampledBlocks = blockNums.filter((_, i) => i % 5 === 0).slice(0, 40);

  for (const bn of sampledBlocks) {
    try {
      const block = await client.getBlock({ blockNumber: bn, includeTransactions: true });
      blockTimestamps.set(bn, Number(block.timestamp));

      if (block.transactions && Array.isArray(block.transactions)) {
        for (const tx of block.transactions as any[]) {
          if (
            tx.from?.toLowerCase() === addr ||
            tx.to?.toLowerCase() === addr
          ) {
            transactions.push({
              hash: tx.hash,
              from: tx.from?.toLowerCase() || "",
              to: tx.to?.toLowerCase() || null,
              value: BigInt(tx.value || 0),
              blockNumber: bn,
              blockTimestamp: Number(block.timestamp),
            });
          }
        }
      }
    } catch {
      // skip failed block
    }
  }

  // Also check wallet's first transaction by looking at nonce
  let nonce = 0;
  try {
    nonce = await client.getTransactionCount({ address: addr as `0x${string}` });
  } catch {}

  // ── Compute wallet data ──────────────────────────────────────────────
  const txCount = Math.max(nonce, transactions.length);
  
  // Wallet age: use first seen transaction or estimate from nonce
  const timestamps = transactions
    .map((t) => t.blockTimestamp || 0)
    .filter((t) => t > 0)
    .sort();

  const firstTxTimestamp = timestamps.length > 0 ? timestamps[0] : latestTimestamp;
  const walletAgeInDays = Math.max(
    0,
    Math.floor((latestTimestamp - firstTxTimestamp) / 86400)
  );

  // Unique counterparties
  const counterparties = new Set<string>();
  for (const tx of transactions) {
    if (tx.from === addr && tx.to) counterparties.add(tx.to);
    if (tx.to === addr && tx.from) counterparties.add(tx.from);
  }

  // Largest inflow / outflow
  let largestInflow = BigInt(0);
  let largestOutflow = BigInt(0);
  for (const tx of transactions) {
    if (tx.to === addr && tx.value > largestInflow) largestInflow = tx.value;
    if (tx.from === addr && tx.value > largestOutflow) largestOutflow = tx.value;
  }

  // Most active day + avg daily txs
  const dayCount: Map<string, number> = new Map();
  for (const tx of transactions) {
    if (tx.blockTimestamp) {
      const day = new Date(tx.blockTimestamp * 1000).toISOString().slice(0, 10);
      dayCount.set(day, (dayCount.get(day) || 0) + 1);
    }
  }
  let mostActiveDay = "N/A";
  let maxDayTxs = 0;
  for (const [day, count] of dayCount.entries()) {
    if (count > maxDayTxs) {
      maxDayTxs = count;
      mostActiveDay = day;
    }
  }

  const totalDays = Math.max(walletAgeInDays, 1);
  const avgDailyTransactions = Math.round((txCount / totalDays) * 10) / 10;

  const walletData: WalletData = {
    transactionCount: txCount,
    walletAgeInDays,
    uniqueCounterparties: counterparties.size,
    largestInflow: (Number(largestInflow) / 1e18).toFixed(4),
    largestOutflow: (Number(largestOutflow) / 1e18).toFixed(4),
    mostActiveDay,
    avgDailyTransactions,
  };

  // ── Rule-based checks ────────────────────────────────────────────────
  const flags: FlagResult[] = [];

  // 1. Wallet age
  flags.push({
    name: "Wallet Age",
    flagged: walletAgeInDays < 7,
    severity: walletAgeInDays < 2 ? "high" : "medium",
    detail:
      walletAgeInDays < 7
        ? `Wallet is only ${walletAgeInDays} day(s) old. New wallets with high activity are a common fraud indicator.`
        : `Wallet is ${walletAgeInDays} days old — established enough to be credible.`,
  });

  // 2. Burst activity
  flags.push({
    name: "Burst Activity",
    flagged: maxDayTxs > 20,
    severity: maxDayTxs > 50 ? "high" : "medium",
    detail:
      maxDayTxs > 20
        ? `${maxDayTxs} transactions occurred in a single day (${mostActiveDay}). Burst patterns suggest automated or coordinated behavior.`
        : `Peak daily activity was ${maxDayTxs} transactions — within normal range.`,
  });

  // 3. Fan-out pattern
  const sentAddresses = new Set(
    transactions.filter((t) => t.from === addr && t.to).map((t) => t.to!)
  );
  flags.push({
    name: "Fan-Out Pattern",
    flagged: sentAddresses.size >= 10,
    severity: sentAddresses.size >= 20 ? "high" : "medium",
    detail:
      sentAddresses.size >= 10
        ? `Funds sent to ${sentAddresses.size} unique addresses. This fan-out pattern is common in airdrop farming and Sybil attacks.`
        : `Sent to ${sentAddresses.size} unique addresses — no abnormal fan-out detected.`,
  });

  // 4. Rapid drain
  const receivedTxs = transactions.filter((t) => t.to === addr && t.value > BigInt(0));
  const sentTxs = transactions.filter((t) => t.from === addr && t.value > BigInt(0));
  let rapidDrain = false;
  if (receivedTxs.length > 0 && sentTxs.length > 0) {
    const totalReceived = receivedTxs.reduce((s, t) => s + t.value, BigInt(0));
    const totalSent = sentTxs.reduce((s, t) => s + t.value, BigInt(0));
    if (totalReceived > BigInt(0)) {
      const drainRatio = Number(totalSent * BigInt(100) / totalReceived);
      rapidDrain = drainRatio >= 90;
      flags.push({
        name: "Rapid Drain",
        flagged: rapidDrain,
        severity: "high",
        detail: rapidDrain
          ? `Wallet sent out ${drainRatio}% of received funds — a pattern consistent with money mule or drainer activity.`
          : `No rapid drain detected. Outflow/inflow ratio is within normal range.`,
      });
    } else {
      flags.push({ name: "Rapid Drain", flagged: false, severity: "low", detail: "Insufficient inflow data to assess drain pattern." });
    }
  } else {
    flags.push({ name: "Rapid Drain", flagged: false, severity: "low", detail: "Not enough transaction data to assess drain pattern." });
  }

  // 5. Round number transactions
  const nonZeroTxs = transactions.filter((t) => t.value > BigInt(0));
  const roundTxs = nonZeroTxs.filter((t) => {
    const eth = Number(t.value) / 1e18;
    return eth === Math.round(eth) || eth === Math.round(eth * 10) / 10;
  });
  const roundPct = nonZeroTxs.length > 0 ? Math.round((roundTxs.length / nonZeroTxs.length) * 100) : 0;
  flags.push({
    name: "Round Number Transactions",
    flagged: roundPct > 60 && nonZeroTxs.length >= 5,
    severity: "medium",
    detail:
      roundPct > 60 && nonZeroTxs.length >= 5
        ? `${roundPct}% of transactions use suspiciously round values — a known wash trading signal.`
        : `${roundPct}% round-number transactions — no wash trading pattern detected.`,
  });

  // 6. Single counterparty dominance
  const counterpartyCount: Map<string, number> = new Map();
  for (const tx of transactions) {
    const other = tx.from === addr ? tx.to : tx.from;
    if (other) counterpartyCount.set(other, (counterpartyCount.get(other) || 0) + 1);
  }
  let maxCounterpartyTxs = 0;
  for (const count of counterpartyCount.values()) {
    if (count > maxCounterpartyTxs) maxCounterpartyTxs = count;
  }
  const dominancePct = transactions.length > 0 ? Math.round((maxCounterpartyTxs / transactions.length) * 100) : 0;
  flags.push({
    name: "Single Counterparty Dominance",
    flagged: dominancePct > 70 && transactions.length >= 5,
    severity: dominancePct > 85 ? "high" : "medium",
    detail:
      dominancePct > 70 && transactions.length >= 5
        ? `${dominancePct}% of transactions involve a single counterparty. This strongly suggests wash trading or coordinated bot activity.`
        : `No single counterparty dominance detected (${dominancePct}% max concentration).`,
  });

  // 7. Transaction frequency pattern (bot regularity)
  let botPattern = false;
  let botDetail = "Transaction timing appears irregular — no automated bot pattern detected.";
  if (transactions.length >= 5) {
    const sorted = [...transactions].sort(
      (a, b) => (a.blockTimestamp || 0) - (b.blockTimestamp || 0)
    );
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = (sorted[i].blockTimestamp || 0) - (sorted[i - 1].blockTimestamp || 0);
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length >= 3) {
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const variance = intervals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / avg; // coefficient of variation
      botPattern = cv < 0.15 && avg < 300; // very regular intervals under 5 min
      botDetail = botPattern
        ? `Transactions occur at suspiciously regular intervals (CV: ${cv.toFixed(2)}). Highly consistent timing is a bot signature.`
        : `Transaction timing variance is normal (CV: ${cv.toFixed(2)}).`;
    }
  }
  flags.push({
    name: "Bot-Like Timing Pattern",
    flagged: botPattern,
    severity: "high",
    detail: botDetail,
  });

  // 8. Zero value transactions
  const zeroTxs = transactions.filter((t) => t.value === BigInt(0));
  const zeroPct = transactions.length > 0 ? Math.round((zeroTxs.length / transactions.length) * 100) : 0;
  flags.push({
    name: "Zero Value Transactions",
    flagged: zeroPct > 50 && transactions.length >= 5,
    severity: "medium",
    detail:
      zeroPct > 50 && transactions.length >= 5
        ? `${zeroPct}% of transactions carry zero value — common in spam campaigns, Sybil attacks, and airdrop hunters.`
        : `${zeroPct}% zero-value transactions — within normal bounds.`,
  });

  return { walletData, flags };
}
