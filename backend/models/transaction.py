"""
models/transaction.py
─────────────────────
복식부기 거래(Transaction)와 분개(JournalEntry) Pydantic 모델.

복식부기 원칙:
  - 모든 거래는 최소 2개의 분개 라인으로 구성된다.
  - 차변 합계 == 대변 합계 (거래 균형)
  - 자산·비용: 차변 증가 / 대변 감소
  - 부채·자본·수익: 대변 증가 / 차변 감소
"""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, List


class JournalEntryLine(BaseModel):
    """분개 한 줄 (계정별 차변/대변 금액)."""
    account_id: str = Field(..., description="계정 ID")
    debit_amount: float = Field(default=0.0, ge=0, description="차변 금액")
    credit_amount: float = Field(default=0.0, ge=0, description="대변 금액")
    notes: Optional[str] = Field(None, description="라인별 비고")


class TransactionCreate(BaseModel):
    """거래 생성 요청 바디."""
    date: str = Field(..., description="거래 날짜 YYYY-MM-DD")
    description: str = Field(..., description="거래 설명")
    currency: str = Field(default="KRW", description="기준 통화")
    entries: List[JournalEntryLine] = Field(..., min_length=2, description="분개 항목 목록")
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_balanced(self) -> "TransactionCreate":
        """차변 합계와 대변 합계가 일치하는지 검증한다."""
        total_debit = sum(e.debit_amount for e in self.entries)
        total_credit = sum(e.credit_amount for e in self.entries)
        # 부동소수점 오차를 감안해 0.01 이하 허용
        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(
                f"차변 합계({total_debit})와 대변 합계({total_credit})가 일치하지 않습니다."
            )
        return self


class JournalEntry(BaseModel):
    """분개 응답 모델."""
    entry_id: str
    transaction_id: str
    date: str
    description: str
    account_id: str
    account_name: Optional[str] = None     # 조인된 계정명
    account_type: Optional[str] = None     # 조인된 계정 유형
    debit_amount: float
    credit_amount: float
    currency: str
    notes: Optional[str] = None
    created_at: str


class Transaction(BaseModel):
    """거래 응답 모델 (분개 목록 포함)."""
    transaction_id: str
    date: str
    description: str
    currency: str
    total_amount: float         # 차변(=대변) 합계
    entries: List[JournalEntry] = []
    notes: Optional[str] = None
    created_at: str


class TransactionFilter(BaseModel):
    """거래 목록 필터링 파라미터."""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    account_id: Optional[str] = None
    description: Optional[str] = None
    limit: int = Field(default=100, le=500)
    offset: int = Field(default=0, ge=0)
