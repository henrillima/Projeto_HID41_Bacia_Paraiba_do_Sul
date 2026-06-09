"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FluvioAnual } from "@/lib/types";

export function useFluvioAnual(codigo: string) {
  const [data, setData] = useState<FluvioAnual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("fluviometria_anual")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as FluvioAnual[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
