"""
models/investment.py
────────────────────
투자 자산 포지션 및 거래 내역 Pydantic 모델.

포지션(InvestmentPosition): 현재 보유 종목의 수량·평균가 추적
투자거래(InvestmentTransaction): 매수/매도/배당 이력
포지션평가(PositionValuation): 실시간 가격 반영 평가액
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AssetType(str, Enum):
    """투자 자산 유형."""
    stock = "stock"       # 주식
    crypto = "crypto"     # 암호화폐
    etf = "etf"           # ETF
    fund = "fund"         # 펀드
    bond = "bond"         # 채권
    other = "other"       # 기타


class InvestmentAction(str, Enum):
    """투자 거래 유형."""
    buy = "buy"             # 매수
    sell = "sell"           # 매도
    dividend = "dividend"   # 배당
    split = "split"         # 주식 분할
    transfer = "transfer"   # 이전


class InvestmentPositionCreate(BaseModel):
    """투자 포지션 생성 요청 바디."""
    account_id: str = Field(..., description="연결된 자산 계정 ID")
    ticker: str = Field(..., description="종목 코드 (예: AAPL, BTC-USD, 005930.KS)")
    asset_type: AssetType
    exchange: Optional[str] = Field(None, description="거래소 (예: NASDAQ, KRX, Binance)")
    quantity: float = Field(..., gt=0, description="보유 수량")
    avg_cost_price: float = Field(..., gt=0, description="평균 매입가")
    currency: str = Field(default="USD", description="거래 통화")
    notes: Optional[str] = None


class InvestmentPositionUpdate(BaseModel):
    """투자 포지션 수정 요청 바디."""
    quantity: Optional[float] = None
    avg_cost_price: Optional[float] = None
    exchange: Optional[str] = None
    notes: Optional[str] = None


class InvestmentPosition(BaseModel):
    """투자 포지션 응답 모델."""
    position_id: str
    account_id: str
    ticker: str
    asset_type: AssetType
    exchange: Optional[str] = None
    quantity: float
    avg_cost_price: float
    total_cost: float           # quantity * avg_cost_price
    currency: str
    notes: Optional[str] = None
    updated_at: str


class InvestmentTransactionCreate(BaseModel):
    """투자 거래 내역 생성 요청 바디."""
    position_id: str = Field(..., description="연결된 포지션 ID")
    date: str = Field(..., description="거래 날짜 YYYY-MM-DD")
    action: InvestmentAction
    quantity: float = Field(..., gt=0, description="거래 수량")
    price: float = Field(..., gt=0, description="거래 단가")
    fee: float = Field(default=0.0, ge=0, description="거래 수수료")
    currency: str = Field(default="USD")
    linked_transaction_id: Optional[str] = Field(None, description="연결된 분개 거래 ID")
    notes: Optional[str] = None


class InvestmentTransaction(BaseModel):
    """투자 거래 내역 응답 모델."""
    inv_txn_id: str
    position_id: str
    ticker: str
    date: str
    action: InvestmentAction
    quantity: float
    price: float
    amount: float               # quantity * price (세금·수수료 제외)
    fee: float
    currency: str
    linked_transaction_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: str


class PositionValuation(BaseModel):
    """실시간 가격이 반영된 포지션 평가 모델."""
    position_id: str
    account_id: str
    ticker: str
    asset_type: str
    exchange: Optional[str] = None
    quantity: float
    avg_cost_price: float
    total_cost: float
    currency: str
    # 실시간 가격 데이터
    current_price: Optional[float] = None
    current_value: Optional[float] = None       # quantity * current_price
    unrealized_pnl: Optional[float] = None      # current_value - total_cost
    unrealized_pnl_pct: Optional[float] = None  # unrealized_pnl / total_cost * 100
    price_source: Optional[str] = None          # 데이터 출처 (yfinance/coingecko/...)
    price_updated_at: Optional[str] = None
    price_error: Optional[str] = None           # 가격 조회 실패 사유
