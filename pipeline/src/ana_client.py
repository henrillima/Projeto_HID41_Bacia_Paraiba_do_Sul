"""
Cliente REST para a API HidroWebService da ANA.

Endpoints documentados em docs/ANA_REST_API.md (extraído do manual oficial
versão 20.02.2026).

Características:
  - Autenticação via header Identificador + Senha → token Bearer (TTL 60 min)
  - Cache de token em disco (TTL local de 55 min com margem de segurança)
  - Rate-limit cliente-lado configurável (default 2 req/s)
  - Retries com backoff exponencial em 429/5xx (default 4 tentativas)
  - Renovação automática do token em 401 (uma única vez por chamada)
  - Cache local opcional de respostas JSON em pipeline/data/raw_v2/
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

logger = logging.getLogger(__name__)


class HidroWebError(RuntimeError):
    """Erro de comunicação ou resposta inválida da API HidroWebService."""


class HidroWebClient:
    """Cliente para a API REST HidroWebService da ANA.

    Parameters
    ----------
    cpf
        CPF ou CNPJ usado no cadastro (apenas dígitos).
    senha
        Senha recebida por e-mail no cadastro.
    base_url
        Base URL da API. Default = https://www.ana.gov.br/hidrowebservice.
    cache_dir
        Diretório para cache de token e respostas. Default = pipeline/.cache.
    raw_dir
        Diretório para gravar JSON cru de cada chamada de série (idempotência).
        Default = pipeline/data/raw_v2.
    token_ttl_s
        Vida útil local do token em segundos. Default 3300 (55 min), 5 min a menos
        que o TTL real da ANA (60 min) por segurança.
    rate_limit_rps
        Limite de requisições por segundo. Default 2.
    retries
        Número máximo de tentativas em 429/5xx. Default 4.
    """

    AUTH_PATH = "/EstacoesTelemetricas/OAUth/v1"
    USER_AGENT = "HID-41-pipeline/1.0 (https://github.com/itab/HID-41)"

    def __init__(
        self,
        cpf: str,
        senha: str,
        *,
        base_url: str = "https://www.ana.gov.br/hidrowebservice",
        cache_dir: Path | str | None = None,
        raw_dir: Path | str | None = None,
        token_ttl_s: int = 3300,
        rate_limit_rps: float = 2.0,
        retries: int = 4,
        request_timeout_s: float = 90.0,
    ) -> None:
        self.cpf = cpf
        self.senha = senha
        self.base_url = base_url.rstrip("/")
        self.token_ttl_s = token_ttl_s
        self.rate_limit_rps = rate_limit_rps
        self.retries = retries
        self.request_timeout_s = request_timeout_s

        pipeline_root = Path(__file__).resolve().parent.parent
        self.cache_dir = Path(cache_dir) if cache_dir else pipeline_root / ".cache"
        self.raw_dir = Path(raw_dir) if raw_dir else pipeline_root / "data" / "raw_v2"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.raw_dir.mkdir(parents=True, exist_ok=True)

        self._token_file = self.cache_dir / "hidroweb_token.json"
        self._last_request_at: float = 0.0
        self._token: str | None = None
        self._token_expires_at: datetime | None = None

        self._session = requests.Session()
        self._session.headers.update(
            {"User-Agent": self.USER_AGENT, "Accept": "application/json"}
        )

    # ------------------------------------------------------------------
    # Token lifecycle
    # ------------------------------------------------------------------

    def _load_cached_token(self) -> tuple[str, datetime] | None:
        if not self._token_file.exists():
            return None
        try:
            data = json.loads(self._token_file.read_text(encoding="utf-8"))
            token = data["token"]
            expires = datetime.fromisoformat(data["expires_at"])
            if datetime.now(timezone.utc) >= expires:
                return None
            return token, expires
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            logger.debug(f"Cache de token inválido ({exc}); ignorando.")
            return None

    def _save_cached_token(self, token: str, expires_at: datetime) -> None:
        self._token_file.write_text(
            json.dumps(
                {"token": token, "expires_at": expires_at.isoformat()},
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    def _login(self) -> str:
        """Faz login na ANA e retorna o tokenautenticacao.

        Inclui retries com backoff em timeouts e 5xx, pois o endpoint OAUth
        pode demorar > 30 s em momentos de carga.
        """
        url = self.base_url + self.AUTH_PATH
        headers = {"Identificador": self.cpf, "Senha": self.senha}

        logger.info("[ANA] Autenticando no HidroWebService…")
        last_exc: Exception | None = None

        for tentativa in range(self.retries + 1):
            self._respect_rate_limit()
            try:
                resp = self._session.get(
                    url, headers=headers, timeout=self.request_timeout_s
                )
            except requests.RequestException as exc:
                last_exc = exc
                wait = 2 ** tentativa
                logger.warning(
                    f"[ANA] login: erro de rede ({exc}); retry em {wait}s "
                    f"({tentativa + 1}/{self.retries})"
                )
                time.sleep(wait)
                continue

            if resp.status_code == 401:
                raise HidroWebError("Credenciais inválidas (HTTP 401 em /OAUth).")
            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                wait = 2 ** tentativa
                logger.warning(
                    f"[ANA] login: HTTP {resp.status_code}; retry em {wait}s "
                    f"({tentativa + 1}/{self.retries})"
                )
                time.sleep(wait)
                continue
            if resp.status_code != 200:
                raise HidroWebError(
                    f"Falha de autenticação (HTTP {resp.status_code}): {resp.text[:200]}"
                )

            payload = resp.json()
            items = payload.get("items") or {}
            token = items.get("tokenautenticacao")
            if not token:
                raise HidroWebError(
                    f"Resposta de login sem tokenautenticacao: {payload}"
                )

            expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.token_ttl_s)
            self._token = token
            self._token_expires_at = expires_at
            self._save_cached_token(token, expires_at)
            logger.info(f"[ANA] Token obtido; expira em {expires_at.isoformat()}")
            return token

        raise HidroWebError(
            f"/OAUth: esgotadas {self.retries} tentativas. Último erro: {last_exc}"
        )

    def _get_token(self, *, force_refresh: bool = False) -> str:
        """Retorna token válido, recarregando do cache ou refazendo login."""
        if not force_refresh and self._token and self._token_expires_at:
            if datetime.now(timezone.utc) < self._token_expires_at:
                return self._token

        if not force_refresh:
            cached = self._load_cached_token()
            if cached:
                self._token, self._token_expires_at = cached
                return self._token

        return self._login()

    # ------------------------------------------------------------------
    # Request plumbing
    # ------------------------------------------------------------------

    def _respect_rate_limit(self) -> None:
        if self.rate_limit_rps <= 0:
            return
        min_interval = 1.0 / self.rate_limit_rps
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self._last_request_at = time.monotonic()

    def _request(self, path: str, params: dict[str, Any] | None = None) -> list[dict]:
        """GET autenticado com retries. Retorna o array items[] do envelope."""
        url = self.base_url + path
        params = {k: v for k, v in (params or {}).items() if v is not None}

        last_exc: Exception | None = None
        for tentativa in range(self.retries + 1):
            token = self._get_token(force_refresh=False)
            headers = {"Authorization": f"Bearer {token}"}
            self._respect_rate_limit()

            try:
                resp = self._session.get(
                    url,
                    headers=headers,
                    params=params,
                    timeout=self.request_timeout_s,
                )
            except requests.RequestException as exc:
                last_exc = exc
                wait = 2 ** tentativa
                logger.warning(
                    f"[ANA] {path}: erro de rede ({exc}); retry em {wait}s "
                    f"({tentativa + 1}/{self.retries})"
                )
                time.sleep(wait)
                continue

            # Token expirado mid-flight → renovar uma vez
            if resp.status_code == 401 and tentativa == 0:
                logger.info("[ANA] Token rejeitado (401); renovando…")
                self._get_token(force_refresh=True)
                continue

            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                wait = 2 ** tentativa
                logger.warning(
                    f"[ANA] {path}: HTTP {resp.status_code}; retry em {wait}s "
                    f"({tentativa + 1}/{self.retries})"
                )
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                raise HidroWebError(
                    f"{path}: HTTP {resp.status_code} — {resp.text[:300]}"
                )

            try:
                payload = resp.json()
            except ValueError as exc:
                raise HidroWebError(
                    f"{path}: resposta não-JSON ({exc}); início: {resp.text[:200]}"
                ) from exc

            items = payload.get("items")
            if items is None:
                # Algumas rotas retornam diretamente lista; outras envelopam.
                if isinstance(payload, list):
                    return payload
                raise HidroWebError(
                    f"{path}: payload sem campo 'items': {str(payload)[:200]}"
                )
            if isinstance(items, dict):
                # auth / single-item endpoints
                return [items]
            return list(items)

        raise HidroWebError(
            f"{path}: esgotadas {self.retries} tentativas. Último erro: {last_exc}"
        )

    # ------------------------------------------------------------------
    # High-level helpers (cache + slicing)
    # ------------------------------------------------------------------

    def _cache_path(self, tipo: str, codigo: str, ini: str, fim: str) -> Path:
        d = self.raw_dir / tipo
        d.mkdir(parents=True, exist_ok=True)
        return d / f"{codigo}_{ini}_{fim}.json"

    def _cached_or_fetch(
        self,
        tipo: str,
        codigo: str,
        ini: str,
        fim: str,
        path: str,
        params: dict[str, Any],
        *,
        force: bool = False,
    ) -> list[dict]:
        cache_file = self._cache_path(tipo, codigo, ini, fim)
        if cache_file.exists() and not force:
            try:
                return json.loads(cache_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                logger.warning(f"[ANA] Cache corrompido em {cache_file}; refazendo.")

        items = self._request(path, params)
        cache_file.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
        return items

    @staticmethod
    def _slice_dates(ini: str, fim: str, max_dias: int) -> list[tuple[str, str]]:
        """Divide intervalo em janelas de até max_dias (incl.)."""
        d_ini = datetime.fromisoformat(ini).date()
        d_fim = datetime.fromisoformat(fim).date()
        if d_fim < d_ini:
            raise ValueError(f"DataFinal ({fim}) anterior a DataInicial ({ini})")
        janelas: list[tuple[str, str]] = []
        cursor = d_ini
        while cursor <= d_fim:
            cursor_end = min(cursor + timedelta(days=max_dias - 1), d_fim)
            janelas.append((cursor.isoformat(), cursor_end.isoformat()))
            cursor = cursor_end + timedelta(days=1)
        return janelas

    # ------------------------------------------------------------------
    # Endpoints específicos
    # ------------------------------------------------------------------

    # ----- Inventários e taxonomias ---------------------------------------

    def inventario(
        self,
        *,
        codigo_estacao: str | int | None = None,
        uf: str | None = None,
        codigo_bacia: int | None = None,
        data_atualizacao_inicial: str | None = None,
        data_atualizacao_final: str | None = None,
    ) -> list[dict]:
        """`/HidroInventarioEstacoes/v1` — inventário de estações.

        Pelo menos um filtro deve ser fornecido (código, UF ou bacia).
        """
        if not any([codigo_estacao, uf, codigo_bacia]):
            raise ValueError(
                "inventario(): informe ao menos um filtro (codigo, uf ou codigo_bacia)."
            )
        params = {
            "Código da Estação": codigo_estacao,
            "Unidade Federativa": uf,
            "Código da Bacia": codigo_bacia,
            "Data Atualização Inicial (yyyy-MM-dd)": data_atualizacao_inicial,
            "Data Atualização Final (yyyy-MM-dd)": data_atualizacao_final,
        }
        return self._request(
            "/EstacoesTelemetricas/HidroInventarioEstacoes/v1", params
        )

    def bacias(self) -> list[dict]:
        """`/HidroBacia/v1` — lista das 9 macrorregiões hidrográficas."""
        return self._request("/EstacoesTelemetricas/HidroBacia/v1")

    def sub_bacias(self, codigo: int | None = None) -> list[dict]:
        """`/HidroSubBacia/v1` — lista de sub-bacias hidrográficas."""
        params = {"Código da Sub-Bacia": codigo} if codigo else None
        return self._request("/EstacoesTelemetricas/HidroSubBacia/v1", params)

    # ----- Séries diárias (com Tipo Filtro Data obrigatório) --------------

    TIPO_FILTRO_DATA_LEITURA = "DATA_LEITURA"
    TIPO_FILTRO_DATA_ATUALIZACAO = "DATA_ULTIMA_ATUALIZACAO"

    def serie_vazao(
        self,
        codigo: str | int,
        ini: str,
        fim: str,
        *,
        tipo_filtro: str = TIPO_FILTRO_DATA_LEITURA,
        cache: bool = True,
    ) -> list[dict]:
        """`/HidroSerieVazao/v1` — vazão diária (m³/s). Fatia em janelas de 365 dias."""
        return self._serie_fatiada(
            tipo="vazao",
            path="/EstacoesTelemetricas/HidroSerieVazao/v1",
            codigo=codigo,
            ini=ini,
            fim=fim,
            tipo_filtro=tipo_filtro,
            cache=cache,
        )

    def serie_cotas(
        self,
        codigo: str | int,
        ini: str,
        fim: str,
        *,
        tipo_filtro: str = TIPO_FILTRO_DATA_LEITURA,
        cache: bool = True,
    ) -> list[dict]:
        """`/HidroSerieCotas/v1` — cotas diárias (cm)."""
        return self._serie_fatiada(
            tipo="cotas",
            path="/EstacoesTelemetricas/HidroSerieCotas/v1",
            codigo=codigo,
            ini=ini,
            fim=fim,
            tipo_filtro=tipo_filtro,
            cache=cache,
        )

    def serie_chuva(
        self,
        codigo: str | int,
        ini: str,
        fim: str,
        *,
        tipo_filtro: str = TIPO_FILTRO_DATA_LEITURA,
        cache: bool = True,
    ) -> list[dict]:
        """`/HidroSerieChuva/v1` — chuva diária (mm)."""
        return self._serie_fatiada(
            tipo="chuva",
            path="/EstacoesTelemetricas/HidroSerieChuva/v1",
            codigo=codigo,
            ini=ini,
            fim=fim,
            tipo_filtro=tipo_filtro,
            cache=cache,
        )

    def medicoes_descarga(
        self,
        codigo: str | int,
        ini: str,
        fim: str,
        *,
        tipo_filtro: str = TIPO_FILTRO_DATA_LEITURA,
        cache: bool = True,
    ) -> list[dict]:
        """`/HidroSerieResumoDescarga/v1` — medições líquidas para curva-chave."""
        return self._serie_fatiada(
            tipo="medicoes",
            path="/EstacoesTelemetricas/HidroSerieResumoDescarga/v1",
            codigo=codigo,
            ini=ini,
            fim=fim,
            tipo_filtro=tipo_filtro,
            cache=cache,
        )

    def curva_descarga(
        self,
        codigo: str | int,
        ini: str,
        fim: str,
        *,
        tipo_filtro: str = TIPO_FILTRO_DATA_LEITURA,
        cache: bool = True,
    ) -> list[dict]:
        """`/HidroSerieCurvaDescarga/v1` — curvas-chave ajustadas pela ANA."""
        return self._serie_fatiada(
            tipo="curva_descarga",
            path="/EstacoesTelemetricas/HidroSerieCurvaDescarga/v1",
            codigo=codigo,
            ini=ini,
            fim=fim,
            tipo_filtro=tipo_filtro,
            cache=cache,
        )

    # ------------------------------------------------------------------
    # Implementação interna do fatiamento
    # ------------------------------------------------------------------

    def _serie_fatiada(
        self,
        *,
        tipo: str,
        path: str,
        codigo: str | int,
        ini: str,
        fim: str,
        tipo_filtro: str | None,
        cache: bool,
    ) -> list[dict]:
        codigo_str = str(codigo)
        janelas = self._slice_dates(ini, fim, max_dias=365)
        agregado: list[dict] = []
        for j_ini, j_fim in janelas:
            params: dict[str, Any] = {
                "Código da Estação": codigo_str,
                "Data Inicial (yyyy-MM-dd)": j_ini,
                "Data Final (yyyy-MM-dd)": j_fim,
            }
            if tipo_filtro is not None:
                params["Tipo Filtro Data"] = tipo_filtro
            if cache:
                items = self._cached_or_fetch(
                    tipo=tipo,
                    codigo=codigo_str,
                    ini=j_ini,
                    fim=j_fim,
                    path=path,
                    params=params,
                )
            else:
                items = self._request(path, params)
            agregado.extend(items)
            logger.debug(
                f"[ANA] {tipo} {codigo_str} {j_ini}→{j_fim}: {len(items)} registros"
            )
        return agregado


def client_from_env() -> HidroWebClient:
    """Constrói um cliente lendo credenciais do ambiente.

    Variáveis esperadas (em pipeline/.env):
      - ANA_API_USER
      - ANA_API_PASS
      - ANA_API_BASE_URL (opcional)
    """
    import os

    cpf = os.environ.get("ANA_API_USER")
    senha = os.environ.get("ANA_API_PASS")
    base = os.environ.get("ANA_API_BASE_URL", "https://www.ana.gov.br/hidrowebservice")
    if not cpf or not senha:
        raise RuntimeError(
            "ANA_API_USER e ANA_API_PASS precisam estar definidos em pipeline/.env"
        )
    return HidroWebClient(cpf=cpf, senha=senha, base_url=base)
