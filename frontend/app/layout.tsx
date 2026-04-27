import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HID-41 — Análise Pluviométrica · Paraíba do Sul",
  description:
    "Dashboard de análise de séries históricas de precipitação da bacia do Paraíba do Sul. " +
    "Disciplina HID-41 — ITA. Dados: ANA Hidroweb.",
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
        <header className="border-b bg-[#00205B] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-3 hover:opacity-90">
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
            </a>
            <nav className="hidden gap-5 text-sm text-blue-200 sm:flex">
              <a href="/" className="hover:text-white">Início</a>
              <a href="/dashboard" className="hover:text-white">Dashboard</a>
              <a href="/estacoes" className="hover:text-white">Estações</a>
              <a href="/selecao" className="hover:text-white">Seleção</a>
              <a href="/preenchimento" className="hover:text-white">Preenchimento</a>
              <a href="/transparencia" className="hover:text-white">Transparência</a>
            </nav>
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
