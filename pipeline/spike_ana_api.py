"""
Spike script — valida o fluxo completo da API REST HidroWebService:
  1. Login (gera token Bearer)
  2. Chamada de /HidroInventarioEstacoes/v1 (filtro UF=SP, bacia=8)
  3. Chamada de /HidroSerieVazao/v1 para uma estação amostra (30 dias)

Uso:
  cd pipeline
  python spike_ana_api.py

NÃO faz parte do pipeline em produção — apenas verifica que credenciais
estão corretas e que a API responde como o manual descreve.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from src.ana_client import client_from_env  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("spike")


def main() -> None:
    load_dotenv(Path(__file__).parent / ".env")

    client = client_from_env()
    logger.info(f"Cliente inicializado contra {client.base_url}")

    # 1) Login implícito + 1 chamada simples (bacias)
    bacias = client.bacias()
    logger.info(f"[bacias] {len(bacias)} retornadas")
    for b in bacias[:3]:
        logger.info(f"  - {b}")

    # 2) Inventário fluviométrico em SP, bacia 8 (Atlântico SE — Paraíba do Sul)
    logger.info("[inventario] UF=SP, bacia=8 (Atlântico Sudeste) — pode demorar…")
    inv = client.inventario(uf="SP", codigo_bacia=8)
    fluvio = [
        e for e in inv
        if str(e.get("Tipo_Estacao", "")).strip().lower().startswith("fluvio")
    ]
    pluvio = [
        e for e in inv
        if str(e.get("Tipo_Estacao", "")).strip().lower().startswith("pluvio")
    ]
    logger.info(
        f"[inventario] total {len(inv)}; "
        f"fluviométricas {len(fluvio)}; pluviométricas {len(pluvio)}"
    )

    if fluvio:
        amostra = sorted(
            fluvio,
            key=lambda e: float(e.get("Area_Drenagem") or 0),
            reverse=True,
        )[:5]
        logger.info("Top-5 fluviométricas por área de drenagem (SP, bacia 8):")
        for e in amostra:
            logger.info(
                f"  - {e.get('codigoestacao')} {e.get('Estacao_Nome')} | "
                f"A={e.get('Area_Drenagem')} km² | "
                f"rio={e.get('Bacia_Nome')} | "
                f"operando={e.get('Operando')}"
            )

        # 3) Série de vazão dos últimos 90 dias do primeiro candidato
        cod = str(amostra[0].get("codigoestacao"))
        logger.info(f"[vazao] amostrando {cod} (últimos ~365 dias)…")
        from datetime import date, timedelta

        fim = date.today().isoformat()
        ini = (date.today() - timedelta(days=365)).isoformat()
        vazoes = client.serie_vazao(cod, ini, fim)
        logger.info(f"[vazao] {cod}: {len(vazoes)} registros entre {ini} e {fim}")
        if vazoes:
            logger.info(
                f"  primeiro registro: {json.dumps(vazoes[0], ensure_ascii=False)[:300]}"
            )

    logger.info("Spike concluído com sucesso.")


if __name__ == "__main__":
    main()
