"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrecipitacaoDiaria } from "@/lib/types";

const PAGE_SIZE = 5000;

export function useSerieDiaria(codigo: string, dataInicio?: string, dataFim?: string) {
  const [data, setData] = useState<PrecipitacaoDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    setLoading(true);
    setError(null);

    let query = supabase
      .from("precipitacao_diaria")
      .select("estacao_codigo,data,valor,preenchido,metodo,consistencia")
      .eq("estacao_codigo", codigo)
      .order("data", { ascending: true })
      .limit(PAGE_SIZE);

    if (dataInicio) query = query.gte("data", dataInicio);
    if (dataFim)    query = query.lte("data", dataFim);

    query.then(({ data: rows, error: err }) => {
      if (err) setError(err.message);
      else setData((rows ?? []) as PrecipitacaoDiaria[]);
      setLoading(false);
    });
  }, [codigo, dataInicio, dataFim]);

  return { data, loading, error };
}
