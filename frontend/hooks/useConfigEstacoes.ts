"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ConfigEstacao } from "@/lib/types";

export function useConfigEstacoes() {
  const [data, setData] = useState<ConfigEstacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(() => {
    supabase
      .from("config_estacoes")
      .select("*")
      .order("is_referencia", { ascending: false })
      .then(({ data: rows }) => {
        setData((rows ?? []) as ConfigEstacao[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const salvar = useCallback(async (estacoes: ConfigEstacao[]) => {
    setSaving(true);
    // Remove todas as existentes e reinsere (garante idempotência)
    const codigosNovos = estacoes.map((e) => e.codigo);

    // Delete estações que foram desselecionadas
    const { data: atuais } = await supabase
      .from("config_estacoes")
      .select("codigo");
    const codigosAtuais = (atuais ?? []).map((r: { codigo: string }) => r.codigo);
    const remover = codigosAtuais.filter((c: string) => !codigosNovos.includes(c));
    if (remover.length > 0) {
      await supabase.from("config_estacoes").delete().in("codigo", remover);
    }

    // Upsert das selecionadas
    if (estacoes.length > 0) {
      await supabase.from("config_estacoes").upsert(
        estacoes.map((e) => ({
          ...e,
          atualizado_em: new Date().toISOString(),
        }))
      );
    }

    setSaving(false);
    fetch();
  }, [fetch]);

  return { data, loading, saving, salvar };
}
