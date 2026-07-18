export interface DigestSource {
  id: string;
  kind: "sports" | "general";
  label: string;
  url?: string;
  publishedAt: string;
  content: string;
}

export interface Claim {
  sourceId: string;
  text: string;
}

export interface ContradictionPair {
  claimA: Claim;
  claimB: Claim;
  explanation: string;
}
