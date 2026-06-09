"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ChuvaProjeto,
  FrequenciaAjuste,
  FrequenciaQuantil,
  IDFCurvaPonto,
  IDFParametros,
  MaxAnualVazao,
} from "@/lib/types";

export function useMaxAnualVazao(codigo: string) {
  const [data, setData] = useState<MaxAnualVazao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("max_anual_vazao")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as MaxAnualVazao[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useFrequenciaAjustes(codigo: string) {
  const [data, setData] = useState<FrequenciaAjuste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("frequencia_ajuste")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("aic", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as FrequenciaAjuste[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useFrequenciaQuantis(codigo: string, distribuicao?: string) {
  const [data, setData] = useState<FrequenciaQuantil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    let q = supabase
      .from("frequencia_quantis")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("tr", { ascending: true });
    if (distribuicao) q = q.eq("distribuicao", distribuicao);
    q.then(({ data: rows, error: err }) => {
      if (err) setError(err.message);
      else setData((rows ?? []) as FrequenciaQuantil[]);
      setLoading(false);
    });
  }, [codigo, distribuicao]);

  return { data, loading, error };
}

export function useIDFParametros(regiao: string) {
  const [data, setData] = useState<IDFParametros | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regiao) return;
    supabase
      .from("idf_parametros")
      .select("*")
      .eq("regiao", regiao)
      .maybeSingle()
      .then(({ data: row }) => {
        setData(row as IDFParametros | null);
        setLoading(false);
      });
  }, [regiao]);

  return { data, loading };
}

export function useIDFCurva(regiao: string) {
  const [data, setData] = useState<IDFCurvaPonto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regiao) return;
    supabase
      .from("idf_curva")
      .select("*")
      .eq("regiao", regiao)
      .order("tr", { ascending: true })
      .order("duracao_min", { ascending: true })
      .then(({ data: rows }) => {
        setData((rows ?? []) as IDFCurvaPonto[]);
        setLoading(false);
      });
  }, [regiao]);

  return { data, loading };
}

export function useChuvasProjeto(regiao: string) {
  const [data, setData] = useState<ChuvaProjeto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regiao) return;
    supabase
      .from("chuva_projeto")
      .select("*")
      .eq("regiao", regiao)
      .order("tr", { ascending: true })
      .then(({ data: rows }) => {
        setData((rows ?? []) as ChuvaProjeto[]);
        setLoading(false);
      });
  }, [regiao]);

  return { data, loading };
}
