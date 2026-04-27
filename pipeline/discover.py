"""
Ferramenta de descoberta de estações: escaneia TODOS os ZIPs em data/raw/,
parseia-os e exibe uma tabela de qualidade para ajudar na escolha das estações
para o estudo.

Uso:
  cd pipeline
  python discover.py                        # exibe tabela no terminal
  python discover.py --csv resumo.csv       # também exporta CSV
  python discover.py --min-anos 20          # filtra por mínimo de anos bons
  python discover.py --registrar            # grava estações sem dados no Supabase
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import zipfile
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent))
from src.parser import parse_ana_zip

logging.basicConfig(level=logging.WARNING)

RAW_DATA_DIR = Path(__file__).parent / "data" / "raw"
console = Console()


def _codigo_do_nome(nome_arquivo: str) -> str | None:
    """Extrai código da estação do nome do ZIP (ex.: Estacao_2244001_CSV_...)."""
    m = re.search(r"_(\d{6,8})_", nome_arquivo)
    return m.group(1) if m else None


def detectar_vazios() -> list[dict]:
    """Retorna lista de {'codigo', 'nome_arquivo', 'motivo'} para ZIPs sem conteúdo."""
    vazios = []
    for zip_path in sorted(RAW_DATA_DIR.glob("*.zip")):
        try:
            with zipfile.ZipFile(zip_path) as z:
                if not z.namelist():
                    codigo = _codigo_do_nome(zip_path.name) or zip_path.stem
                    vazios.append({
                        "codigo":       codigo,
                        "nome_arquivo": zip_path.name,
                        "motivo":       "ZIP sem arquivos internos — estação sem dados disponíveis na ANA",
                    })
        except zipfile.BadZipFile:
            pass  # .gitkeep e outros não-ZIPs
    return vazios


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
            console.print(f"[yellow]  Pulando {zip_path.name}: {e}[/yellow]")
            continue

        codigo = meta.get("EstacaoCodigo") or (df["estacao_codigo"].iloc[0] if len(df) > 0 else "?")
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
            "codigo":     codigo,
            "nome":       nome[:35],
            "lat":        lat,
            "lon":        lon,
            "altitude":   alt,
            "inicio":     data_min.year if data_min else "—",
            "fim":        data_max.year if data_max else "—",
            "anos_bons":  int(anos_com_dado),
            "pct_falhas": pct_falhas,
            "arquivo":    zip_path.name,
        })

    df_out = pd.DataFrame(rows)
    if min_anos > 0:
        df_out = df_out[df_out["anos_bons"] >= min_anos]

    df_out = df_out.sort_values("anos_bons", ascending=False).reset_index(drop=True)
    return df_out


def print_table(df: pd.DataFrame) -> None:
    table = Table(
        title="Estacoes Pluviometricas — Bacia do Paraiba do Sul",
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("#",           style="dim",   width=3)
    table.add_column("Codigo",      style="bold",  width=10)
    table.add_column("Nome",                       width=36)
    table.add_column("Lat",                        width=8)
    table.add_column("Lon",                        width=9)
    table.add_column("Alt(m)",                     width=7)
    table.add_column("Inicio",                     width=7)
    table.add_column("Fim",                        width=5)
    table.add_column("Anos bons",   style="green", width=10)
    table.add_column("Falhas %",                   width=9)

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
    console.print("[bold]Criterios de selecao:[/bold]")
    console.print("  * Prefira estacoes com [green]anos_bons > 20[/green] e [green]falhas < 5%[/green]")
    console.print("  * As estacoes devem ter um [bold]periodo comum[/bold] (anos simultaneos com dado)")
    console.print("  * A estacao de referencia deve ser a que tem [bold]mais anos_bons[/bold]")
    console.print("  * Considere a [bold]distribuicao espacial[/bold] — evite estacoes muito proximas")
    console.print()
    console.print("Apos escolher, preencha [bold cyan]config.yaml[/bold cyan] com os codigos.\n")


def print_vazios(vazios: list[dict]) -> None:
    if not vazios:
        return
    console.print(
        f"\n[bold yellow]Estacoes sem dados ({len(vazios)} ZIPs vazios):[/bold yellow]"
    )
    console.print(
        "  Esses codigos existem no cadastro da ANA mas nao possuem "
        "serie historica disponivel para download.\n"
        "  Use [cyan]--registrar[/cyan] para gravar no Supabase e exibir no BI."
    )
    codigos = [v["codigo"] for v in vazios]
    # Exibe em colunas de 8
    for i in range(0, len(codigos), 8):
        console.print("  " + "  ".join(codigos[i:i+8]))
    console.print()


def registrar_no_supabase(vazios: list[dict]) -> None:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        console.print("[red]SUPABASE_URL ou SUPABASE_SERVICE_KEY nao definidos no .env[/red]")
        return
    from src.supabase_loader import get_client, insert_estacoes_sem_dados
    client = get_client(url, key)
    n = insert_estacoes_sem_dados(client, vazios)
    console.print(f"[green]{n} estacoes sem dados registradas no Supabase.[/green]")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descobre e avalia estacoes pluviometricas nos ZIPs baixados."
    )
    parser.add_argument("--csv", metavar="ARQUIVO.csv", help="Exporta resultado para CSV")
    parser.add_argument("--min-anos", type=int, default=0, metavar="N",
                        help="Filtra estacoes com pelo menos N anos bons (default: 0)")
    parser.add_argument("--registrar", action="store_true",
                        help="Grava estacoes sem dados no Supabase (requer .env)")
    args = parser.parse_args()

    # Detecta ZIPs vazios antes de parsear os válidos
    vazios = detectar_vazios()

    df = scan_all_zips(min_anos=args.min_anos)

    if df.empty:
        console.print("[red]Nenhuma estacao encontrada apos filtros.[/red]")
    else:
        print_table(df)

    print_vazios(vazios)

    if args.csv:
        df.to_csv(args.csv, index=False, encoding="utf-8-sig")
        console.print(f"[green]Exportado para {args.csv}[/green]")

    if args.registrar and vazios:
        registrar_no_supabase(vazios)


if __name__ == "__main__":
    main()
