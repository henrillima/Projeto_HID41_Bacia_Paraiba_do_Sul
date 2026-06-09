"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FluvioDiaria } from "@/lib/types";

const PAGE = 1000;

export function useFluvioDiaria(
  codigo: string,
  dataInicio?: string,
  dataFim?: string,
) {
  const [data, setData] = useState<FluvioDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    let cancelado = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const acumulado: FluvioDiaria[] = [];
        let from = 0;
        while (true) {
          let q = supabase
            .from("fluviometria_diaria")
            .select("*")
            .eq("estacao_codigo", codigo)
            .order("data", { ascending: true })
            .range(from, from + PAGE - 1);
          if (dataInicio) q = q.gte("data", dataInicio);
          if (dataFim) q = q.lte("data", dataFim);
          const { data: rows, error: err } = await q;
          if (err) throw new Error(err.message);
          const chunk = (rows ?? []) as FluvioDiaria[];
          acumulado.push(...chunk);
          if (chunk.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelado) setData(acumulado);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [codigo, dataInicio, dataFim]);

  return { data, loading, error };
}
