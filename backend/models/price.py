"""
models/price.py
───────────────
시세 조회 관련 Pydantic 모델.
"""

from pydantic import BaseModel
from typing import Optional, List


class PriceData(BaseModel):
    """단일 종목 시세 데이터."""
    ticker: str
    price: Optional[float] = None       # 현재가 (None = 조회 실패)
    currency: str = "USD"
    source: str = "unknown"             # 데이터 출처: yfinance / coingecko / alpha_vantage / cache
    is_cached: bool = False             # 캐시 데이터 여부
    updated_at: str = ""                # 조회 시각 ISO 문자열
    error: Optional[str] = None         # 오류 메시지


class BatchPriceResponse(BaseModel):
    """복수 종목 시세 응답."""
    prices: List[PriceData]
    total: int
