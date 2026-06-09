import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HID-41 — Análise Hidrológica · Paraíba do Sul",
  description:
    "Dashboard de análise hidrológica da bacia do Paraíba do Sul: séries pluviométricas e " +
    "fluviométricas, regime, eventos, extremos e curvas IDF. Disciplina HID-41 — ITA. " +
    "Dados: ANA Hidroweb.",
  icons: { icon: "/logo-ita-fundo-branco.jpg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Necessário para react-leaflet */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className={inter.className}>
        {/* Barra superior de identidade ITA */}
        <header className="relative border-b bg-[#00205B] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90">
              <div className="rounded-lg bg-white p-0.5">
                <Image
                  src="/logo-ita-fundo-branco.jpg"
                  alt="ITA"
                  width={32}
                  height={32}
                  className="rounded-md"
                />
              </div>
              <div>
                <p className="text-sm font-bold leading-none">HID-41 · Hidrologia e Drenagem</p>
                <p className="text-xs leading-none text-blue-200">
                  Bacia do Paraíba do Sul — URGHI 2
                </p>
              </div>
            </Link>
            <HeaderNav />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

        <footer className="mt-12 border-t bg-slate-50 py-5 text-center text-xs text-slate-400">
          <p>
            Henri L. S. Lima · Pedro F. Gutemberg · Gustavo V. Feitosa —{" "}
            <span className="font-semibold text-slate-500">ITA 2025</span>
          </p>
          <p className="mt-1">
            Dados: ANA Hidroweb · Mapa: OpenStreetMap
          </p>
        </footer>
      </body>
    </html>
  );
}
