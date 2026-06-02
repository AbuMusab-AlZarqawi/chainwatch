import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, walletData, flags } = await req.json();

    if (!walletAddress || !walletData || !flags) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const flagSummary = flags
      .map(
        (f: { name: string; flagged: boolean; severity: string; detail: string }) =>
          `- ${f.name}: ${f.flagged ? `FLAGGED [${f.severity.toUpperCase()}]` : "CLEAN"} — ${f.detail}`
      )
      .join("\n");

    const prompt = `
You are CIPHER — a sharp, no-nonsense onchain fraud analyst. You do not hedge. You do not speculate without data. You call it as you see it.

You have been given a wallet analysis for: ${walletAddress}

WALLET STATISTICS:
- Transaction Count: ${walletData.transactionCount}
- Wallet Age: ${walletData.walletAgeInDays} days
- Unique Counterparties: ${walletData.uniqueCounterparties}
- Largest Single Inflow: ${walletData.largestInflow} RITUAL
- Largest Single Outflow: ${walletData.largestOutflow} RITUAL
- Most Active Day: ${walletData.mostActiveDay}
- Avg Daily Transactions: ${walletData.avgDailyTransactions}

RULE-BASED SIGNAL FLAGS:
${flagSummary}

Your job:
1. Interpret each flag in context — one flag alone may be innocent, but multiple together shift the probability dramatically.
2. Weigh the signals holistically.
3. Assign a Risk Score from 0–100 (0 = completely clean, 100 = definite fraud).
4. Assign a Risk Level: CLEAN (0–15), LOW (16–35), MEDIUM (36–60), HIGH (61–80), or CRITICAL (81–100).
5. For each flag, write a clear plain-English explanation of what it means and whether it matters in this specific context.
6. End with a Verdict paragraph — your overall assessment of this wallet.

Return ONLY valid JSON in this exact structure, no markdown, no preamble, no backticks:
{
  "riskScore": <number 0-100>,
  "riskLevel": "<CLEAN|LOW|MEDIUM|HIGH|CRITICAL>",
  "flagAnalysis": [
    {
      "name": "<flag name>",
      "flagged": <true|false>,
      "severity": "<low|medium|high>",
      "cipherNote": "<CIPHER's plain English interpretation of this flag in this specific context>"
    }
  ],
  "verdict": "<CIPHER's overall verdict paragraph — direct, authoritative, specific to this wallet>",
  "summary": "<one sentence executive summary>"
}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are CIPHER, an elite onchain fraud analyst. You return only valid JSON. No markdown. No preamble. No explanation outside the JSON structure.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content || "";
    
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse CIPHER response", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
