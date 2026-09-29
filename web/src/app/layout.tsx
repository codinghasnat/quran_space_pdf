import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hifz",
  description: "Memorise from your own mushaf, one covered line at a time.",
};

export const viewport: Viewport = {
  themeColor: "#f4faf9",
};

// Light by default like RootedQuran; an explicit choice wins. Runs before paint to avoid a flash.
const themeInit = `
try {
  var dark = localStorage.getItem('theme') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a0f0e' : '#f4faf9');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        {children}
      </body>
    </html>
  );
}
