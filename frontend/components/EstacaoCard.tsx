import Link from "next/link";
import { MapPin, Star, TrendingUp } from "lucide-react";
import { fmtMm, fmtPct } from "@/lib/utils";
import type { ResumoEstacao } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EstacaoCardProps {
  estacao: ResumoEstacao;
}

export function EstacaoCard({ estacao: e }: EstacaoCardProps) {
  return (
    <Link
      href={`/series/${e.codigo}`}
      className={cn(
        "group block rounded-xl border bg-white p-5 shadow-sm transition",
        "hover:border-blue-500 hover:shadow-md",
        e.is_referencia && "border-blue-400 bg-blue-50/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800 group-hover:text-blue-700">{e.nome}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{e.codigo}</p>
        </div>
        {e.is_referencia && (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            <Star size={11} />
            Referência
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Média anual</p>
          <p className="font-semibold text-slate-700">{fmtMm(e.media_anual_mm, 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Anos de dados</p>
          <p className="font-semibold text-slate-700">{e.anos_dados ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Falhas (orig.)</p>
          <p
            className={cn(
              "font-semibold",
              (e.pct_falhas_original ?? 0) > 10 ? "text-orange-600" : "text-emerald-600"
            )}
          >
            {fmtPct(e.pct_falhas_original)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Período</p>
          <p className="font-semibold text-slate-700">
            {e.data_inicio?.slice(0, 4)} – {e.data_fim?.slice(0, 4)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
        <MapPin size={11} />
        <span>{e.lat?.toFixed(3)}, {e.lon?.toFixed(3)}</span>
        {e.altitude != null && <span className="ml-2">· {e.altitude} m</span>}
      </div>
    </Link>
  );
}
