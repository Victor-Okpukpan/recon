import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const STEPS = [
  {
    title: "Browse",
    body: "Pull up any live Polymarket question — sports, politics, or anything else.",
  },
  {
    title: "Preview, free",
    body: "Recon checks how many current sources exist and whether they're enough to say anything useful — before you pay for anything.",
  },
  {
    title: "Unlock the Digest",
    body: "One on-chain payment on Monad. Claude extracts claims from every source, flags where they contradict each other, and writes a plain-language summary.",
  },
  {
    title: "Never a bet recommendation",
    body: "Recon tells you what the sources say and how confident that picture is — never which way to bet. If the evidence is thin, it says so instead of guessing.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-16 p-6 py-20">
      <section className="space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Research a market before you bet on it.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">
          Recon sits in front of any Polymarket question and surfaces what current sources actually
          say — injuries, head-to-head history, breaking news — with an honest{" "}
          <span className="text-foreground">Inconclusive </span> when there isn&apos;t enough to go on.
        </p>
        <div>
          <Link href="/markets" className={buttonVariants({ size: "lg", className: "rounded-full px-8" })}>
            Browse markets
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="space-y-2 rounded-xl border border-white/10 bg-card p-5">
            <p className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
            <p className="text-sm font-semibold">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-card p-6 text-sm text-muted-foreground">
        <p>
          <span className="text-foreground">Payment</span> is a single native-MON transaction on Monad testnet —
          no subscription, no approve step. Pay once per market; revisit any time before it resolves without paying again.
        </p>
        <p>
          <span className="text-foreground">Access control is on-chain.</span> Every Digest request is checked directly
          against the deployed contract — unlock state can&apos;t be spoofed client-side.
        </p>
      </section>

      <div className="text-center">
        <Link
          href="/markets"
          className={buttonVariants({ variant: "secondary", size: "lg", className: "rounded-full px-8" })}
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
