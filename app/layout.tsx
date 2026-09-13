import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import './visual-system.css';

const dmSans = DM_Sans({
  variable: '--font-ui',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FPL Decision Dashboard',
  description: 'Live squad, transfer, prediction and rank tools for FPL managers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={dmSans.variable} lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
