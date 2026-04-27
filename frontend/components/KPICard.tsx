import { cn } from "@/lib/utils";

interface KPICardProps {
  titulo: string;
  valor: string;
  subtitulo?: string;
  destaque?: boolean;
  className?: string;
}

export function KPICard({ titulo, valor, subtitulo, destaque, className }: KPICardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm",
        destaque && "border-blue-600 bg-blue-50",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={cn("mt-1 text-3xl font-bold", destaque ? "text-blue-700" : "text-slate-800")}>
        {valor}
      </p>
      {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
    </div>
  );
}
