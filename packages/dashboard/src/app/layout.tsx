import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrevnClaw — Mission Control',
  description: 'Local-first autonomous agent mission control dashboard',
};

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-[var(--sidebar)] border-r border-[var(--card-border)] flex flex-col">
          <div className="p-5 border-b border-[var(--card-border)]">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Crevn<span className="text-[var(--accent)]">Claw</span>
            </h1>
            <p className="text-xs text-[var(--muted)] mt-1">Mission Control v0.1</p>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            <NavLink href="/" label="Dashboard" icon="&#9632;" />
            <NavLink href="/thought-stream" label="Thought Stream" icon="&#9881;" />
            <NavLink href="/memory" label="Memory" icon="&#9733;" />
            <NavLink href="/settings" label="Settings" icon="&#9881;" />
          </nav>

          <div className="p-4 border-t border-[var(--card-border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse-dot" />
              Gateway Connected
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
