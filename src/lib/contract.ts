export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "string", name: "riskLevel", type: "string" },
      { internalType: "bytes32", name: "reportHash", type: "bytes32" },
    ],
    name: "recordScan",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "getScanCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "scannerWallet", type: "address" },
    ],
    name: "getScans",
    outputs: [
      {
        components: [
          { internalType: "address", name: "scanner", type: "address" },
          { internalType: "address", name: "target", type: "address" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "string", name: "riskLevel", type: "string" },
          { internalType: "bytes32", name: "reportHash", type: "bytes32" },
        ],
        internalType: "struct ChainWatch.Scan[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "target", type: "address" }],
    name: "getScansOfTarget",
    outputs: [
      {
        components: [
          { internalType: "address", name: "scanner", type: "address" },
          { internalType: "address", name: "target", type: "address" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "string", name: "riskLevel", type: "string" },
          { internalType: "bytes32", name: "reportHash", type: "bytes32" },
        ],
        internalType: "struct ChainWatch.Scan[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "scanner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "target",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "riskLevel",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "ScanCompleted",
    type: "event",
  },
] as const;
