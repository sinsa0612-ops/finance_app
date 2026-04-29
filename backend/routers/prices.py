"""
routers/prices.py
─────────────────
실시간 시세 조회 REST API 엔드포인트.

GET  /api/prices/{ticker}      - 단일 종목 시세
POST /api/prices/batch         - 복수 종목 시세
GET  /api/prices/status        - 레이트 리밋 상태 확인
"""

from fastapi import APIRouter, Query
from typing import List
from models.price import PriceData, BatchPriceResponse
from services.price_service import get_price, get_prices_batch, get_rate_limit_status

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/status")
def price_service_status():
    """각 가격 제공자의 남은 요청 수를 반환한다 (디버깅·모니터링용)."""
    return get_rate_limit_status()


@router.get("/{ticker}", response_model=PriceData)
def get_single_price(
    ticker: str,
    asset_type: str = Query(default="stock", description="자산 유형: stock | crypto | etf"),
):
    """
    단일 종목의 현재 시세를 조회한다.
    - 티커 예시: AAPL, 005930.KS (삼성전자), BTC-USD, ETH-USD
    """
    return get_price(ticker.upper(), asset_type)


@router.post("/batch", response_model=BatchPriceResponse)
def get_batch_prices(
    tickers: List[str],
    asset_type: str = Query(default="stock", description="자산 유형: stock | crypto"),
):
    """
    복수 종목의 현재 시세를 한 번에 조회한다.
    캐시 히트 종목은 API를 호출하지 않아 레이트 리밋을 절약한다.
    """
    prices_map = get_prices_batch(tickers, asset_type)
    prices_list = list(prices_map.values())
    return BatchPriceResponse(prices=prices_list, total=len(prices_list))
