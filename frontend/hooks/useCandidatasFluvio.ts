"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstacaoCandidataFluvio, ConfigEstacaoFluvio } from "@/lib/types";

export function useCandidatasFluvio() {
  const [data, setData] = useState<EstacaoCandidataFluvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("estacoes_candidatas_fluvio")
      .select("*")
      .order("score", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as EstacaoCandidataFluvio[]);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

export function useConfigFluvio() {
  const [data, setData] = useState<ConfigEstacaoFluvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("config_estacoes_fluvio")
      .select("*");
    if (err) setError(err.message);
    else setData((rows ?? []) as ConfigEstacaoFluvio[]);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
  }, []);

  const marcarOutlet = async (codigo: string, dados?: Partial<ConfigEstacaoFluvio>) => {
    setSaving(true);
    setError(null);
    try {
      // Remove flag de outlet das demais.
      await supabase
        .from("config_estacoes_fluvio")
        .update({ is_outlet: false })
        .neq("codigo", codigo);
      const upsertPayload = {
        codigo,
        is_outlet: true,
        atualizado_em: new Date().toISOString(),
        ...dados,
      };
      const { error: err } = await supabase
        .from("config_estacoes_fluvio")
        .upsert(upsertPayload);
      if (err) throw new Error(err.message);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const limparOutlet = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("config_estacoes_fluvio")
        .update({ is_outlet: false })
        .neq("codigo", "_dummy_");
      if (err) throw new Error(err.message);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return { data, loading, saving, error, marcarOutlet, limparOutlet, refetch };
}
