import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hablo",
  description: "Voice-first Spanish speaking practice tutor"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-4 py-5">
          <header className="mb-6 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              Hablo
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/app">Dashboard</Link>
              <Link href="/app/flashcards">Flashcards</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
