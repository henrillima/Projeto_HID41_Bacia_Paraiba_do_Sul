"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrecipitacaoAnual } from "@/lib/types";

export function useSerieAnual(codigo: string) {
  const [data, setData] = useState<PrecipitacaoAnual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("precipitacao_anual")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as PrecipitacaoAnual[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
