"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CurvaPermanenciaPonto,
  EckhardtParams,
  EckhardtSerie,
  Q710Ajuste,
  Q7Minimo,
  QuantisPermanencia,
} from "@/lib/types";

const PAGE = 1000;

export function useCurvaPermanencia(codigo: string) {
  const [data, setData] = useState<CurvaPermanenciaPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("curva_permanencia")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("percentil", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as CurvaPermanenciaPonto[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useQuantisPermanencia(codigo: string) {
  const [data, setData] = useState<QuantisPermanencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("quantis_permanencia")
      .select("*")
      .eq("estacao_codigo", codigo)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (err) setError(err.message);
        else setData(row as QuantisPermanencia | null);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useEckhardtSerie(codigo: string) {
  const [data, setData] = useState<EckhardtSerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    let cancelado = false;
    setLoading(true);
    (async () => {
      try {
        const acumulado: EckhardtSerie[] = [];
        let from = 0;
        while (true) {
          const { data: rows, error: err } = await supabase
            .from("eckhardt_serie")
            .select("*")
            .eq("estacao_codigo", codigo)
            .order("data", { ascending: true })
            .range(from, from + PAGE - 1);
          if (err) throw new Error(err.message);
          const chunk = (rows ?? []) as EckhardtSerie[];
          acumulado.push(...chunk);
          if (chunk.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelado) setData(acumulado);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  return { data, loading, error };
}

export function useEckhardtParams(codigo: string) {
  const [data, setData] = useState<EckhardtParams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("eckhardt_params")
      .select("*")
      .eq("estacao_codigo", codigo)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (err) setError(err.message);
        else setData(row as EckhardtParams | null);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useQ7Minimos(codigo: string) {
  const [data, setData] = useState<Q7Minimo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("q7_minimos_anuais")
      .select("*")
      .eq("estacao_codigo", codigo)
      .order("ano_hidrologico", { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows ?? []) as Q7Minimo[]);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}

export function useQ710Ajuste(codigo: string) {
  const [data, setData] = useState<Q710Ajuste | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    supabase
      .from("q7_10_ajuste")
      .select("*")
      .eq("estacao_codigo", codigo)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (err) setError(err.message);
        else setData(row as Q710Ajuste | null);
        setLoading(false);
      });
  }, [codigo]);

  return { data, loading, error };
}
