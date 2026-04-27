"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstacaoSemDados } from "@/lib/types";

export function useEstacoesSemDados() {
  const [data, setData] = useState<EstacaoSemDados[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("estacoes_sem_dados")
      .select("codigo, motivo, registrado_em")
      .order("codigo")
      .then(({ data: rows }) => {
        setData((rows ?? []) as EstacaoSemDados[]);
        setLoading(false);
      });
  }, []);

  return { data, loading };
}
