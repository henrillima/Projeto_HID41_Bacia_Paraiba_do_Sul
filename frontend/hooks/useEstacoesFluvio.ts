"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstacaoFluvio } from "@/lib/types";

export function useEstacoesFluvio() {
  const [data, setData] = useState<EstacaoFluvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("estacoes_fluvio")
      .select("*")
      .order("is_outlet", { ascending: false })
      .order("area_drenagem_km2", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as EstacaoFluvio[]);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
