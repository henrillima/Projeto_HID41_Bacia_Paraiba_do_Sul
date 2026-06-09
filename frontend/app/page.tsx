import Image from "next/image";
import Link from "next/link";

const INTEGRANTES = [
  { nome: "Henri Leonardo dos Santos Lima", ra: "ITA · Engenharia Civil-Aeronáutica" },
  { nome: "Pedro Feitosa Gutemberg",        ra: "ITA · Engenharia Civil-Aeronáutica" },
  { nome: "Gustavo Vidal Feitosa",          ra: "ITA · Engenharia Civil-Aeronáutica" },
];

const PLUVIO = [
  {
    href: "/dashboard",
    titulo: "Dashboard",
    descricao: "KPIs, mapa interativo e cards de cada estação pluviométrica.",
    cor: "border-blue-200 bg-blue-50",
    corTexto: "text-blue-700",
  },
  {
    href: "/estacoes",
    titulo: "Estações",
    descricao: "Séries diárias, mensais, anuais e histogramas por estação.",
    cor: "border-sky-200 bg-sky-50",
    corTexto: "text-sky-700",
  },
  {
    href: "/series",
    titulo: "Séries",
    descricao: "Visualização temporal completa por estação.",
    cor: "border-cyan-200 bg-cyan-50",
    corTexto: "text-cyan-700",
  },
  {
    href: "/tabela",
    titulo: "Tabela de Séries",
    descricao: "Série completa com dados originais e corrigidos. Exportação XLSX.",
    cor: "border-teal-200 bg-teal-50",
    corTexto: "text-teal-700",
  },
  {
    href: "/selecao",
    titulo: "Seleção",
    descricao: "Escolha das estações de análise, coordenadas e referência.",
    cor: "border-violet-200 bg-violet-50",
    corTexto: "text-violet-700",
  },
  {
    href: "/preenchimento",
    titulo: "Preenchimento",
    descricao: "Comparação regressão linear múltipla vs IDW na estação de referência.",
    cor: "border-emerald-200 bg-emerald-50",
    corTexto: "text-emerald-700",
  },
];

const FLUVIO = [
  {
    href: "/selecao-fluvio",
    titulo: "Exutório",
    descricao: "Seleção da estação fluviométrica de exutório da sub-bacia.",
    cor: "border-indigo-200 bg-indigo-50",
    corTexto: "text-indigo-700",
  },
  {
    href: "/fluviometria",
    titulo: "Séries de Vazão",
    descricao: "Séries diária, mensal, anual e curva-chave da estação fluvio.",
    cor: "border-blue-200 bg-blue-50",
    corTexto: "text-blue-700",
  },
  {
    href: "/regime",
    titulo: "Regime",
    descricao: "Curva de permanência e separação de escoamento (Eckhardt).",
    cor: "border-sky-200 bg-sky-50",
    corTexto: "text-sky-700",
  },
  {
    href: "/eventos",
    titulo: "Eventos",
    descricao: "Isolamento de eventos chuva-vazão e hidrograma unitário SCS.",
    cor: "border-purple-200 bg-purple-50",
    corTexto: "text-purple-700",
  },
  {
    href: "/extremos",
    titulo: "Extremos",
    descricao: "Frequência de cheias, vazões mínimas (low-flow) e curvas IDF.",
    cor: "border-rose-200 bg-rose-50",
    corTexto: "text-rose-700",
  },
  {
    href: "/transparencia",
    titulo: "Metodologia",
    descricao: "Documentação detalhada das etapas e glossário técnico.",
    cor: "border-amber-200 bg-amber-50",
    corTexto: "text-amber-700",
  },
];

const STACK = [
  { cat: "Frontend",   items: ["Next.js 14 · App Router", "React 18", "TypeScript", "Tailwind CSS", "Recharts", "react-leaflet"] },
  { cat: "Backend",    items: ["Supabase (PostgreSQL)", "Row Level Security", "Views SQL"] },
  { cat: "Pipeline",   items: ["Python 3.11", "pandas · numpy", "scipy (estatística)", "scikit-learn (regressão)", "haversine (IDW)", "ANA REST API + supabase-py"] },
  { cat: "Deploy",     items: ["Vercel (frontend)", "Supabase Cloud (banco)"] },
];

export default function HomePage() {
  return (
    <div className="space-y-14">

      {/* Hero */}
      <section className="flex flex-col items-center gap-6 rounded-2xl border bg-white px-8 py-12 text-center shadow-sm sm:flex-row sm:text-left">
        <div className="shrink-0">
          <Image
            src="/logo-ita-fundo-branco.jpg"
            alt="Logo ITA"
            width={120}
            height={120}
            className="rounded-xl"
            priority
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Instituto Tecnológico de Aeronáutica
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#00205B]">
            HID-41 — Hidrologia e Drenagem
          </h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            Análise Hidrológica · Bacia do Paraíba do Sul (URGHI 2)
          </p>
          <p className="mt-3 max-w-2xl text-sm text-slate-500">
            Plataforma completa de análise hidrológica da bacia do Paraíba do Sul. Reúne séries
            históricas <strong>pluviométricas</strong> (precipitação) e{" "}
            <strong>fluviométricas</strong> (vazão) da ANA Hidroweb, com preenchimento de falhas,
            análise de regime, separação de escoamento, isolamento de eventos chuva-vazão,
            estatística de extremos (cheias e estiagens) e curvas IDF.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:justify-start">
            <Link
              href="/dashboard"
              className="rounded-lg bg-[#00205B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003087] transition-colors"
            >
              Dashboard Pluviométrico
            </Link>
            <Link
              href="/fluviometria"
              className="rounded-lg bg-[#003087] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0048b3] transition-colors"
            >
              Análise Fluviométrica
            </Link>
            <Link
              href="/transparencia"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Ver metodologia
            </Link>
          </div>
        </div>
      </section>

      {/* Pluviometria */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-slate-800">Análise Pluviométrica</h2>
          <p className="text-xs text-slate-400">Precipitação · ANA Hidroweb</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLUVIO.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${p.cor}`}
            >
              <p className={`font-semibold ${p.corTexto}`}>{p.titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{p.descricao}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Fluviometria */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-slate-800">Análise Fluviométrica</h2>
          <p className="text-xs text-slate-400">Vazão · ANA REST API</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FLUVIO.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${p.cor}`}
            >
              <p className={`font-semibold ${p.corTexto}`}>{p.titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{p.descricao}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Disciplina e integrantes */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-800">Disciplina</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-slate-500">Código</dt>
              <dd className="text-slate-700">HID-41</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-slate-500">Nome</dt>
              <dd className="text-slate-700">Hidrologia e Drenagem</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-slate-500">Professora</dt>
              <dd className="text-slate-700">Danielle de Almeida Bressiani</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-slate-500">Instituição</dt>
              <dd className="text-slate-700">ITA — Instituto Tecnológico de Aeronáutica</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-slate-500">Bacia</dt>
              <dd className="text-slate-700">Paraíba do Sul · URGHI 2 · SP</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-slate-500">Fonte dos dados</dt>
              <dd className="text-slate-700">
                ANA Hidroweb — séries pluviométricas e fluviométricas
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-800">Integrantes do grupo</h2>
          <div className="space-y-3">
            {INTEGRANTES.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00205B] text-xs font-bold text-white">
                  {p.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{p.nome}</p>
                  <p className="text-xs text-slate-400">{p.ra}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack tecnológica */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-slate-800">Stack tecnológica</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map((s) => (
            <div key={s.cat} className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{s.cat}</p>
              <ul className="space-y-1">
                {s.items.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[#00205B]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Análises realizadas */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-slate-800">Análises realizadas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-700">
              Pluviometria
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {[
                "Download e parsing de 377 ZIPs da ANA Hidroweb",
                "Inventário de qualidade: anos bons, % de falhas, período",
                "Série diária com priorização do nível de consistência 2",
                "Série mensal (meses com >5% de falhas → inválidos)",
                "Série anual (anos com qualquer mês inválido excluídos)",
                "Precipitação máxima diária anual com data de ocorrência",
                "Preenchimento por regressão linear múltipla",
                "Preenchimento por IDW (distância haversine)",
                "Validação cruzada holdout 10% (seed=42)",
                "Seleção do método vencedor pelo menor RMSE",
                "Histogramas e 16 estatísticas descritivas por série",
                "Mapa interativo com react-leaflet",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-indigo-700">
              Fluviometria
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {[
                "Coleta via ANA HidroWebService REST (token + cache)",
                "Descoberta automática de estações fluviométricas candidatas",
                "Séries diária, mensal e anual de vazão (Q)",
                "Curva-chave: medições e ajuste potencial Q = a(h-h₀)^b",
                "Curva de permanência (Q₉₅, Q₅₀, Q₁₀)",
                "Separação de escoamento base (filtro de Eckhardt)",
                "Isolamento de eventos chuva-vazão",
                "Hidrograma unitário sintético (SCS)",
                "Análise de frequência de cheias (Gumbel, GEV, log-Pearson III)",
                "Análise de estiagens (Q₇,₁₀ via Weibull/log-normal)",
                "Hietograma de projeto e curvas IDF",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

    </div>
  );
}
