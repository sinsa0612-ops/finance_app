"""
services/price_service.py
─────────────────────────
실시간 시세 조회 서비스.

제공자(Provider) 우선순위 및 폴백 전략:
  주식(Stock): yfinance → Alpha Vantage → 만료된 캐시 반환
  암호화폐(Crypto): yfinance → CoinGecko → 만료된 캐시 반환

레이트 리밋 보호:
  - 각 제공자별 독립 RateLimiter 운영
  - 제공자 차단 시 다음 폴백으로 자동 전환
  - 모든 제공자 실패 시 마지막 캐시값 반환 (타임스탬프 표시)

캐시 전략:
  - 정상: TTLCache 5분 (in-memory)
  - 오류 시: 같은 캐시를 15분까지 연장 반환
  - 별도 _stale_cache에 마지막 성공 가격 영구 보관
"""

import time
import threading
import requests
import yfinance as yf
from cachetools import TTLCache
from datetime import datetime, timezone
from typing import Optional, Dict, Tuple
from config import settings
from models.price import PriceData


# ─── 레이트 리밋 ─────────────────────────────────────────────────────────────

class RateLimiter:
    """슬라이딩 윈도우 방식의 레이트 리밋 구현."""

    def __init__(self, max_requests: int, period_seconds: int) -> None:
        self._max = max_requests
        self._period = period_seconds
        self._timestamps: list = []
        self._lock = threading.Lock()

    def is_allowed(self) -> bool:
        """요청 허용 여부를 반환하고, 허용 시 카운터를 증가시킨다."""
        now = time.monotonic()
        with self._lock:
            # 유효 기간 밖의 타임스탬프 제거
            self._timestamps = [t for t in self._timestamps if now - t < self._period]
            if len(self._timestamps) < self._max:
                self._timestamps.append(now)
                return True
            return False

    def remaining(self) -> int:
        """남은 허용 요청 수를 반환한다."""
        now = time.monotonic()
        with self._lock:
            valid = [t for t in self._timestamps if now - t < self._period]
            return max(0, self._max - len(valid))


# 제공자별 레이트 리밋 인스턴스
_rl_yfinance = RateLimiter(settings.yfinance_max_per_hour, 3600)
_rl_coingecko = RateLimiter(settings.coingecko_max_per_minute, 60)
_rl_alphavantage = RateLimiter(settings.alpha_vantage_max_per_minute, 60)


# ─── 캐시 ────────────────────────────────────────────────────────────────────

# 정상 TTL 캐시: 5분
_price_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.price_cache_ttl)
# 만료 후에도 마지막 성공 데이터 보관 (폴백용)
_stale_cache: Dict[str, PriceData] = {}
_cache_lock = threading.Lock()


def _cache_get(ticker: str) -> Optional[PriceData]:
    """캐시에서 가격 데이터를 조회한다. 없으면 None 반환."""
    with _cache_lock:
        return _price_cache.get(ticker.upper())


def _cache_set(ticker: str, data: PriceData) -> None:
    """가격 데이터를 캐시에 저장하고 stale_cache도 갱신한다."""
    key = ticker.upper()
    with _cache_lock:
        _price_cache[key] = data
        _stale_cache[key] = data  # 만료 후에도 최후 데이터 유지


def _stale_get(ticker: str) -> Optional[PriceData]:
    """만료된 마지막 성공 데이터를 반환한다."""
    return _stale_cache.get(ticker.upper())


# ─── 코인게코 ID 매핑 ─────────────────────────────────────────────────────────

# yfinance 티커 / 심볼 → CoinGecko ID 매핑
# CoinGecko 전체 목록: https://api.coingecko.com/api/v3/coins/list
COINGECKO_ID_MAP: Dict[str, str] = {
    "BTC": "bitcoin",
    "BTC-USD": "bitcoin",
    "ETH": "ethereum",
    "ETH-USD": "ethereum",
    "BNB": "binancecoin",
    "BNB-USD": "binancecoin",
    "XRP": "ripple",
    "XRP-USD": "ripple",
    "ADA": "cardano",
    "ADA-USD": "cardano",
    "SOL": "solana",
    "SOL-USD": "solana",
    "DOGE": "dogecoin",
    "DOGE-USD": "dogecoin",
    "DOT": "polkadot",
    "DOT-USD": "polkadot",
    "AVAX": "avalanche-2",
    "AVAX-USD": "avalanche-2",
    "LINK": "chainlink",
    "LINK-USD": "chainlink",
    "MATIC": "matic-network",
    "MATIC-USD": "matic-network",
    "UNI": "uniswap",
    "UNI-USD": "uniswap",
    "LTC": "litecoin",
    "LTC-USD": "litecoin",
}


def _ticker_to_coingecko_id(ticker: str) -> Optional[str]:
    """yfinance 티커를 CoinGecko ID로 변환한다."""
    upper = ticker.upper()
    if upper in COINGECKO_ID_MAP:
        return COINGECKO_ID_MAP[upper]
    # BTC-USD 형식에서 기본 심볼 추출
    base = upper.split("-")[0]
    return COINGECKO_ID_MAP.get(base)


# ─── 제공자별 조회 함수 ───────────────────────────────────────────────────────

def _fetch_yfinance(ticker: str) -> PriceData:
    """
    yfinance로 주식/ETF/암호화폐 가격 조회.
    - yfinance는 야후파이낸스 비공식 API를 사용하므로 차단 가능성 존재.
    - fast_info를 사용해 최소 데이터만 요청한다.
    """
    if not _rl_yfinance.is_allowed():
        raise RuntimeError("yfinance 레이트 리밋 초과")

    stock = yf.Ticker(ticker)
    fast = stock.fast_info
    price = fast.last_price
    currency = getattr(fast, "currency", "USD") or "USD"

    if price is None or price != price:  # NaN 체크
        raise ValueError(f"yfinance: {ticker} 가격 없음")

    price_f = round(float(price), 6)
    prev_close = getattr(fast, "previous_close", None)
    change = change_pct = None
    if prev_close and float(prev_close) > 0:
        change = round(price_f - float(prev_close), 6)
        change_pct = round(change / float(prev_close) * 100, 4)

    return PriceData(
        ticker=ticker,
        price=price_f,
        change=change,
        change_pct=change_pct,
        currency=currency,
        source="yfinance",
        is_cached=False,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


def _fetch_coingecko(ticker: str) -> PriceData:
    """
    CoinGecko 공개 API로 암호화폐 가격 조회.
    - 무료, API 키 불필요 (비로그인 10 req/min).
    - vs_currencies=usd,krw 로 복수 통화 동시 조회 가능.
    """
    if not _rl_coingecko.is_allowed():
        raise RuntimeError("CoinGecko 레이트 리밋 초과")

    coin_id = _ticker_to_coingecko_id(ticker)
    if not coin_id:
        raise ValueError(f"CoinGecko: {ticker}의 코인 ID를 찾을 수 없음")

    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={coin_id}&vs_currencies=usd&include_last_updated_at=true"
    )
    resp = requests.get(url, timeout=5, headers={"Accept": "application/json"})
    resp.raise_for_status()
    data = resp.json()

    if coin_id not in data or "usd" not in data[coin_id]:
        raise ValueError(f"CoinGecko: {ticker} 응답 데이터 없음")

    price = data[coin_id]["usd"]
    return PriceData(
        ticker=ticker,
        price=round(float(price), 6),
        currency="USD",
        source="coingecko",
        is_cached=False,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


def _fetch_alpha_vantage(ticker: str) -> PriceData:
    """
    Alpha Vantage GLOBAL_QUOTE 엔드포인트로 주식 가격 조회.
    - 무료 티어: 5 req/min, 500 req/day.
    - API 키 필요 (무료 발급: https://www.alphavantage.co/support/#api-key).
    """
    if not _rl_alphavantage.is_allowed():
        raise RuntimeError("Alpha Vantage 레이트 리밋 초과")

    api_key = settings.alpha_vantage_api_key
    url = (
        f"https://www.alphavantage.co/query"
        f"?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
    )
    resp = requests.get(url, timeout=8, headers={"Accept": "application/json"})
    resp.raise_for_status()
    data = resp.json()

    quote = data.get("Global Quote", {})
    price_str = quote.get("05. price")
    if not price_str:
        # "Note" 키가 있으면 레이트 리밋 응답
        if "Note" in data or "Information" in data:
            raise RuntimeError("Alpha Vantage 레이트 리밋 또는 일일 한도 초과")
        raise ValueError(f"Alpha Vantage: {ticker} 가격 데이터 없음")

    return PriceData(
        ticker=ticker,
        price=round(float(price_str), 6),
        currency="USD",
        source="alpha_vantage",
        is_cached=False,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


# ─── 메인 공개 인터페이스 ─────────────────────────────────────────────────────

def get_price(ticker: str, asset_type: str = "stock") -> PriceData:
    """
    단일 종목 현재가를 조회한다.

    Args:
        ticker    : 종목 코드 (예: AAPL, BTC-USD, 005930.KS)
        asset_type: 'stock' | 'crypto' | 'etf' 등

    Returns:
        PriceData (가격 조회 실패 시 price=None, error 필드에 사유)

    폴백 순서:
      crypto → yfinance → CoinGecko → stale cache
      stock  → yfinance → Alpha Vantage → stale cache
    """
    upper_ticker = ticker.upper()

    # 1. 캐시 확인
    cached = _cache_get(upper_ticker)
    if cached is not None:
        return cached.model_copy(update={"is_cached": True})

    errors: list = []
    is_crypto = asset_type == "crypto" or "-USD" in upper_ticker or "-KRW" in upper_ticker

    # 2. 제공자 순서 정의
    if is_crypto:
        providers = [
            ("yfinance", lambda: _fetch_yfinance(ticker)),
            ("coingecko", lambda: _fetch_coingecko(ticker)),
        ]
    else:
        providers = [
            ("yfinance", lambda: _fetch_yfinance(ticker)),
            ("alpha_vantage", lambda: _fetch_alpha_vantage(ticker)),
        ]

    # 3. 순서대로 시도
    for provider_name, fetch_fn in providers:
        try:
            result = fetch_fn()
            _cache_set(upper_ticker, result)
            return result
        except Exception as e:
            errors.append(f"{provider_name}: {e}")

    # 4. 모든 제공자 실패 → stale 캐시 반환
    stale = _stale_get(upper_ticker)
    if stale:
        return stale.model_copy(update={
            "is_cached": True,
            "error": f"모든 제공자 실패 (stale 캐시 반환). 오류: {'; '.join(errors)}",
        })

    # 5. 완전 실패
    return PriceData(
        ticker=ticker,
        price=None,
        source="none",
        updated_at=datetime.now(timezone.utc).isoformat(),
        error="; ".join(errors),
    )


def get_prices_batch(tickers: list[str], asset_type: str = "stock") -> Dict[str, PriceData]:
    """
    복수 종목 시세를 조회한다.
    캐시 히트 우선, 미스된 종목만 실제 API 호출.
    """
    results: Dict[str, PriceData] = {}
    for ticker in tickers:
        results[ticker.upper()] = get_price(ticker, asset_type)
    return results


def get_rate_limit_status() -> Dict[str, int]:
    """현재 각 제공자별 남은 요청 수를 반환한다 (디버깅 용도)."""
    return {
        "yfinance_remaining_per_hour": _rl_yfinance.remaining(),
        "coingecko_remaining_per_minute": _rl_coingecko.remaining(),
        "alpha_vantage_remaining_per_minute": _rl_alphavantage.remaining(),
    }
