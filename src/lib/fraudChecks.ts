import { createPublicClient, http } from "viem";
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
  value: string; // in wei as string
  timestamp: number; // unix seconds
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Fetch transactions from Blockscout explorer API
async function fetchTransactionsFromExplorer(address: string): Promise<TxRecord[]> {
  const base = "https://explorer.ritualfoundation.org/api/v2";
  const url = `${base}/addresses/${address}/transactions?limit=50&sort=desc`;

  try {
    const res = await withTimeout(
      fetch(url, { headers: { Accept: "application/json" } }),
      10000,
      null
    );
    if (!res || !res.ok) return [];
    const data = await res.json();
    const items = data.items || data.result || data.transactions || [];

    return items.map((tx: any) => ({
      hash: tx.hash || "",
      from: (tx.from?.hash || tx.from || "").toLowerCase(),
      to: (tx.to?.hash || tx.to || null)?.toLowerCase() || null,
      value: tx.value || "0",
      timestamp: tx.timestamp
        ? Math.floor(new Date(tx.timestamp).getTime() / 1000)
        : 0,
    }));
  } catch {
    return [];
  }
}

// Fallback: try Blockscout v1 API format
async function fetchTransactionsV1(address: string): Promise<TxRecord[]> {
  const url = `https://explorer.ritualfoundation.org/api?module=account&action=txlist&address=${address}&sort=desc&limit=50`;

  try {
    const res = await withTimeout(
      fetch(url, { headers: { Accept: "application/json" } }),
      10000,
      null
    );
    if (!res || !res.ok) return [];
    const data = await res.json();
    const items = data.result || [];
    if (!Array.isArray(items)) return [];

    return items.map((tx: any) => ({
      hash: tx.hash || "",
      from: (tx.from || "").toLowerCase(),
      to: (tx.to || null)?.toLowerCase() || null,
      value: tx.value || "0",
      timestamp: parseInt(tx.timeStamp || "0"),
    }));
  } catch {
    return [];
  }
}

// Fallback: RPC-based nonce + limited block scan
async function fetchFromRpc(address: string): Promise<{ nonce: number; transactions: TxRecord[] }> {
  const client = createPublicClient({
    chain: ritualTestnet,
    transport: http("https://rpc.ritualfoundation.org", { timeout: 10000 }),
  });

  const addr = address as `0x${string}`;

  const nonce = await withTimeout(
    client.getTransactionCount({ address: addr }),
    8000,
    0
  );

  const latestBlock = await withTimeout(client.getBlockNumber(), 8000, BigInt(0));
  const transactions: TxRecord[] = [];

  if (latestBlock > BigInt(0)) {
    const scanDepth = BigInt(200);
    const startBlock = latestBlock > scanDepth ? latestBlock - scanDepth + BigInt(1) : BigInt(1);
    const blockNums: bigint[] = [];
    for (let b = startBlock; b <= latestBlock; b++) blockNums.push(b);
    const sampled = blockNums.filter((_, i) => i % 10 === 0).slice(0, 20);

    await Promise.allSettled(
      sampled.map(async (bn) => {
        try {
          const block = await withTimeout(
            client.getBlock({ blockNumber: bn, includeTransactions: true }),
            6000,
            null
          );
          if (!block || !block.transactions) return;
          for (const tx of block.transactions as any[]) {
            const txFrom = (tx.from || "").toLowerCase();
            const txTo = (tx.to || "").toLowerCase();
            if (txFrom === address.toLowerCase() || txTo === address.toLowerCase()) {
              transactions.push({
                hash: tx.hash,
                from: txFrom,
                to: txTo || null,
                value: tx.value?.toString() || "0",
                timestamp: Number(block.timestamp),
              });
            }
          }
        } catch {}
      })
    );
  }

  return { nonce, transactions };
}

export async function analyzeWallet(address: string): Promise<{
  walletData: WalletData;
  flags: FlagResult[];
}> {
  const addr = address.toLowerCase();

  // Try explorer API first (most reliable), then RPC fallback
  let transactions: TxRecord[] = await fetchTransactionsFromExplorer(address);
  let nonce = 0;

  if (transactions.length === 0) {
    transactions = await fetchTransactionsV1(address);
  }

  if (transactions.length === 0) {
    // Fall back to RPC block scanning
    const rpcData = await fetchFromRpc(address);
    nonce = rpcData.nonce;
    transactions = rpcData.transactions;
  }

  // Get nonce separately for accurate tx count
  try {
    const client = createPublicClient({
      chain: ritualTestnet,
      transport: http("https://rpc.ritualfoundation.org", { timeout: 8000 }),
    });
    nonce = await withTimeout(
      client.getTransactionCount({ address: addr as `0x${string}` }),
      6000,
      transactions.length
    );
  } catch {}

  const txCount = Math.max(nonce, transactions.length);

  // Timestamps
  const timestamps = transactions.map((t) => t.timestamp).filter((t) => t > 0).sort((a, b) => a - b);
  const nowTs = Math.floor(Date.now() / 1000);
  const firstTxTimestamp = timestamps.length > 0 ? timestamps[0] : nowTs;
  const walletAgeInDays = Math.max(0, Math.floor((nowTs - firstTxTimestamp) / 86400));

  // Counterparties
  const counterparties = new Set<string>();
  for (const tx of transactions) {
    if (tx.from === addr && tx.to) counterparties.add(tx.to);
    if (tx.to === addr && tx.from) counterparties.add(tx.from);
  }

  // Inflow / outflow
  let largestInflow = BigInt(0);
  let largestOutflow = BigInt(0);
  for (const tx of transactions) {
    const val = BigInt(tx.value || "0");
    if (tx.to === addr && val > largestInflow) largestInflow = val;
    if (tx.from === addr && val > largestOutflow) largestOutflow = val;
  }

  // Most active day
  const dayCount: Map<string, number> = new Map();
  for (const tx of transactions) {
    if (tx.timestamp) {
      const day = new Date(tx.timestamp * 1000).toISOString().slice(0, 10);
      dayCount.set(day, (dayCount.get(day) || 0) + 1);
    }
  }
  let mostActiveDay = "N/A";
  let maxDayTxs = 0;
  for (const [day, count] of dayCount.entries()) {
    if (count > maxDayTxs) { maxDayTxs = count; mostActiveDay = day; }
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

  // ---- Rule-based checks ----

  const flags: FlagResult[] = [];

  // 1. Wallet age
  flags.push({
    name: "Wallet Age",
    flagged: walletAgeInDays < 7,
    severity: walletAgeInDays < 2 ? "high" : "medium",
    detail: walletAgeInDays < 7
      ? `Wallet is only ${walletAgeInDays} day(s) old. New wallets with high activity are a common fraud indicator.`
      : `Wallet is ${walletAgeInDays} days old -- established enough to be credible.`,
  });

  // 2. Burst activity
  flags.push({
    name: "Burst Activity",
    flagged: maxDayTxs > 20,
    severity: maxDayTxs > 50 ? "high" : "medium",
    detail: maxDayTxs > 20
      ? `${maxDayTxs} transactions in a single day (${mostActiveDay}). Burst patterns suggest automated behavior.`
      : `Peak daily activity was ${maxDayTxs} transactions -- within normal range.`,
  });

  // 3. Fan-out
  const sentAddresses = new Set(
    transactions.filter((t) => t.from === addr && t.to).map((t) => t.to!)
  );
  flags.push({
    name: "Fan-Out Pattern",
    flagged: sentAddresses.size >= 10,
    severity: sentAddresses.size >= 20 ? "high" : "medium",
    detail: sentAddresses.size >= 10
      ? `Funds sent to ${sentAddresses.size} unique addresses. Fan-out pattern is common in Sybil attacks.`
      : `Sent to ${sentAddresses.size} unique addresses -- no abnormal fan-out detected.`,
  });

  // 4. Rapid drain
  const receivedTxs = transactions.filter((t) => t.to === addr && BigInt(t.value || "0") > BigInt(0));
  const sentTxs = transactions.filter((t) => t.from === addr && BigInt(t.value || "0") > BigInt(0));
  if (receivedTxs.length > 0 && sentTxs.length > 0) {
    const totalReceived = receivedTxs.reduce((s, t) => s + BigInt(t.value || "0"), BigInt(0));
    const totalSent = sentTxs.reduce((s, t) => s + BigInt(t.value || "0"), BigInt(0));
    const drainRatio = totalReceived > BigInt(0) ? Number(totalSent * BigInt(100) / totalReceived) : 0;
    flags.push({
      name: "Rapid Drain",
      flagged: drainRatio >= 90,
      severity: "high",
      detail: drainRatio >= 90
        ? `Wallet sent out ${drainRatio}% of received funds -- consistent with drainer activity.`
        : `No rapid drain detected. Outflow/inflow ratio is within normal range.`,
    });
  } else {
    flags.push({ name: "Rapid Drain", flagged: false, severity: "low", detail: "Not enough transaction data to assess drain pattern." });
  }

  // 5. Round numbers
  const nonZeroTxs = transactions.filter((t) => BigInt(t.value || "0") > BigInt(0));
  const roundTxs = nonZeroTxs.filter((t) => {
    const eth = Number(BigInt(t.value || "0")) / 1e18;
    return eth === Math.round(eth) || eth === Math.round(eth * 10) / 10;
  });
  const roundPct = nonZeroTxs.length > 0 ? Math.round((roundTxs.length / nonZeroTxs.length) * 100) : 0;
  flags.push({
    name: "Round Number Transactions",
    flagged: roundPct > 60 && nonZeroTxs.length >= 5,
    severity: "medium",
    detail: roundPct > 60 && nonZeroTxs.length >= 5
      ? `${roundPct}% of transactions use round values -- a known wash trading signal.`
      : `${roundPct}% round-number transactions -- no wash trading pattern detected.`,
  });

  // 6. Single counterparty dominance
  const cpCount: Map<string, number> = new Map();
  for (const tx of transactions) {
    const other = tx.from === addr ? tx.to : tx.from;
    if (other) cpCount.set(other, (cpCount.get(other) || 0) + 1);
  }
  let maxCpTxs = 0;
  for (const count of cpCount.values()) { if (count > maxCpTxs) maxCpTxs = count; }
  const dominancePct = transactions.length > 0 ? Math.round((maxCpTxs / transactions.length) * 100) : 0;
  flags.push({
    name: "Single Counterparty Dominance",
    flagged: dominancePct > 70 && transactions.length >= 5,
    severity: dominancePct > 85 ? "high" : "medium",
    detail: dominancePct > 70 && transactions.length >= 5
      ? `${dominancePct}% of transactions involve a single counterparty -- strong wash trading or bot signal.`
      : `No single counterparty dominance detected (${dominancePct}% max).`,
  });

  // 7. Bot timing
  let botPattern = false;
  let botDetail = "Transaction timing appears irregular -- no bot pattern detected.";
  if (transactions.length >= 5) {
    const sorted = [...transactions].filter((t) => t.timestamp > 0).sort((a, b) => a.timestamp - b.timestamp);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length >= 3) {
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const variance = intervals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / avg;
      botPattern = cv < 0.15 && avg < 300;
      botDetail = botPattern
        ? `Transactions occur at suspiciously regular intervals (CV: ${cv.toFixed(2)}). Consistent timing is a bot signature.`
        : `Transaction timing variance is normal (CV: ${cv.toFixed(2)}).`;
    }
  }
  flags.push({ name: "Bot-Like Timing Pattern", flagged: botPattern, severity: "high", detail: botDetail });

  // 8. Zero value
  const zeroTxs = transactions.filter((t) => BigInt(t.value || "0") === BigInt(0));
  const zeroPct = transactions.length > 0 ? Math.round((zeroTxs.length / transactions.length) * 100) : 0;
  flags.push({
    name: "Zero Value Transactions",
    flagged: zeroPct > 50 && transactions.length >= 5,
    severity: "medium",
    detail: zeroPct > 50 && transactions.length >= 5
      ? `${zeroPct}% of transactions carry zero value -- common in spam and Sybil attacks.`
      : `${zeroPct}% zero-value transactions -- within normal bounds.`,
  });

  return { walletData, flags };
}
