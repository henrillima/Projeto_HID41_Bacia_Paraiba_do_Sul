"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrecipitacaoMensal } from "@/lib/types";

export function useSerieMensal(codigo: string) {
  const [data, setData] = useState<PrecipitacaoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("precipitacao_mensal")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano", { ascending: true })
      .order("mes", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as PrecipitacaoMensal[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
