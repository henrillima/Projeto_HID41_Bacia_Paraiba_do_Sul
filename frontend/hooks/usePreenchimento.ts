"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PreenchimentoResultado } from "@/lib/types";

export function usePreenchimento(codigoRef: string) {
  const [data, setData] = useState<PreenchimentoResultado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigoRef) return;
    supabase
      .from("preenchimento_resultado")
      .select("*")
      .eq("estacao_referencia", codigoRef)
      .order("metodo", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as PreenchimentoResultado[]);
        setLoading(false);
      });
  }, [codigoRef]);

  const vencedor = data.find((r) => r.is_vencedor) ?? null;
  const perdedor = data.find((r) => !r.is_vencedor) ?? null;

  return { data, vencedor, perdedor, loading, error };
}
