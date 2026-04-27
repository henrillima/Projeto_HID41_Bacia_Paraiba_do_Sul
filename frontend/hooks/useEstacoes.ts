"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ResumoEstacao } from "@/lib/types";

export function useEstacoes() {
  const [data, setData] = useState<ResumoEstacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("resumo_estacoes")
      .select("*")
      .order("anos_dados", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as ResumoEstacao[]);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
