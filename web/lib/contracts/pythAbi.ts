// Minimal IPyth fragment — just the read call the frontend needs to quote
// the Pyth update fee before calling ReconAccess.payForAccess.
export const pythAbi = [
  {
    type: "function",
    name: "getUpdateFee",
    inputs: [{ name: "updateData", type: "bytes[]", internalType: "bytes[]" }],
    outputs: [{ name: "feeAmount", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;
