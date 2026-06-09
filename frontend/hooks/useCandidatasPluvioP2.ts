"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstacaoCandidataPluvioP2, ConfigPluviometroP2 } from "@/lib/types";

export function useCandidatasPluvioP2() {
  const [data, setData] = useState<EstacaoCandidataPluvioP2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("estacoes_candidatas_pluvio_p2")
      .select("*")
      .order("score", { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as EstacaoCandidataPluvioP2[]);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

export function useConfigPluvioP2() {
  const [data, setData] = useState<ConfigPluviometroP2[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("config_pluviometros_p2")
      .select("*");
    if (err) setError(err.message);
    else setData((rows ?? []) as ConfigPluviometroP2[]);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
  }, []);

  const ativar = async (
    codigo: string,
    dados?: Partial<ConfigPluviometroP2>,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        codigo,
        ativo: true,
        atualizado_em: new Date().toISOString(),
        ...dados,
      };
      const { error: err } = await supabase
        .from("config_pluviometros_p2")
        .upsert(payload);
      if (err) throw new Error(err.message);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const desativar = async (codigo: string) => {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("config_pluviometros_p2")
        .update({ ativo: false, atualizado_em: new Date().toISOString() })
        .eq("codigo", codigo);
      if (err) throw new Error(err.message);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return { data, loading, saving, error, ativar, desativar, refetch };
}
