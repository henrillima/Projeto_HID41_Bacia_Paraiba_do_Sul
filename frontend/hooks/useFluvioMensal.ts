"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FluvioMensal } from "@/lib/types";

export function useFluvioMensal(codigo: string) {
  const [data, setData] = useState<FluvioMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("fluviometria_mensal")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano", { ascending: true })
      .order("mes", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as FluvioMensal[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
