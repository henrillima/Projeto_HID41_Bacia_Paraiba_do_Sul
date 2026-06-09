"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CurvaChaveAjuste, MedicaoDescarga } from "@/lib/types";

export function useCurvaChaveAjuste(codigo: string) {
  const [data, setData] = useState<CurvaChaveAjuste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("curva_chave_ajuste")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("versao", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as CurvaChaveAjuste[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useCurvaChaveMedicoes(codigo: string) {
  const [data, setData] = useState<MedicaoDescarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("curva_chave_medicoes")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("data_medicao", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as MedicaoDescarga[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
