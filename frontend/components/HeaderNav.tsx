"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Item = { href: string; label: string; desc?: string };
type Group = { label: string; items: Item[]; match: string[] };

const PLUVIO: Group = {
  label: "Pluviometria",
  match: ["/dashboard", "/estacoes", "/series", "/tabela", "/selecao", "/preenchimento"],
  items: [
    { href: "/dashboard",     label: "Dashboard",     desc: "KPIs, mapa e cards das estações pluviométricas" },
    { href: "/estacoes",      label: "Estações",      desc: "Séries diária, mensal, anual e histogramas" },
    { href: "/series",        label: "Séries",        desc: "Visualização temporal por estação" },
    { href: "/tabela",        label: "Tabela",        desc: "Série completa com exportação XLSX" },
    { href: "/selecao",       label: "Seleção",       desc: "Escolha de estações e referência" },
    { href: "/preenchimento", label: "Preenchimento", desc: "Comparação regressão múltipla vs IDW" },
  ],
};

const FLUVIO: Group = {
  label: "Fluviometria",
  match: ["/selecao-fluvio", "/fluviometria", "/regime", "/eventos", "/extremos"],
  items: [
    { href: "/selecao-fluvio", label: "Exutório",       desc: "Seleção da estação fluviométrica de exutório" },
    { href: "/fluviometria",   label: "Séries de Vazão", desc: "Diária, mensal, anual e curva-chave" },
    { href: "/regime",         label: "Regime",         desc: "Curva de permanência e separação Eckhardt" },
    { href: "/eventos",        label: "Eventos",        desc: "Isolamento de eventos e hidrograma unitário" },
    { href: "/extremos",       label: "Extremos",       desc: "Frequência de cheias, low-flow e IDF" },
  ],
};

function Dropdown({ group, pathname }: { group: Group; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = group.match.some((m) => pathname === m || pathname.startsWith(m + "/"));

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
          active ? "text-white" : "text-blue-200 hover:text-white"
        }`}
      >
        {group.label}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 pt-2">
          <div className="w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {group.items.map((it) => {
              const isActive = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`block rounded-lg px-3 py-2 transition-colors ${
                    isActive ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <p className={`text-sm font-semibold ${isActive ? "text-[#00205B]" : "text-slate-800"}`}>
                    {it.label}
                  </p>
                  {it.desc && (
                    <p className="mt-0.5 text-xs text-slate-500">{it.desc}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1 transition-colors ${
        active ? "text-white" : "text-blue-200 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop / tablet */}
      <nav className="hidden items-center gap-1 text-sm md:flex">
        <SimpleLink href="/" label="Início" pathname={pathname} />
        <Dropdown group={PLUVIO} pathname={pathname} />
        <Dropdown group={FLUVIO} pathname={pathname} />
        <SimpleLink href="/transparencia" label="Metodologia" pathname={pathname} />
      </nav>

      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden rounded-md p-1.5 text-blue-200 hover:bg-white/10 hover:text-white"
        aria-label="Abrir menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileOpen ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <>
              <path d="M3 6h18" strokeLinecap="round" />
              <path d="M3 12h18" strokeLinecap="round" />
              <path d="M3 18h18" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-t border-white/10 bg-[#00205B] md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3 space-y-3 text-sm">
            <Link href="/" className="block text-white" onClick={() => setMobileOpen(false)}>
              Início
            </Link>
            {[PLUVIO, FLUVIO].map((g) => (
              <div key={g.label}>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
                  {g.label}
                </p>
                <div className="mt-1 space-y-1 pl-2">
                  {g.items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      className="block text-blue-100 hover:text-white"
                      onClick={() => setMobileOpen(false)}
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/transparencia"
              className="block text-white"
              onClick={() => setMobileOpen(false)}
            >
              Metodologia
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
