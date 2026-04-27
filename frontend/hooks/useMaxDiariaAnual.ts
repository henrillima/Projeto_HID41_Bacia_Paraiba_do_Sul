"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MaxDiariaAnual } from "@/lib/types";

export function useMaxDiariaAnual(codigo: string) {
  const [data, setData] = useState<MaxDiariaAnual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("max_diaria_anual")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as MaxDiariaAnual[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
