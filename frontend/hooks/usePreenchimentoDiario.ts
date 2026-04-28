"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PreenchimentoDiario } from "@/lib/types";

export function usePreenchimentoDiario(codigo: string) {
  const [data, setData] = useState<PreenchimentoDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const PAGE = 1000;
    let cancelled = false;

    async function fetchAll() {
      const result: PreenchimentoDiario[] = [];
      let from = 0;
      while (true) {
        const { data: rows, error: err } = await supabase
          .from("preenchimento_diario")
          .select("estacao_codigo,data,valor_regressao,valor_idw")
          .eq("estacao_codigo", codigo)
          .order("data", { ascending: true })
          .range(from, from + PAGE - 1);
        if (cancelled) return;
        if (err) { setError(err.message); break; }
        if (!rows?.length) break;
        result.push(...(rows as PreenchimentoDiario[]));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (!cancelled) { setData(result); setLoading(false); }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [codigo]);

  return { data, loading, error };
}
