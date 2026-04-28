"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrecipitacaoDiaria } from "@/lib/types";

const PAGE = 1000;

export function useSerieDiaria(codigo: string, dataInicio?: string, dataFim?: string) {
  const [data, setData] = useState<PrecipitacaoDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) { setData([]); setLoading(false); return; }
    setLoading(true);
    setError(null);

    let cancelled = false;

    async function fetchAll() {
      const result: PrecipitacaoDiaria[] = [];
      let from = 0;
      while (true) {
        let q = supabase
          .from("precipitacao_diaria")
          .select("estacao_codigo,data,valor,preenchido,metodo,consistencia")
          .eq("estacao_codigo", codigo)
          .order("data", { ascending: true })
          .range(from, from + PAGE - 1);

        if (dataInicio) q = q.gte("data", dataInicio);
        if (dataFim)    q = q.lte("data", dataFim);

        const { data: rows, error: err } = await q;
        if (cancelled) return;
        if (err) { setError(err.message); setLoading(false); return; }
        if (!rows?.length) break;
        result.push(...(rows as PrecipitacaoDiaria[]));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (!cancelled) { setData(result); setLoading(false); }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [codigo, dataInicio, dataFim]);

  return { data, loading, error };
}
