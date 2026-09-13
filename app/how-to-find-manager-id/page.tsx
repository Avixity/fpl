import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Link2, LogIn, Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

const STEPS = [
  {
    icon: LogIn,
    title: 'Sign in to Fantasy Premier League',
    copy: 'Open the official FPL website and sign in with the account that owns your team.',
  },
  {
    icon: Search,
    title: 'Open your Points page',
    copy: 'Choose Points from the FPL menu. Your browser address will now contain your public entry number.',
  },
  {
    icon: Link2,
    title: 'Copy the number after /entry/',
    copy: 'The address follows the format fantasy.premierleague.com/entry/[manager-id]/event/[gameweek]. Copy only the manager-id number.',
  },
  {
    icon: CheckCircle2,
    title: 'Return and connect',
    copy: 'Paste that number into the Manager ID field. The app validates it against the public FPL API before saving it on this device.',
  },
];

export default function ManagerIdGuide() {
  return (
    <main className="guide-page">
      <header className="guide-header">
        <div aria-label="App name reserved" className="brand-reserved" />
        <Link className={buttonVariants({ variant: 'ghost' })} href="/"><ArrowLeft /> Back to connection</Link>
      </header>
      <section className="guide-content">
        <div className="guide-intro">
          <p className="eyebrow">FPL connection guide</p>
          <h1>Find your Manager ID in under a minute.</h1>
          <p>Your Manager ID is public and read-only. The app never asks for your FPL password or permission to change your team.</p>
          <a className={buttonVariants()} href="https://fantasy.premierleague.com/" rel="noreferrer" target="_blank">Open official FPL <ArrowUpRight /></a>
        </div>
        <ol className="guide-steps">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <span className="guide-number">{String(index + 1).padStart(2, '0')}</span>
                <Icon />
                <div><h2>{step.title}</h2><p>{step.copy}</p></div>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
