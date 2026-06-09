"""
Baixa dados pluviométricos da ANA REST para o Projeto 2 (chuva-vazão da bacia).

Análogo a `download_fluvio.py`, mas para estações pluviométricas dentro/perto
da bacia do exutório fluvio (58142200 — BUQUIRINHA II). Mantém o BI do
Projeto 1 intocado: novas estações entram em `estacoes` com `projeto = 'P2'`,
e a view `resumo_estacoes` filtra só `projeto = 'P1'`.

Modos de uso:
  # 1) Descobrir pluviômetros candidatos (Paraíba do Sul, prefixos 022xx)
  python download_pluvio_p2.py discover --top 15

  # 2) Inspecionar uma estação específica
  python download_pluvio_p2.py info 02245006

  # 3) Baixar séries das estações marcadas ativas em config_pluviometros_p2
  python download_pluvio_p2.py baixar --do-config

  # 4) Baixar séries de códigos explícitos
  python download_pluvio_p2.py baixar 02245006 02245009

A descoberta usa o inventário ANA filtrado por UF e bacia macro, retém só
`Tipo_Estacao=pluv*` e prefixos do Paraíba do Sul, e ranqueia por anos de
dados + proximidade ao exutório.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import pandas as pd
import yaml
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent))

from src.ana_client import HidroWebError, client_from_env  # noqa: E402
from src.pluvio_api import fetch_chuva_diaria  # noqa: E402
from src.pluvio_discover import (  # noqa: E402
    SUB_BACIAS_PLUVIO_PARAIBA_SUL,
    descobrir_pluvio,
    rankear_pluvio_p2,
)
from src.supabase_loader import (  # noqa: E402
    get_client,
    insert_candidatas_pluvio_p2,
    insert_serie_diaria,
    upsert_estacao_pluvio_p2,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("download_pluvio_p2")

console = Console()
ROOT = Path(__file__).parent
CONFIG_FILE = ROOT / "config.yaml"


def _load_config() -> dict:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def _supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes em .env")
    return get_client(url, key)


def _exutorio_coords(cfg: dict, client_supa) -> tuple[float, float]:
    """Coordenadas do exutório fluvio. Tenta, em ordem:
      1. config_estacoes_fluvio (marcado via UI /selecao-fluvio)
      2. estacoes_fluvio (populado por pipeline_fluvio.py)
      3. Inventário ANA REST (fallback online)
    """
    # (1) UI selection
    rows = (
        client_supa.table("config_estacoes_fluvio")
        .select("codigo, lat, lon, is_outlet")
        .eq("is_outlet", True)
        .execute()
        .data
    )
    if rows and rows[0].get("lat") is not None and rows[0].get("lon") is not None:
        return float(rows[0]["lat"]), float(rows[0]["lon"])

    codigo = str(cfg.get("fluviometria", {}).get("exutorio_codigo", "")).strip()

    # (2) estacoes_fluvio (gravado pelo pipeline)
    if codigo:
        rows = (
            client_supa.table("estacoes_fluvio")
            .select("codigo, lat, lon")
            .eq("codigo", codigo)
            .execute()
            .data
        )
        if rows and rows[0].get("lat") is not None and rows[0].get("lon") is not None:
            return float(rows[0]["lat"]), float(rows[0]["lon"])

    if not codigo:
        raise SystemExit(
            "Nenhum exutório fluvio configurado (config_estacoes_fluvio vazio, "
            "estacoes_fluvio sem registro e fluviometria.exutorio_codigo ausente). "
            "Rode `download_fluvio.py discover` ou `pipeline_fluvio.py` antes."
        )

    # (3) ANA REST inventário
    client_ana = client_from_env()
    inv = client_ana.inventario(codigo_estacao=codigo)
    if not inv:
        raise SystemExit(f"Exutório {codigo} não encontrado no inventário ANA.")
    e = inv[0]
    lat = float(str(e.get("Latitude", "0")).replace(",", "."))
    lon = float(str(e.get("Longitude", "0")).replace(",", "."))
    return lat, lon


# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------

def cmd_discover(args: argparse.Namespace) -> None:
    cfg = _load_config()
    fluvio_cfg = cfg.get("fluviometria", {})
    rank_cfg = fluvio_cfg.get("ranking", {})

    client_supa = _supabase_client()
    client_ana = client_from_env()
    ex_lat, ex_lon = _exutorio_coords(cfg, client_supa)
    logger.info(f"Exutório de referência: ({ex_lat:.4f}, {ex_lon:.4f})")

    ufs = fluvio_cfg.get("ufs") or (["SP"])
    df_cand = descobrir_pluvio(
        client_ana,
        ufs=ufs,
        codigo_bacia_macro=int(fluvio_cfg.get("codigo_bacia", 5)),
        filtro_sub_bacia=SUB_BACIAS_PLUVIO_PARAIBA_SUL,
        apenas_operando=bool(fluvio_cfg.get("apenas_operando", False)),
    )
    if df_cand.empty:
        console.print("[red]Nenhuma pluviométrica candidata encontrada.[/red]")
        return

    df = rankear_pluvio_p2(
        df_cand,
        exutorio_lat=ex_lat,
        exutorio_lon=ex_lon,
        peso_anos=float(rank_cfg.get("peso_anos", 0.5)),
        peso_falhas=float(rank_cfg.get("peso_falhas", 0.3)),
        peso_proximidade=float(rank_cfg.get("peso_proximidade", 0.2)),
        anos_referencia=float(rank_cfg.get("anos_referencia", 40)),
        raio_referencia_km=float(rank_cfg.get("raio_referencia_km", 20)),
    )

    out_csv = ROOT / "data" / "pluvio_p2_candidatas.csv"
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False, encoding="utf-8")

    insert_candidatas_pluvio_p2(client_supa, df)

    n = args.top
    df_top = df.head(n)
    table = Table(title=f"Pluviometricas candidatas P2 (top {n})")
    for col in ["codigo", "nome", "anos", "dist_km", "operando", "score"]:
        table.add_column(col)
    for _, r in df_top.iterrows():
        nome = str(r.get("nome", ""))[:30].encode("ascii", "ignore").decode("ascii")
        table.add_row(
            str(r["codigo"]),
            nome,
            f"{r.get('anos_dados', 0):.1f}",
            f"{(r.get('dist_exutorio_km') or float('nan')):.1f}",
            "sim" if r.get("operando") else "nao",
            f"{r['score']:.3f}",
        )
    try:
        console.print(table)
    except UnicodeEncodeError:
        print(df_top.to_string(index=False))
    console.print(f"[green]Salvo:[/green] {out_csv}")
    console.print(
        "[blue]Próximo passo:[/blue] abrir /selecao-pluvio-p2 no front e marcar "
        "as estações ativas para o Projeto 2."
    )


def cmd_info(args: argparse.Namespace) -> None:
    client_ana = client_from_env()
    raw = client_ana.inventario(codigo_estacao=args.codigo)
    if not raw:
        console.print(f"[red]Estação {args.codigo} não encontrada.[/red]")
        return
    console.print(json.dumps(raw[0], indent=2, ensure_ascii=False))


def cmd_baixar(args: argparse.Namespace) -> None:
    cfg = _load_config()
    fluvio_cfg = cfg.get("fluviometria", {})
    client_supa = _supabase_client()
    client_ana = client_from_env()

    codigos: list[str] = list(args.codigos or [])
    if args.do_config or not codigos:
        rows = (
            client_supa.table("config_pluviometros_p2")
            .select("codigo")
            .eq("ativo", True)
            .execute()
            .data
        )
        codigos = [str(r["codigo"]) for r in rows if r.get("codigo")]
        if not codigos:
            console.print(
                "[red]Nenhum pluviômetro ativo em config_pluviometros_p2.[/red] "
                "Marque ao menos uma estação em /selecao-pluvio-p2."
            )
            return

    ini = fluvio_cfg.get("data_inicio", "1970-01-01")
    fim = fluvio_cfg.get("data_fim", "2025-12-31")

    for cod in codigos:
        print(f"\n== Pluvio P2 {cod} ({ini} -> {fim}) ==")
        try:
            meta, df = fetch_chuva_diaria(client_ana, cod, ini, fim)
        except HidroWebError as exc:
            console.print(f"  [red]erro REST: {exc}[/red]")
            continue

        if df.empty:
            console.print("  [yellow]sem dados — pulando.[/yellow]")
            continue

        # Upsert da estação (com projeto='P2')
        def _f(v):
            try:
                return float(str(v).replace(",", ".")) if v is not None else None
            except (TypeError, ValueError):
                return None

        upsert_estacao_pluvio_p2(client_supa, {
            "codigo":   cod,
            "nome":     meta.get("NomeEstacao") or f"PLUVIO {cod}",
            "lat":      _f(meta.get("Latitude")),
            "lon":      _f(meta.get("Longitude")),
            "altitude": _f(meta.get("Altitude")),
            "data_inicio": df["data"].min().date().isoformat(),
            "data_fim":    df["data"].max().date().isoformat(),
            "n_dias_total":  int(len(df)),
            "n_dias_com_dado": int(df["valor"].notna().sum()),
        })

        # Série diária (sem preenchimento — bruto da ANA, consistência preservada)
        df_out = df.assign(preenchido=False, metodo=None)
        insert_serie_diaria(client_supa, cod, df_out)
        console.print(
            f"  [green]gravado[/green] | {len(df)} dias, "
            f"{int(df['valor'].notna().sum())} com chuva"
        )

    console.print(
        "\n[blue]Próximo passo:[/blue] re-rodar `python pipeline_fluvio.py` — "
        "a Fase 3 passará a usar a chuva média da bacia destas estações."
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description="Descobre e baixa pluviômetros do Projeto 2 (chuva-vazão)."
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_disc = sub.add_parser("discover", help="Descobre e ranqueia candidatas")
    p_disc.add_argument("--top", type=int, default=15, help="Quantos exibir")
    p_disc.set_defaults(func=cmd_discover)

    p_info = sub.add_parser("info", help="Mostra metadados de uma estação")
    p_info.add_argument("codigo", help="Código ANA pluviométrico")
    p_info.set_defaults(func=cmd_info)

    p_dl = sub.add_parser("baixar", help="Baixa séries pluviométricas")
    p_dl.add_argument("codigos", nargs="*",
                      help="Códigos explícitos (sobrepõe --do-config se ambos)")
    p_dl.add_argument("--do-config", action="store_true",
                      help="Usa as estações ativas em config_pluviometros_p2 "
                           "(default quando não há códigos)")
    p_dl.set_defaults(func=cmd_baixar)
    return ap


def main(argv: list[str] | None = None) -> None:
    load_dotenv(ROOT / ".env")
    ap = build_parser()
    args = ap.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
