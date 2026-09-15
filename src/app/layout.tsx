import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import "./globals.css";

// latin-ext je kvůli české diakritice – bez něj se ě/š/č/ř/ž dokreslují
// náhradním fontem a text poskakuje.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VUT Kvízy",
    template: "%s · VUT Kvízy",
  },
  description:
    "Kvízy pro studium na FIT VUT. Procvičuj si předměty prvního ročníku a sleduj, co už umíš.",
  applicationName: "VUT Kvízy",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1c21" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning je tu kvůli next-themes: ten dopisuje třídu
    // na <html> ještě před hydratací, takže se server a klient legitimně liší.
    <html
      lang="cs"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-sans antialiased">
        <Providers>
          <a
            href="#obsah"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lift"
          >
            Přeskočit na obsah
          </a>
          <Nav />
          <main id="obsah" className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
