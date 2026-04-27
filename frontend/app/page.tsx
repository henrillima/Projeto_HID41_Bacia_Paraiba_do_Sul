import Image from "next/image";
import Link from "next/link";

const INTEGRANTES = [
  { nome: "Henri Leonardo dos Santos Lima", ra: "ITA · Engenharia Civil-Aeronáutica" },
  { nome: "Pedro Feitosa Gutemberg",        ra: "ITA · Engenharia Civil-Aeronáutica" },
  { nome: "Gustavo Vidal Feitosa",          ra: "ITA · Engenharia Civil-Aeronáutica" },
];

const PAGINAS = [
  {
    href: "/dashboard",
    titulo: "Dashboard",
    descricao: "KPIs, mapa interativo e cards de cada estação selecionada.",
    cor: "border-blue-200 bg-blue-50",
    corTexto: "text-blue-700",
  },
  {
    href: "/estacoes",
    titulo: "Estações",
    descricao: "Navegue pelas estações processadas com séries diárias, mensais, anuais e histogramas.",
    cor: "border-sky-200 bg-sky-50",
    corTexto: "text-sky-700",
  },
  {
    href: "/selecao",
    titulo: "Seleção",
    descricao: "Interface para escolher as estações de análise, informar coordenadas e definir a referência.",
    cor: "border-violet-200 bg-violet-50",
    corTexto: "text-violet-700",
  },
  {
    href: "/preenchimento",
    titulo: "Preenchimento",
    descricao: "Comparação entre regressão linear múltipla e IDW na estação de referência.",
    cor: "border-emerald-200 bg-emerald-50",
    corTexto: "text-emerald-700",
  },
  {
    href: "/transparencia",
    titulo: "Transparência",
    descricao: "Documentação completa de cada etapa: coleta, construção das séries e resultados do preenchimento.",
    cor: "border-amber-200 bg-amber-50",
    corTexto: "text-amber-700",
  },
];

const STACK = [
  { cat: "Frontend",   items: ["Next.js 14 · App Router", "React 18", "TypeScript", "Tailwind CSS", "Recharts", "react-leaflet"] },
  { cat: "Backend",    items: ["Supabase (PostgreSQL)", "Row Level Security", "Views SQL"] },
  { cat: "Pipeline",   items: ["Python 3.11", "pandas · numpy", "scikit-learn (regressão)", "haversine (IDW)", "supabase-py"] },
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
            Análise Pluviométrica · Bacia do Paraíba do Sul (URGHI 2)
          </p>
          <p className="mt-3 max-w-2xl text-sm text-slate-500">
            Dashboard interativo para análise de séries históricas de precipitação de estações
            pluviométricas da ANA Hidroweb. Contempla construção das séries diária, mensal e
            anual, preenchimento de falhas por regressão múltipla e IDW, histogramas e
            estatísticas descritivas completas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:justify-start">
            <Link
              href="/dashboard"
              className="rounded-lg bg-[#00205B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003087] transition-colors"
            >
              Abrir dashboard
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

      {/* Seções do dashboard */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-slate-800">O que está disponível</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAGINAS.map((p) => (
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
              <dd className="text-slate-700">ANA Hidroweb — séries históricas diárias</dd>
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
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {[
              "Download e parsing de 377 ZIPs da ANA Hidroweb",
              "Inventário de qualidade: anos bons, % de falhas, período",
              "Série diária com priorização do nível de consistência 2",
              "Série mensal (meses com >5% de falhas marcados como inválidos)",
              "Série anual (anos com qualquer mês inválido excluídos)",
              "Precipitação máxima diária anual com data de ocorrência",
              "Preenchimento de falhas por regressão linear múltipla",
              "Preenchimento de falhas por IDW (distância haversine)",
              "Validação cruzada holdout 10% com semente fixa (seed=42)",
              "Seleção automática do método vencedor pelo menor RMSE",
              "Histogramas de frequência para todas as séries (diária, mensal, anual, máx.)",
              "16 estatísticas descritivas por série (média, mediana, percentis, assimetria, curtose...)",
              "Mapa interativo das estações com react-leaflet",
              "Documentação de 89 estações sem dados disponíveis na fonte",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-500">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

    </div>
  );
}
