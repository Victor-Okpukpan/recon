import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-10 text-sm">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
        <div className="col-span-2 space-y-2 sm:col-span-1">
          <p className="text-sm font-bold tracking-widest uppercase">Recon</p>
          <p className="text-xs text-muted-foreground">
            Research digests for Polymarket markets, gated onchain on Monad.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Browse</p>
          <ul className="space-y-1.5 text-xs">
            <li>
              <Link href="/markets" className="text-muted-foreground transition-colors hover:text-foreground">
                All markets
              </Link>
            </li>
            <li>
              <Link href="/markets?category=Politics" className="text-muted-foreground transition-colors hover:text-foreground">
                Politics
              </Link>
            </li>
            <li>
              <Link href="/markets?category=Sports" className="text-muted-foreground transition-colors hover:text-foreground">
                Sports
              </Link>
            </li>
            <li>
              <Link href="/sessions" className="text-muted-foreground transition-colors hover:text-foreground">
                My Sessions
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Built with</p>
          <ul className="space-y-1.5 text-xs">
            <li>
              <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                Polymarket
              </a>
            </li>
            <li>
              <a href="https://monad.xyz" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                Monad
              </a>
            </li>
            <li>
              <a href="https://privy.io" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                Privy
              </a>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recon</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>Built for the Monad Spark hackathon</li>
            <li>Not financial advice</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-white/10 pt-4 text-xs text-muted-foreground/70">
        Recon is an independent project, not affiliated with or endorsed by Polymarket. Digest content — including any
        outcome lean — is AI-generated analysis of public sources, not financial advice.
      </div>
    </footer>
  );
}
