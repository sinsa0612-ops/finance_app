"""
routers/investments.py
──────────────────────
투자 자산 관리 REST API 엔드포인트.

GET    /api/investments/positions              - 포지션 목록 (실시간 평가)
POST   /api/investments/positions              - 포지션 생성
GET    /api/investments/positions/{id}         - 단일 포지션
PUT    /api/investments/positions/{id}         - 포지션 수정
DELETE /api/investments/positions/{id}         - 포지션 삭제
GET    /api/investments/positions/{id}/txns    - 포지션 거래 내역
POST   /api/investments/transactions           - 투자 거래 추가
GET    /api/investments/transactions           - 전체 거래 이력
GET    /api/investments/portfolio/summary      - 포트폴리오 요약
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from models.investment import (
    InvestmentPosition, InvestmentPositionCreate, InvestmentPositionUpdate,
    InvestmentTransaction, InvestmentTransactionCreate, PositionValuation,
)
from services.oracle_service import OracleService, get_oracle_service
from services.investment_service import evaluate_positions, compute_portfolio_summary

router = APIRouter(prefix="/api/investments", tags=["investments"])

_DB = Depends(get_oracle_service)


@router.get("/portfolio/summary")
def get_portfolio_summary(db: OracleService = _DB):
    """전체 포트폴리오 합산 요약 (총 투자금·평가액·손익)을 반환한다."""
    positions = db.get_all_positions()
    try:
        valuations = evaluate_positions(positions, db)
    except Exception:
        valuations = []
    return compute_portfolio_summary(valuations)


@router.get("/positions", response_model=List[PositionValuation])
def list_positions(db: OracleService = _DB):
    """모든 투자 포지션을 실시간 가격 평가와 함께 반환한다."""
    positions = db.get_all_positions()
    try:
        return evaluate_positions(positions, db)
    except Exception:
        return [PositionValuation(
            position_id=p.get("position_id", ""),
            account_id=p.get("account_id", ""),
            ticker=p.get("ticker", ""),
            asset_type=p.get("asset_type", "stock"),
            exchange=p.get("exchange") or None,
            quantity=float(p.get("quantity", 0)),
            avg_cost_price=float(p.get("avg_cost_price", 0)),
            total_cost=float(p.get("total_cost", 0)),
            currency=p.get("currency", "USD"),
        ) for p in positions]


@router.post("/positions", response_model=InvestmentPosition, status_code=201)
def create_position(body: InvestmentPositionCreate, db: OracleService = _DB):
    """
    새 투자 포지션을 생성한다.
    동일 계정에 같은 티커가 이미 존재하면 409 반환.
    """
    if db.get_position_by_ticker(body.ticker, body.account_id):
        raise HTTPException(
            status_code=409,
            detail=f"계정 {body.account_id}에 {body.ticker} 포지션이 이미 존재합니다. 투자거래 추가를 사용하세요.",
        )
    return db.create_position(body.model_dump())


@router.get("/positions/{position_id}", response_model=PositionValuation)
def get_position(position_id: str, db: OracleService = _DB):
    """단일 포지션을 실시간 가격 평가와 함께 반환한다."""
    pos = db.get_position_by_id(position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="포지션을 찾을 수 없습니다.")
    return evaluate_positions([pos], db)[0]


@router.put("/positions/{position_id}", response_model=InvestmentPosition)
def update_position(position_id: str, body: InvestmentPositionUpdate, db: OracleService = _DB):
    """포지션 정보를 직접 수정한다 (수량·평균가 수동 조정)."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="업데이트할 항목이 없습니다.")
    updated = db.update_position(position_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="포지션을 찾을 수 없습니다.")
    return updated


@router.delete("/positions/{position_id}", status_code=204)
def delete_position(position_id: str, db: OracleService = _DB):
    """포지션을 삭제한다."""
    if not db.delete_position(position_id):
        raise HTTPException(status_code=404, detail="포지션을 찾을 수 없습니다.")


@router.get("/positions/{position_id}/txns", response_model=List[InvestmentTransaction])
def get_position_transactions(position_id: str, db: OracleService = _DB):
    """특정 포지션의 매수·매도 거래 이력을 반환한다."""
    pos = db.get_position_by_id(position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="포지션을 찾을 수 없습니다.")
    txns = db.get_inv_txns_by_position(position_id)
    for t in txns:
        t["ticker"] = pos.get("ticker", "")
    return txns


@router.post("/transactions", response_model=InvestmentTransaction, status_code=201)
def create_investment_transaction(body: InvestmentTransactionCreate, db: OracleService = _DB):
    """매수/매도/배당 거래를 기록하고 포지션 평균가·수량을 자동 재계산한다."""
    if not db.get_position_by_id(body.position_id):
        raise HTTPException(status_code=404, detail="포지션을 찾을 수 없습니다.")
    return db.create_investment_transaction(body.model_dump())


@router.get("/transactions", response_model=List[InvestmentTransaction])
def list_all_investment_transactions(db: OracleService = _DB):
    """모든 투자 거래 내역을 반환한다."""
    all_positions = {p["position_id"]: p for p in db.get_all_positions()}
    txns = db.get_all_investment_transactions()
    for t in txns:
        pos = all_positions.get(t.get("position_id", ""), {})
        t["ticker"] = t.get("ticker") or pos.get("ticker", "")
    return txns
