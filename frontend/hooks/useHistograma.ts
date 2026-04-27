"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Histograma, TipoSerie } from "@/lib/types";

export function useHistograma(codigo: string, tipo: TipoSerie) {
  const [data, setData] = useState<Histograma | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo || !tipo) return;
    setLoading(true);
    supabase
      .from("histogramas")
      .select("*")
      .eq("estacao_codigo", codigo)
      .eq("tipo", tipo)
      .single()
      .then(({ data: row, error: err }) => {
        if (err && err.code !== "PGRST116") setError(err.message);
        else setData(row as Histograma | null);
        setLoading(false);
      });
  }, [codigo, tipo]);

  return { data, loading, error };
}
