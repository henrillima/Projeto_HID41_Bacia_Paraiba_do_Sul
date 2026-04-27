"""
Ferramenta de descoberta de estações: escaneia TODOS os ZIPs em data/raw/,
parseia-os e exibe uma tabela de qualidade para ajudar na escolha das 3
melhores estações para o estudo.

Uso:
  cd pipeline
  python discover.py                   # exibe tabela no terminal
  python discover.py --csv resumo.csv  # também exporta CSV
  python discover.py --min-anos 20     # filtra por mínimo de anos
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd
from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent))
from src.parser import parse_ana_zip

logging.basicConfig(level=logging.WARNING)  # Silencia logs do parser durante discover

RAW_DATA_DIR = Path(__file__).parent / "data" / "raw"
console = Console()


def scan_all_zips(min_anos: int = 0) -> pd.DataFrame:
    zips = sorted(RAW_DATA_DIR.glob("*.zip"))
    if not zips:
        console.print(f"[red]Nenhum ZIP encontrado em {RAW_DATA_DIR}[/red]")
        console.print("Baixe os ZIPs do Hidroweb (ANA) e coloque nessa pasta.")
        sys.exit(1)

    console.print(f"\n[bold blue]Escaneando {len(zips)} arquivo(s) em {RAW_DATA_DIR}[/bold blue]\n")

    rows = []
    for zip_path in zips:
        try:
            meta, df = parse_ana_zip(zip_path)
        except Exception as e:
            console.print(f"[red]  ERRO em {zip_path.name}: {e}[/red]")
            continue

        codigo = meta.get("EstacaoCodigo") or df["estacao_codigo"].iloc[0] if len(df) > 0 else "?"
        nome = meta.get("NomeEstacao", "—")
        lat = meta.get("Latitude", "—")
        lon = meta.get("Longitude", "—")
        alt = meta.get("Altitude", "—")

        n_total = len(df)
        n_nan = int(df["valor"].isna().sum())
        pct_falhas = round(100.0 * n_nan / n_total, 1) if n_total > 0 else 100.0

        if n_total > 0:
            data_min = df["data"].min()
            data_max = df["data"].max()
            # Anos com ao menos 300 dias de dado
            df["ano"] = df["data"].dt.year
            anos_com_dado = (
                df.groupby("ano")["valor"]
                .apply(lambda s: s.notna().sum() >= 300)
                .sum()
            )
        else:
            data_min = data_max = None
            anos_com_dado = 0

        rows.append({
            "codigo":        codigo,
            "nome":          nome[:35],
            "lat":           lat,
            "lon":           lon,
            "altitude":      alt,
            "inicio":        data_min.year if data_min else "—",
            "fim":           data_max.year if data_max else "—",
            "anos_bons":     int(anos_com_dado),
            "pct_falhas":    pct_falhas,
            "arquivo":       zip_path.name,
        })

    df_out = pd.DataFrame(rows)
    if min_anos > 0:
        df_out = df_out[df_out["anos_bons"] >= min_anos]

    df_out = df_out.sort_values("anos_bons", ascending=False).reset_index(drop=True)
    return df_out


def print_table(df: pd.DataFrame) -> None:
    table = Table(
        title="Estações Pluviométricas — Bacia do Paraíba do Sul",
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("#",            style="dim",    width=3)
    table.add_column("Código",       style="bold",   width=10)
    table.add_column("Nome",                         width=36)
    table.add_column("Lat",                          width=8)
    table.add_column("Lon",                          width=9)
    table.add_column("Alt(m)",                       width=7)
    table.add_column("Início",                       width=7)
    table.add_column("Fim",                          width=5)
    table.add_column("Anos bons",    style="green",  width=10)
    table.add_column("Falhas %",                     width=9)

    for i, row in df.iterrows():
        pct = float(row["pct_falhas"])
        falha_style = "green" if pct < 5 else "yellow" if pct < 15 else "red"
        table.add_row(
            str(int(i) + 1),
            str(row["codigo"]),
            str(row["nome"]),
            str(row["lat"]),
            str(row["lon"]),
            str(row["altitude"]),
            str(row["inicio"]),
            str(row["fim"]),
            str(row["anos_bons"]),
            f"[{falha_style}]{pct:.1f}%[/{falha_style}]",
        )

    console.print(table)
    console.print()
    console.print("[bold]Critérios de seleção:[/bold]")
    console.print("  • Prefira estações com [green]anos_bons > 20[/green] e [green]falhas < 5%[/green]")
    console.print("  • As 3 estações devem ter um [bold]período comum[/bold] (anos simultâneos com dado)")
    console.print("  • A estação de referência deve ser a que tem [bold]mais anos_bons[/bold]")
    console.print("  • Considere a [bold]distribuição espacial[/bold] — evite estações muito próximas")
    console.print()
    console.print("Após escolher, preencha [bold cyan]config.yaml[/bold cyan] com os 3 códigos.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Descobre e avalia estações pluviométricas nos ZIPs baixados.")
    parser.add_argument("--csv", metavar="ARQUIVO.csv", help="Exporta resultado para CSV")
    parser.add_argument("--min-anos", type=int, default=0, metavar="N",
                        help="Filtra estações com pelo menos N anos bons (default: 0)")
    args = parser.parse_args()

    df = scan_all_zips(min_anos=args.min_anos)

    if df.empty:
        console.print("[red]Nenhuma estação encontrada após filtros.[/red]")
        return

    print_table(df)

    if args.csv:
        df.to_csv(args.csv, index=False, encoding="utf-8-sig")
        console.print(f"[green]Exportado para {args.csv}[/green]")


if __name__ == "__main__":
    main()
