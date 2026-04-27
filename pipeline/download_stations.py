"""
Baixa automaticamente os dados pluviométricos de todas as estações
da bacia do Paraíba do Sul via API SOAP pública da ANA.

API usada: http://telemetriaws1.ana.gov.br/ServiceANA.asmx
  - Não requer cadastro nem autenticação
  - Retorna XML com série histórica mensal (mesma estrutura do CSV do Hidroweb)

Os ZIPs gerados são 100% compatíveis com parse_ana_zip() e discover.py.

Uso rápido:
  python download_stations.py                      # baixa tudo (pode demorar)
  python download_stations.py --listar             # só lista estações, sem baixar
  python download_stations.py --codigos 02244006 02244008  # baixa estações específicas
  python download_stations.py --estado SP --tipo 2 # pluviométricas de SP

Após concluir, rode:
  python discover.py                               # avalia qualidade das estações
"""

from __future__ import annotations

import argparse
import io
import logging
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import pandas as pd
import requests
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, SpinnerColumn, TextColumn
from rich.table import Table

console = Console()
logger = logging.getLogger("download_stations")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
_BASE = "http://telemetriaws1.ana.gov.br/ServiceANA.asmx"
_INVENTARIO_URL = f"{_BASE}/HidroInventario"
_SERIE_URL = f"{_BASE}/HidroSerieHistorica"

# Intervalo entre requisições para não sobrecarregar o servidor da ANA
_DELAY_ENTRE_ESTACOES = 1.5  # segundos

# Colunas de dia
_DAY_COLS = [f"Chuva{i:02d}" for i in range(1, 32)]

RAW_DIR = Path(__file__).parent / "data" / "raw"


# ---------------------------------------------------------------------------
# Inventário de estações
# ---------------------------------------------------------------------------

def listar_estacoes(
    estado: str = "SP",
    tipo: str = "2",        # 2 = pluviométrica, 1 = fluviométrica, "" = ambas
    codigo_de: str = "",
    codigo_ate: str = "",
    nome_rio: str = "",
) -> pd.DataFrame:
    """
    Consulta o inventário da ANA e retorna um DataFrame com todas as
    estações que atendem aos filtros.

    Parameters
    ----------
    estado   : sigla do estado (ex: 'SP'), ou '' para todos
    tipo     : '2' = pluviométrica | '1' = fluviométrica | '' = todas
    codigo_de/ate : faixa de códigos (8 dígitos) para filtrar por bacia
    nome_rio : substring do nome do rio para filtrar
    """
    params = {
        "codEstDE":    codigo_de,
        "codEstATE":   codigo_ate,
        "tpEst":       tipo,
        "nmEst":       "",
        "nmRio":       nome_rio,
        "codSubBacia": "",
        "codBacia":    "",
        "nmMunicipio": "",
        "nmEstado":    estado,
        "sgOperadora": "",
        "telemetrica": "",
    }
    console.print(f"[blue]Consultando inventário ANA (estado={estado or 'todos'}, tipo={tipo})...[/blue]")
    resp = requests.get(_INVENTARIO_URL, params=params, timeout=120)
    resp.raise_for_status()
    return _parse_inventario_xml(resp.content)


def _parse_inventario_xml(xml_bytes: bytes) -> pd.DataFrame:
    """Converte XML do HidroInventario em DataFrame."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        raise ValueError(f"XML inválido no inventário: {e}") from e

    rows = []
    # O tag pode estar em namespace ou não — iteramos por tag genérico
    for node in root.iter():
        if node.tag.endswith("HidroInventario"):
            rows.append({
                "codigo":      _text(node, "Codigo"),
                "nome":        _text(node, "Nome"),
                "lat":         _text(node, "Latitude"),
                "lon":         _text(node, "Longitude"),
                "altitude":    _text(node, "Altitude"),
                "municipio":   _text(node, "nmMunicipio"),
                "estado":      _text(node, "nmEstado"),
                "bacia":       _text(node, "BaciaCodigo"),
                "sub_bacia":   _text(node, "SubBaciaCodigo"),
                "rio":         _text(node, "Rio"),
                "operadora":   _text(node, "Operadora"),
                "resp_operacao": _text(node, "ResponsavelOperacao"),
                "data_inicio": _text(node, "DataInicioOperacao"),
                "data_fim":    _text(node, "DataFimOperacao"),
            })

    if not rows:
        console.print("[yellow]Inventário vazio — verifique os filtros.[/yellow]")
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    # Remove linhas sem código
    df = df[df["codigo"].str.strip().ne("") & df["codigo"].notna()]
    console.print(f"[green]{len(df)} estações encontradas no inventário.[/green]")
    return df


# ---------------------------------------------------------------------------
# Download da série histórica
# ---------------------------------------------------------------------------

def baixar_serie(
    codigo: str,
    data_inicio: str = "01/01/1930",
    data_fim: str = "31/12/2024",
) -> pd.DataFrame | None:
    """
    Baixa a série histórica de precipitação de uma estação.

    Returns None se a API retornar erro ou dados vazios.
    """
    params = {
        "CodEstacao":        codigo,
        "DataInicio":        data_inicio,
        "DataFim":           data_fim,
        "TipoDados":         "2",   # 2 = chuva
        "NivelConsistencia": "",    # vazio = retorna todos os níveis
    }
    try:
        resp = requests.get(_SERIE_URL, params=params, timeout=180)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning(f"[{codigo}] Erro de rede: {e}")
        return None

    return _parse_serie_xml(resp.content, codigo)


def _parse_serie_xml(xml_bytes: bytes, codigo: str) -> pd.DataFrame | None:
    """
    Converte XML do HidroSerieHistorica em DataFrame com colunas:
    EstacaoCodigo, NivelConsistencia, Data (dd/mm/yyyy), Chuva01…Chuva31,
    Maxima, Total, NumDiasDeChuva.
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None

    # Verifica se é resposta de erro
    for node in root.iter():
        if "Error" in node.tag or "error" in node.tag:
            if node.text:
                logger.debug(f"[{codigo}] API retornou erro: {node.text.strip()}")
                return None

    rows = []
    for node in root.iter():
        if node.tag.endswith("SerieHistorica"):
            data_hora = _text(node, "DataHora")
            if not data_hora:
                continue
            # Converte ISO (YYYY-MM-DD...) para dd/mm/yyyy
            try:
                data_fmt = pd.to_datetime(data_hora[:10]).strftime("%d/%m/%Y")
            except Exception:
                continue

            row: dict = {
                "EstacaoCodigo":    _text(node, "EstacaoCodigo") or codigo,
                "NivelConsistencia": _text(node, "NivelConsistencia") or "1",
                "Data":             data_fmt,
            }
            for dc in _DAY_COLS:
                v = _text(node, dc)
                # API retorna "NULL" ou vazio para ausentes; normaliza para ""
                row[dc] = "" if (not v or v.upper() == "NULL") else v.replace(".", ",")

            for extra in ["Maxima", "Total", "NumDiasDeChuva"]:
                v = _text(node, extra)
                row[extra] = "" if (not v or v.upper() == "NULL") else v.replace(".", ",")

            rows.append(row)

    if not rows:
        return None

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Salvar como ZIP compatível com parse_ana_zip
# ---------------------------------------------------------------------------

def salvar_zip(
    df: pd.DataFrame,
    codigo: str,
    meta: dict,
    output_dir: Path,
) -> Path:
    """
    Salva o DataFrame como ZIP contendo CSV no formato padrão do Hidroweb.
    O arquivo gerado é idêntico (em estrutura) aos ZIPs baixados manualmente.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    header_lines = [
        f"// Código Estação: {codigo}",
        f"// Nome: {meta.get('nome', '')}",
        f"// Latitude: {meta.get('lat', '')}",
        f"// Longitude: {meta.get('lon', '')}",
        f"// Altitude: {meta.get('altitude', '')}",
        f"// Município: {meta.get('municipio', '')} - {meta.get('estado', '')}",
        f"// Rio: {meta.get('rio', '')}",
        "// Tipo: Pluviométrica",
        "// Fonte: ANA Hidroweb via telemetriaws1.ana.gov.br",
        "// Gerado por: download_stations.py",
        "//",
    ]

    cols = ["EstacaoCodigo", "NivelConsistencia", "Data"] + _DAY_COLS + ["Maxima", "Total", "NumDiasDeChuva"]
    cols_presentes = [c for c in cols if c in df.columns]
    csv_body = df[cols_presentes].to_csv(sep=";", index=False)

    content = "\n".join(header_lines) + "\n" + csv_body

    zip_path = output_dir / f"{codigo}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            f"chuvas_C_{codigo}.csv",
            content.encode("latin-1", errors="replace"),
        )

    return zip_path


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _text(node: ET.Element, tag: str) -> str:
    """Extrai texto de um sub-elemento, ignorando namespace."""
    # Tenta direto
    el = node.find(tag)
    if el is not None and el.text:
        return el.text.strip()
    # Tenta com iteração (ignora namespace)
    for child in node:
        local = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if local == tag:
            return (child.text or "").strip()
    return ""


# ---------------------------------------------------------------------------
# CLI principal
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Baixa dados pluviométricos da ANA (API pública, sem autenticação)."
    )
    parser.add_argument("--listar", action="store_true",
                        help="Apenas lista estações, sem baixar dados.")
    parser.add_argument("--codigos", nargs="+", metavar="COD",
                        help="Códigos específicos a baixar (ex: 02244006 02244008).")
    parser.add_argument("--estado", default="SP",
                        help="Sigla do estado para filtrar (padrão: SP).")
    parser.add_argument("--tipo", default="2",
                        help="Tipo de estação: 2=plu (padrão), 1=flu.")
    parser.add_argument("--codigo-de", default="",
                        help="Código mínimo (faixa) para filtrar por bacia.")
    parser.add_argument("--codigo-ate", default="",
                        help="Código máximo (faixa) para filtrar por bacia.")
    parser.add_argument("--rio", default="",
                        help="Nome (ou parte) do rio para filtrar.")
    parser.add_argument("--inicio", default="01/01/1930",
                        help="Data de início da série (dd/mm/yyyy). Padrão: 01/01/1930.")
    parser.add_argument("--fim", default="31/12/2024",
                        help="Data de fim da série (dd/mm/yyyy). Padrão: 31/12/2024.")
    parser.add_argument("--delay", type=float, default=_DELAY_ENTRE_ESTACOES,
                        help="Pausa (seg) entre requisições. Padrão: 1.5.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)s | %(message)s",
                        datefmt="%H:%M:%S")

    # --- Obter lista de estações ---
    if args.codigos:
        # Cria DataFrame mínimo com os códigos fornecidos
        df_inv = pd.DataFrame([{"codigo": c, "nome": c, "lat": "", "lon": "",
                                 "altitude": "", "municipio": "", "estado": "",
                                 "rio": ""} for c in args.codigos])
        console.print(f"[blue]Usando {len(df_inv)} código(s) fornecido(s) manualmente.[/blue]")
    else:
        df_inv = listar_estacoes(
            estado=args.estado,
            tipo=args.tipo,
            codigo_de=args.codigo_de,
            codigo_ate=args.codigo_ate,
            nome_rio=args.rio,
        )

    if df_inv.empty:
        console.print("[red]Nenhuma estação encontrada. Encerrando.[/red]")
        return

    # --- Exibe tabela do inventário ---
    _print_inventario(df_inv)

    if args.listar:
        console.print("\n[dim]Modo --listar: sem download. Remova a flag para baixar.[/dim]")
        return

    # --- Download ---
    console.print(f"\n[bold]Baixando {len(df_inv)} estações para {RAW_DIR}[/bold]\n")
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    ok = erro = pula = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Baixando...", total=len(df_inv))

        for _, row in df_inv.iterrows():
            codigo = str(row["codigo"]).strip()
            zip_destino = RAW_DIR / f"{codigo}.zip"

            progress.update(task, description=f"[cyan]{codigo}[/cyan]", advance=0)

            if zip_destino.exists():
                logger.info(f"[{codigo}] ZIP já existe — pulando.")
                pula += 1
                progress.advance(task)
                continue

            df_serie = baixar_serie(codigo, data_inicio=args.inicio, data_fim=args.fim)

            if df_serie is None or df_serie.empty:
                logger.warning(f"[{codigo}] Sem dados retornados pela API.")
                erro += 1
                progress.advance(task)
                time.sleep(args.delay)
                continue

            meta = row.to_dict()
            zip_path = salvar_zip(df_serie, codigo, meta, RAW_DIR)
            n_meses = len(df_serie)
            logger.info(f"[{codigo}] {n_meses} meses → {zip_path.name}")
            ok += 1

            progress.advance(task)
            time.sleep(args.delay)

    # --- Resumo ---
    console.print()
    console.print(f"[bold green]Concluído![/bold green]  "
                  f"OK: {ok}  |  Sem dados: {erro}  |  Pulados (já existiam): {pula}")
    if ok > 0:
        console.print(
            f"\nAgora rode [bold cyan]python discover.py[/bold cyan] "
            "para ver o ranking de qualidade e escolher as 3 estações."
        )


def _print_inventario(df: pd.DataFrame) -> None:
    table = Table(title="Estações encontradas no inventário ANA",
                  header_style="bold cyan", show_lines=False)
    table.add_column("#",      width=4,  style="dim")
    table.add_column("Código", width=10, style="bold")
    table.add_column("Nome",   width=38)
    table.add_column("Lat",    width=9)
    table.add_column("Lon",    width=10)
    table.add_column("Rio",    width=22)
    table.add_column("Estado", width=7)

    for i, row in df.iterrows():
        table.add_row(
            str(int(i) + 1),
            str(row.get("codigo", "")),
            str(row.get("nome", ""))[:38],
            str(row.get("lat", "")),
            str(row.get("lon", "")),
            str(row.get("rio", ""))[:22],
            str(row.get("estado", "")),
        )
    console.print(table)


if __name__ == "__main__":
    main()
