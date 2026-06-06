import { NextRequest, NextResponse } from "next/server";

interface TxRecord {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number;
}

async function fetchV2(address: string): Promise<TxRecord[]> {
  const url = `https://explorer.ritualfoundation.org/api/v2/addresses/${address}/transactions?limit=50&sort=desc`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items: any[] = data.items || [];
  return items.map((tx: any) => ({
    hash: tx.hash || "",
    from: (tx.from?.hash || tx.from || "").toLowerCase(),
    to: ((tx.to?.hash || tx.to) ?? null)?.toLowerCase() ?? null,
    value: tx.value || "0",
    timestamp: tx.timestamp ? Math.floor(new Date(tx.timestamp).getTime() / 1000) : 0,
  }));
}

async function fetchV1(address: string): Promise<TxRecord[]> {
  const url = `https://explorer.ritualfoundation.org/api?module=account&action=txlist&address=${address}&sort=desc&limit=50`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items: any[] = Array.isArray(data.result) ? data.result : [];
  return items.map((tx: any) => ({
    hash: tx.hash || "",
    from: (tx.from || "").toLowerCase(),
    to: (tx.to || null)?.toLowerCase() ?? null,
    value: tx.value || "0",
    timestamp: parseInt(tx.timeStamp || "0"),
  }));
}

async function fetchNonce(address: string): Promise<number> {
  try {
    const res = await fetch("https://rpc.ritualfoundation.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionCount",
        params: [address, "latest"],
        id: 1,
      }),
      next: { revalidate: 0 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return parseInt(data.result || "0x0", 16);
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    // Run all fetches in parallel
    const [txV2, txV1, nonce] = await Promise.all([
      fetchV2(address).catch(() => []),
      fetchV1(address).catch(() => []),
      fetchNonce(address).catch(() => 0),
    ]);

    // Use whichever returned more data
    const transactions = txV2.length >= txV1.length ? txV2 : txV1;

    return NextResponse.json({ transactions, nonce });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
      }
