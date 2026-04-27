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
  python discover.py --auto-select 3        # seleciona as 3 melhores e atualiza config.yaml
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
import yaml
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


def exportar_candidatas(df: pd.DataFrame) -> None:
    """Exporta todas as estações com dados para a tabela estacoes_candidatas no Supabase."""
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        console.print("[red]SUPABASE_URL ou SUPABASE_SERVICE_KEY nao definidos no .env[/red]")
        return
    from src.supabase_loader import get_client
    client = get_client(url, key)

    registros = [
        {
            "codigo":     str(row["codigo"]),
            "inicio":     int(row["inicio"]) if str(row["inicio"]).isdigit() else None,
            "fim":        int(row["fim"]) if str(row["fim"]).isdigit() else None,
            "anos_bons":  int(row["anos_bons"]),
            "pct_falhas": float(row["pct_falhas"]),
        }
        for _, row in df.iterrows()
    ]
    client.table("estacoes_candidatas").upsert(registros).execute()
    console.print(f"[green]{len(registros)} estacoes exportadas para estacoes_candidatas.[/green]")


def auto_selecionar_estacoes(n: int, df_ranking: pd.DataFrame) -> list[dict]:
    """
    Seleciona as N melhores estações do ranking para uso no pipeline.

    Critério: maior anos_bons, menor pct_falhas como desempate.
    A primeira estação selecionada é marcada como referência.
    Coordenadas ficam como 0.0 quando não disponíveis nos metadados — nesse
    caso o pipeline usará apenas regressão (IDW requer lat/lon reais).
    """
    elegíveis = df_ranking[df_ranking["anos_bons"] > 0].copy()
    top_n = elegíveis.head(n)

    if len(top_n) == 0:
        console.print("[red]Nenhuma estação elegível encontrada.[/red]")
        return []

    if len(top_n) < n:
        console.print(
            f"[yellow]Apenas {len(top_n)} estações com dados (solicitado: {n}).[/yellow]"
        )

    estacoes = []
    for i, (_, row) in enumerate(top_n.iterrows()):
        def _f(val: object) -> float:
            try:
                return float(str(val).replace(",", "."))
            except (ValueError, TypeError):
                return 0.0

        lat = _f(row.get("lat", "—"))
        lon = _f(row.get("lon", "—"))
        alt = _f(row.get("altitude", "—"))

        estacoes.append({
            "codigo":        str(row["codigo"]),
            "nome":          str(row.get("nome", "PREENCHER")).strip() or "PREENCHER",
            "lat":           lat,
            "lon":           lon,
            "altitude":      int(alt),
            "is_referencia": (i == 0),
        })

    return estacoes


def atualizar_config_yaml(estacoes: list[dict]) -> None:
    """Reescreve a seção 'estacoes' no config.yaml preservando os demais campos."""
    config_path = Path(__file__).parent / "config.yaml"
    if not config_path.exists():
        console.print(f"[red]config.yaml não encontrado em {config_path}[/red]")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}

    cfg["estacoes"] = [
        {
            "codigo":        e["codigo"],
            "nome":          e["nome"],
            "lat":           e["lat"],
            "lon":           e["lon"],
            "altitude":      e["altitude"],
            "is_referencia": e["is_referencia"],
        }
        for e in estacoes
    ]

    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(cfg, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    console.print(f"[green]config.yaml atualizado com {len(estacoes)} estações.[/green]")


def publicar_config_supabase(estacoes: list[dict]) -> None:
    """Grava as estações selecionadas em config_estacoes no Supabase."""
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        console.print("[yellow]Credenciais Supabase não encontradas — pulando carga remota.[/yellow]")
        return

    from src.supabase_loader import get_client
    client = get_client(url, key)

    # Limpa seleção anterior
    client.table("config_estacoes").delete().neq("codigo", "").execute()

    registros = [
        {
            "codigo":        e["codigo"],
            "nome":          e["nome"] if e["nome"] != "PREENCHER" else e["codigo"],
            "lat":           e["lat"] if e["lat"] != 0.0 else None,
            "lon":           e["lon"] if e["lon"] != 0.0 else None,
            "altitude":      e["altitude"] if e["altitude"] != 0 else None,
            "is_referencia": e["is_referencia"],
        }
        for e in estacoes
    ]
    client.table("config_estacoes").upsert(registros).execute()
    console.print(f"[green]{len(registros)} estações gravadas em config_estacoes (Supabase).[/green]")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descobre e avalia estacoes pluviometricas nos ZIPs baixados."
    )
    parser.add_argument("--csv", metavar="ARQUIVO.csv", help="Exporta resultado para CSV")
    parser.add_argument("--min-anos", type=int, default=0, metavar="N",
                        help="Filtra estacoes com pelo menos N anos bons (default: 0)")
    parser.add_argument("--registrar", action="store_true",
                        help="Grava estacoes sem dados no Supabase (requer .env)")
    parser.add_argument("--exportar-candidatas", action="store_true",
                        help="Exporta ranking completo para estacoes_candidatas no Supabase (requer .env)")
    parser.add_argument("--auto-select", type=int, default=0, metavar="N",
                        help="Seleciona as N melhores estações e atualiza config.yaml (e Supabase se .env presente)")
    args = parser.parse_args()

    # Detecta ZIPs vazios antes de parsear os válidos
    vazios = detectar_vazios()

    # Lê ranking do CSV local (mais rápido) se existir e não há filtro de anos
    ranking_csv = Path(__file__).parent / "ranking.csv"
    if args.auto_select and not args.min_anos and ranking_csv.exists():
        df = pd.read_csv(ranking_csv, dtype={"codigo": str})
        df = df[df["anos_bons"] > 0].sort_values("anos_bons", ascending=False).reset_index(drop=True)
        console.print(f"[dim]Ranking lido de {ranking_csv.name} ({len(df)} estações).[/dim]")
    else:
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

    if args.exportar_candidatas and not df.empty:
        exportar_candidatas(df)

    if args.auto_select and not df.empty:
        selecionadas = auto_selecionar_estacoes(args.auto_select, df)
        if selecionadas:
            atualizar_config_yaml(selecionadas)
            publicar_config_supabase(selecionadas)
            console.print()
            console.print("[bold cyan]Estações selecionadas:[/bold cyan]")
            for e in selecionadas:
                ref_tag = " [REF]" if e["is_referencia"] else ""
                coords_ok = abs(e["lat"]) > 0.001 and abs(e["lon"]) > 0.001
                coords_str = (
                    f"lat={e['lat']:.4f}, lon={e['lon']:.4f}"
                    if coords_ok
                    else "[yellow]coordenadas nao disponiveis[/yellow]"
                )
                console.print(f"  {e['codigo']}{ref_tag}: {e['nome']} — {coords_str}")
            console.print()
            tem_coords = any(abs(e["lat"]) > 0.001 for e in selecionadas)
            if not tem_coords:
                console.print(
                    "[bold yellow]AVISO: Coordenadas nao encontradas nos arquivos da ANA.[/bold yellow]\n"
                    "   Para ativar o metodo IDW, preencha lat/lon em [cyan]config.yaml[/cyan]\n"
                    "   ou use a pagina [cyan]/selecao[/cyan] do dashboard.\n"
                    "   Sem coordenadas o pipeline usa [bold]apenas regressao[/bold] (totalmente valido)."
                )


if __name__ == "__main__":
    main()
