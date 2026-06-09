"""
Baixa dados fluviométricos da ANA via REST HidroWebService.

Modos de uso:
  # 1) Descobrir candidatas a exutório (Paraíba do Sul, sub-bacias 57/58)
  python download_fluvio.py --discover

  # 2) Baixar dados completos das estações escolhidas
  python download_fluvio.py --baixar 58235100 58234100 ...
  python download_fluvio.py --baixar-do-config

  # 3) Inspecionar uma estação específica (metadados)
  python download_fluvio.py --info 58235100

A descoberta usa o inventário em `UF=SP` + `Código da Bacia=8` (Atlântico
Sudeste), filtrando por prefixos `58` / `57` que correspondem ao Paraíba do
Sul. Pluviômetros do projeto (lat/lon) servem como referência para o cálculo
da distância de proximidade no ranking.

Os JSON brutos ficam em `pipeline/data/raw_v2/` (idempotente).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import pandas as pd
import yaml
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent))

import os  # noqa: E402

from src.ana_client import HidroWebError, client_from_env  # noqa: E402
from src.fluvio_discover import descobrir_fluvio, rankear_candidatas  # noqa: E402
from src.fluvio_parser import (  # noqa: E402
    parse_curva_descarga,
    parse_medicoes_descarga,
    parse_serie_cotas,
    parse_serie_vazao,
)
from src.supabase_loader import get_client, insert_candidatas_fluvio  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("download_fluvio")

console = Console()
ROOT = Path(__file__).parent
CONFIG_FILE = ROOT / "config.yaml"


def _load_config() -> dict:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def _pluvios_para_ranking(cfg: dict) -> pd.DataFrame:
    """Extrai lat/lon das estações pluviométricas atuais como referência."""
    linhas = []
    for e in cfg.get("estacoes", []):
        if e.get("lat") is None or e.get("lon") is None:
            continue
        linhas.append({
            "codigo": str(e.get("codigo", "")).strip(),
            "lat": float(e["lat"]),
            "lon": float(e["lon"]),
        })
    return pd.DataFrame(linhas)


# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------

def cmd_discover(args: argparse.Namespace) -> None:
    cfg = _load_config()
    fluvio_cfg = cfg.get("fluviometria", {})
    rank_cfg = fluvio_cfg.get("ranking", {})

    client = client_from_env()
    ufs = fluvio_cfg.get("ufs") or ([fluvio_cfg["uf"]] if fluvio_cfg.get("uf") else None)
    df_cand = descobrir_fluvio(
        client,
        ufs=ufs,
        codigo_bacia_macro=int(fluvio_cfg.get("codigo_bacia", 8)),
        filtro_sub_bacia=set(fluvio_cfg.get("sub_bacias_pref", ["58", "57"])),
        apenas_operando=bool(fluvio_cfg.get("apenas_operando", False)),
    )
    if df_cand.empty:
        console.print("[red]Nenhuma candidata encontrada.[/red]")
        return

    pluvios = _pluvios_para_ranking(cfg)
    if pluvios.empty:
        logger.warning("Sem pluviômetros configurados — score de proximidade neutralizado.")
        pluvios = pd.DataFrame([{"codigo": "ref", "lat": -22.91, "lon": -45.47}])

    df = rankear_candidatas(
        df_cand,
        pluvios,
        peso_anos=float(rank_cfg.get("peso_anos", 0.5)),
        peso_falhas=float(rank_cfg.get("peso_falhas", 0.3)),
        peso_proximidade=float(rank_cfg.get("peso_proximidade", 0.2)),
        anos_referencia=float(rank_cfg.get("anos_referencia", 40)),
        raio_referencia_km=float(rank_cfg.get("raio_referencia_km", 20)),
    )

    # Persiste CSV ANTES de tentar imprimir (Windows console pode falhar em acentos)
    out_csv = ROOT / "data" / "fluvio_candidatas.csv"
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False, encoding="utf-8")

    # Persiste ranking no Supabase para o BI (/selecao-fluvio).
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        try:
            client_supa = get_client(url, key)
            insert_candidatas_fluvio(client_supa, df)
        except Exception as exc:
            logger.warning(f"falha ao persistir candidatas no Supabase: {exc}")
    else:
        logger.warning("SUPABASE_URL/SERVICE_KEY ausentes — ranking apenas em CSV.")

    # Apresenta top-N
    n = args.top
    df_top = df.head(n)

    table = Table(title=f"Candidatas fluviometricas (top {n})")
    for col in ["codigo", "nome", "area_km2", "anos",
                "dist_km", "operando", "score"]:
        table.add_column(col)
    for _, r in df_top.iterrows():
        nome = str(r.get("nome", ""))[:30].encode("ascii", "ignore").decode("ascii")
        table.add_row(
            str(r["codigo"]),
            nome,
            f"{(r.get('area_drenagem_km2') or 0):.0f}",
            f"{r.get('anos_dados', 0):.1f}",
            f"{(r.get('dist_min_km') or float('nan')):.1f}",
            "sim" if r.get("operando") else "nao",
            f"{r['score']:.3f}",
        )
    try:
        console.print(table)
    except UnicodeEncodeError:
        # Fallback simples se o console Windows não aceitar caracteres especiais.
        print(df_top.to_string(index=False))
    console.print(f"[green]Salvo:[/green] {out_csv}")


def cmd_info(args: argparse.Namespace) -> None:
    cfg = _load_config()
    fluvio_cfg = cfg.get("fluviometria", {})
    client = client_from_env()

    raw = client.inventario(codigo_estacao=args.codigo)
    if not raw:
        console.print(f"[red]Estação {args.codigo} não encontrada.[/red]")
        return
    e = raw[0]
    console.print(json.dumps(e, indent=2, ensure_ascii=False))


def cmd_baixar(args: argparse.Namespace) -> None:
    cfg = _load_config()
    fluvio_cfg = cfg.get("fluviometria", {})
    client = client_from_env()

    codigos = args.codigos
    if args.config:
        # Pega de pipeline/data/fluvio_candidatas.csv (top-1) se nenhum código foi dado.
        csv = ROOT / "data" / "fluvio_candidatas.csv"
        if not csv.exists():
            console.print(
                f"[red]{csv} não existe — rode `--discover` antes "
                f"ou passe códigos explícitos.[/red]"
            )
            return
        df = pd.read_csv(csv).head(1)
        codigos = [str(c) for c in df["codigo"].tolist()]

    if not codigos:
        console.print("[red]Nenhum código informado.[/red]")
        return

    ini = fluvio_cfg.get("data_inicio", "1970-01-01")
    fim = fluvio_cfg.get("data_fim", "2025-12-31")

    for cod in codigos:
        console.print(f"\n[bold]== Estação {cod} ({ini} → {fim}) ==[/bold]")
        try:
            v = client.serie_vazao(cod, ini, fim)
            df_v = parse_serie_vazao(v)
            console.print(f"  vazão diária:   {len(df_v):>6d} dias")

            c = client.serie_cotas(cod, ini, fim)
            df_c = parse_serie_cotas(c)
            console.print(f"  cota diária:    {len(df_c):>6d} dias")

            m = client.medicoes_descarga(cod, ini, fim)
            df_m = parse_medicoes_descarga(m)
            console.print(f"  medições:       {len(df_m):>6d} pontos")

            try:
                cd = client.curva_descarga(cod, ini, fim)
                df_cd = parse_curva_descarga(cd)
                console.print(f"  curva ANA:      {len(df_cd):>6d} versões")
            except HidroWebError as exc:
                console.print(f"  curva ANA:      [yellow]falhou ({exc})[/yellow]")
        except HidroWebError as exc:
            console.print(f"  [red]erro: {exc}[/red]")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Baixa dados fluviométricos via ANA REST.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_disc = sub.add_parser("discover", help="Descobre e ranqueia candidatas")
    p_disc.add_argument("--top", type=int, default=10, help="Quantos exibir")
    p_disc.set_defaults(func=cmd_discover)

    p_info = sub.add_parser("info", help="Mostra metadados de uma estação")
    p_info.add_argument("codigo", help="Código ANA")
    p_info.set_defaults(func=cmd_info)

    p_dl = sub.add_parser("baixar", help="Baixa séries completas")
    p_dl.add_argument("codigos", nargs="*", help="Códigos de estações")
    p_dl.add_argument("--config", action="store_true",
                      help="Usa primeira candidata do CSV gerado por discover")
    p_dl.set_defaults(func=cmd_baixar)
    return ap


def main(argv: list[str] | None = None) -> None:
    load_dotenv(ROOT / ".env")
    ap = build_parser()
    args = ap.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
