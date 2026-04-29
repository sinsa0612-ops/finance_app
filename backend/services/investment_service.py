"""
services/investment_service.py
──────────────────────────────
투자 포지션 평가 및 포트폴리오 집계 비즈니스 로직.
실시간 시세를 price_service에서 받아 평가액·손익을 계산한다.

DB 서비스 타입에 의존하지 않도록 Any 타입을 허용한다.
(Google Sheets → Oracle 전환 시 이 파일은 변경 불필요)
"""

from typing import List, Dict, Any
from models.investment import PositionValuation
from services.price_service import get_prices_batch


def evaluate_positions(positions: List[Dict], db: Any) -> List[PositionValuation]:
    """
    포지션 목록에 실시간 가격을 붙여 평가 데이터를 반환한다.

    Args:
        positions : DB 서비스의 get_all_positions()에서 읽은 딕셔너리 목록
        db        : DB 서비스 인스턴스 (현재 미사용, 향후 확장용)

    Returns:
        PositionValuation 목록 (평가액·손익 포함)
    """
    if not positions:
        return []

    # 고유 티커를 자산 유형별로 분리
    stock_tickers  = []
    crypto_tickers = []
    for p in positions:
        ticker     = p.get("ticker", "").upper()
        asset_type = p.get("asset_type", "stock")
        if asset_type == "crypto":
            crypto_tickers.append(ticker)
        else:
            stock_tickers.append(ticker)

    # 배치 가격 조회 (캐시 활용으로 API 호출 최소화)
    price_map: Dict = {}
    if stock_tickers:
        price_map.update(get_prices_batch(stock_tickers, asset_type="stock"))
    if crypto_tickers:
        price_map.update(get_prices_batch(crypto_tickers, asset_type="crypto"))

    # 포지션별 평가 정보 계산
    valuations = []
    for p in positions:
        ticker     = p.get("ticker", "").upper()
        quantity   = float(p.get("quantity",       0))
        avg_cost   = float(p.get("avg_cost_price", 0))
        total_cost = float(p.get("total_cost", quantity * avg_cost))

        price_data    = price_map.get(ticker)
        current_price = price_data.price if price_data else None

        current_value      = None
        unrealized_pnl     = None
        unrealized_pnl_pct = None
        if current_price is not None and quantity > 0:
            current_value      = round(current_price * quantity, 6)
            unrealized_pnl     = round(current_value - total_cost, 6)
            unrealized_pnl_pct = round(
                (unrealized_pnl / total_cost * 100) if total_cost else 0, 4
            )

        valuations.append(PositionValuation(
            position_id        = p.get("position_id", ""),
            account_id         = p.get("account_id",  ""),
            ticker             = ticker,
            asset_type         = p.get("asset_type",  "stock"),
            exchange           = p.get("exchange")  or None,
            quantity           = quantity,
            avg_cost_price     = avg_cost,
            total_cost         = total_cost,
            currency           = p.get("currency", "USD"),
            current_price      = current_price,
            current_value      = current_value,
            unrealized_pnl     = unrealized_pnl,
            unrealized_pnl_pct = unrealized_pnl_pct,
            price_source       = price_data.source      if price_data else None,
            price_updated_at   = price_data.updated_at  if price_data else None,
            price_error        = price_data.error        if price_data else None,
        ))

    return valuations


def compute_portfolio_summary(valuations: List[PositionValuation]) -> Dict:
    """전체 포트폴리오 합산 요약 데이터를 계산한다."""
    total_cost  = sum(v.total_cost for v in valuations)
    total_value = sum(v.current_value for v in valuations if v.current_value is not None)
    total_pnl   = (total_value - total_cost) if total_value else None
    total_pnl_pct = (
        (total_pnl / total_cost * 100) if (total_pnl is not None and total_cost) else None
    )

    return {
        "total_cost":              round(total_cost,  2),
        "total_value":             round(total_value, 2) if total_value else None,
        "total_unrealized_pnl":    round(total_pnl,   2) if total_pnl   is not None else None,
        "total_unrealized_pnl_pct": round(total_pnl_pct, 4) if total_pnl_pct is not None else None,
        "position_count":          len(valuations),
    }
