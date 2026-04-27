"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstacaoCandidata } from "@/lib/types";

export function useEstacoesCandidatas() {
  const [data, setData] = useState<EstacaoCandidata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("estacoes_candidatas")
      .select("codigo, inicio, fim, anos_bons, pct_falhas")
      .order("anos_bons", { ascending: false })
      .then(({ data: rows }) => {
        setData((rows ?? []) as EstacaoCandidata[]);
        setLoading(false);
      });
  }, []);

  return { data, loading };
}
