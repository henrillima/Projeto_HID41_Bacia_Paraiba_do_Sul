"""
Baixa dados pluviométricos de estações da ANA via API SOAP pública.

API usada: http://telemetriaws1.ana.gov.br/ServiceANA.asmx
  - Não requer cadastro nem autenticação
  - O endpoint HidroInventario pode estar instável (500) — use --inventario como alternativa

Como obter o inventário manualmente (caso o HidroInventario esteja fora do ar):
  1. Acesse https://www.snirh.gov.br/hidroweb/serieshistoricas
  2. Filtros: Tipo = Pluviométrica, Estado = SP
  3. Clique em "Exportar" e salve como inventario_SP.csv na pasta pipeline/
  4. python download_stations.py --inventario inventario_SP.csv

Uso rápido:
  python download_stations.py --inventario inventario_SP.csv
  python download_stations.py --inventario inventario_SP.csv --listar
  python download_stations.py --codigos 02244006 02244008 02245000
  python download_stations.py --estado SP   # tenta API automática

Após concluir, rode:
  python discover.py    # avalia qualidade e ranqueia as estações
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

    A API da ANA retorna 500 quando recebe code range + estado juntos,
    então enviamos apenas um filtro por vez e filtramos o restante localmente.
    """
    # Tenta sequência de chamadas do mais simples ao mais completo
    # para contornar o comportamento errático do servidor da ANA.
    tentativas = [
        # 1. Só estado + tipo (mais confiável)
        {"tpEst": tipo, "nmEstado": estado, "nmEst": "", "nmRio": nome_rio,
         "codEstDE": "", "codEstATE": "", "codSubBacia": "", "codBacia": "",
         "nmMunicipio": "", "sgOperadora": "", "telemetrica": ""},
        # 2. Só código range + tipo (sem estado)
        {"tpEst": tipo, "nmEstado": "", "nmEst": "", "nmRio": nome_rio,
         "codEstDE": codigo_de, "codEstATE": codigo_ate, "codSubBacia": "",
         "codBacia": "", "nmMunicipio": "", "sgOperadora": "", "telemetrica": ""},
        # 3. Só tipo, sem nenhum filtro geográfico
        {"tpEst": tipo, "nmEstado": "", "nmEst": "", "nmRio": "",
         "codEstDE": "", "codEstATE": "", "codSubBacia": "", "codBacia": "",
         "nmMunicipio": "", "sgOperadora": "", "telemetrica": ""},
    ]

    df = pd.DataFrame()
    for i, params in enumerate(tentativas, 1):
        desc = f"estado={params['nmEstado'] or '—'}, códigos={params['codEstDE'] or '—'}–{params['codEstATE'] or '—'}"
        console.print(f"[blue]Tentativa {i}: consultando inventário ANA ({desc})...[/blue]")
        try:
            resp = requests.get(_INVENTARIO_URL, params=params, timeout=120)
            resp.raise_for_status()
            df = _parse_inventario_xml(resp.content)
            if not df.empty:
                break
        except Exception as e:
            console.print(f"[yellow]  Tentativa {i} falhou: {e}[/yellow]")

    if df.empty:
        return df

    # Filtragem local —————————————————————————————————————————————
    # Estado (caso a tentativa 2 ou 3 tenha sido usada)
    if estado and "estado" in df.columns:
        mask_estado = df["estado"].str.upper().str.contains(estado.upper(), na=False)
        if mask_estado.any():
            df = df[mask_estado]

    # Faixa de códigos
    if codigo_de or codigo_ate:
        try:
            df["_cod_num"] = pd.to_numeric(df["codigo"], errors="coerce")
            if codigo_de:
                df = df[df["_cod_num"] >= int(codigo_de)]
            if codigo_ate:
                df = df[df["_cod_num"] <= int(codigo_ate)]
            df = df.drop(columns=["_cod_num"])
        except Exception:
            pass  # se falhar, mantém todos

    return df.reset_index(drop=True)


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

def _ler_inventario_csv(caminho: str) -> pd.DataFrame:
    """
    Lê o CSV de inventário exportado pelo portal HidroWeb (snirh.gov.br).
    Tenta detectar o separador e normaliza os nomes de coluna automaticamente.
    """
    path = Path(caminho)
    if not path.exists():
        raise FileNotFoundError(
            f"Arquivo '{caminho}' não encontrado.\n"
            "Exporte o inventário em: snirh.gov.br/hidroweb/serieshistoricas → Exportar"
        )

    # Detecta encoding e separador
    for enc in ("utf-8-sig", "latin-1", "utf-8"):
        try:
            # Tenta ponto-e-vírgula primeiro (padrão brasileiro), depois vírgula
            for sep in (";", ",", "\t"):
                try:
                    df = pd.read_csv(path, sep=sep, encoding=enc, dtype=str, nrows=5)
                    if len(df.columns) >= 3:
                        df = pd.read_csv(path, sep=sep, encoding=enc, dtype=str)
                        break
                except Exception:
                    continue
            break
        except Exception:
            continue

    # Normaliza colunas — o export do HidroWeb tem nomes variados
    col_map = {
        # Código da estação
        "código": "codigo", "codigo": "codigo", "codigoestacao": "codigo",
        "cod_estacao": "codigo", "cod": "codigo",
        # Nome
        "nome": "nome", "nomeestacao": "nome", "estacao": "nome",
        # Coordenadas
        "latitude": "lat", "lat": "lat",
        "longitude": "lon", "lon": "lon", "long": "lon",
        # Outros
        "altitude": "altitude", "municipio": "municipio",
        "estado": "estado", "uf": "estado",
        "rio": "rio", "nomeeio": "rio",
    }
    df.columns = [
        col_map.get(c.lower().strip().replace(" ", "").replace("_", ""), c.lower().strip())
        for c in df.columns
    ]

    if "codigo" not in df.columns:
        raise ValueError(
            f"Coluna de código não encontrada no arquivo. "
            f"Colunas detectadas: {list(df.columns)}"
        )

    df = df[df["codigo"].notna() & df["codigo"].str.strip().ne("")]
    console.print(f"[green]{len(df)} estações lidas de '{path.name}'[/green]")
    return df.reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Baixa dados pluviométricos da ANA (API pública, sem autenticação)."
    )
    parser.add_argument("--listar", action="store_true",
                        help="Apenas lista estações, sem baixar dados.")
    parser.add_argument("--inventario", metavar="ARQUIVO.csv",
                        help="CSV exportado do HidroWeb (alternativa ao HidroInventario API).")
    parser.add_argument("--codigos", nargs="+", metavar="COD",
                        help="Códigos específicos a baixar (ex: 02244006 02244008).")
    parser.add_argument("--estado", default="SP",
                        help="Sigla do estado para filtrar via API (padrão: SP).")
    parser.add_argument("--tipo", default="2",
                        help="Tipo de estação: 2=plu (padrão), 1=flu.")
    parser.add_argument("--codigo-de", default="",
                        help="Código mínimo para filtrar localmente.")
    parser.add_argument("--codigo-ate", default="",
                        help="Código máximo para filtrar localmente.")
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
        df_inv = pd.DataFrame([{"codigo": c, "nome": c, "lat": "", "lon": "",
                                 "altitude": "", "municipio": "", "estado": "",
                                 "rio": ""} for c in args.codigos])
        console.print(f"[blue]Usando {len(df_inv)} código(s) fornecido(s) manualmente.[/blue]")

    elif args.inventario:
        df_inv = _ler_inventario_csv(args.inventario)

    else:
        df_inv = listar_estacoes(
            estado=args.estado,
            tipo=args.tipo,
            codigo_de=args.codigo_de,
            codigo_ate=args.codigo_ate,
            nome_rio=args.rio,
        )

    # Filtragem local por código (útil com --inventario)
    if not df_inv.empty and (args.codigo_de or args.codigo_ate):
        try:
            nums = pd.to_numeric(df_inv["codigo"], errors="coerce")
            if args.codigo_de:
                df_inv = df_inv[nums >= int(args.codigo_de)]
            if args.codigo_ate:
                df_inv = df_inv[nums <= int(args.codigo_ate)]
            df_inv = df_inv.reset_index(drop=True)
            console.print(f"[dim]Após filtro de código: {len(df_inv)} estações.[/dim]")
        except Exception:
            pass

    if df_inv.empty:
        console.print(
            "[red]Nenhuma estação encontrada.[/red]\n"
            "[yellow]Dica: baixe o inventário manualmente em "
            "snirh.gov.br/hidroweb/serieshistoricas → Exportar\n"
            "e use: python download_stations.py --inventario inventario_SP.csv[/yellow]"
        )
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
