import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-8xl font-black text-slate-100">404</p>
      <p className="mt-2 text-xl font-bold text-slate-700">Página não encontrada</p>
      <p className="mt-2 text-sm text-slate-400">
        A rota que você acessou não existe neste dashboard.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-[#00205B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#003087] transition-colors"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
