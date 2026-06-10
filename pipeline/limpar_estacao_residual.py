"""
Remove uma estacao fluviometrica residual do Supabase (one-shot).

Apaga a linha de `estacoes_fluvio` correspondente ao codigo informado.
Como todas as tabelas filhas (fluviometria_*, eventos_chuva_vazao,
hidrograma_unitario_*, comparacao_uh, max_anual_vazao, frequencia_*)
tem ON DELETE CASCADE em estacao_codigo (migrations 005-008), a
remocao se propaga automaticamente.

Uso:
    cd pipeline
    python limpar_estacao_residual.py 58183000
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from src.supabase_loader import get_client, limpar_estacao_fluvio  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("limpar_estacao")

ROOT = Path(__file__).parent


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Remove estacao fluviometrica de estacoes_fluvio (cascade)."
    )
    ap.add_argument("codigo", help="Codigo ANA da estacao a remover (ex.: 58183000)")
    args = ap.parse_args()

    load_dotenv(ROOT / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes em .env")

    client = get_client(url, key)

    # Verifica se a estacao existe antes
    rows = client.table("estacoes_fluvio").select(
        "codigo, nome, is_outlet"
    ).eq("codigo", args.codigo).execute().data
    if not rows:
        logger.warning(f"Estacao {args.codigo} nao encontrada em estacoes_fluvio. Nada a remover.")
        return

    e = rows[0]
    logger.info(
        f"Encontrada: {e['codigo']} - {e.get('nome', '?')} "
        f"(is_outlet={e.get('is_outlet')})"
    )
    limpar_estacao_fluvio(client, args.codigo)
    logger.info("Concluido. Cascade removeu dados em tabelas filhas.")


if __name__ == "__main__":
    main()
