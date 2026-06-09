"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ComparacaoUH,
  EventoChuvaVazao,
  HidrogramaUnitarioObservado,
  HidrogramaUnitarioScs,
} from "@/lib/types";

export function useEventos(codigo: string) {
  const [data, setData] = useState<EventoChuvaVazao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("eventos_chuva_vazao")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("t_pico", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as EventoChuvaVazao[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useHUObservado(codigo: string) {
  const [data, setData] = useState<HidrogramaUnitarioObservado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("hidrograma_unitario_observado")
      .select("*")
      .eq("estacao_codigo", codigo)
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as HidrogramaUnitarioObservado[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useHUScs(codigo: string) {
  const [data, setData] = useState<HidrogramaUnitarioScs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("hidrograma_unitario_scs")
      .select("*")
      .eq("estacao_codigo", codigo)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (err) setError(err.message);
        else setData(row as HidrogramaUnitarioScs | null);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useComparacaoUH(codigo: string) {
  const [data, setData] = useState<ComparacaoUH[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("comparacao_uh")
      .select("*")
      .eq("estacao_codigo", codigo)
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as ComparacaoUH[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
