"""
models/account.py
─────────────────
계정(Account) 관련 Pydantic 모델.
복식부기의 계정과목표(Chart of Accounts)를 표현한다.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AccountType(str, Enum):
    """복식부기 계정 유형."""
    asset = "asset"          # 자산 (차변 증가)
    liability = "liability"  # 부채 (대변 증가)
    equity = "equity"        # 자본 (대변 증가)
    income = "income"        # 수익 (대변 증가)
    expense = "expense"      # 비용 (차변 증가)


class AccountCreate(BaseModel):
    """계정 생성 요청 바디."""
    account_code: str = Field(..., description="계정 코드 (예: 1001)")
    name: str = Field(..., description="계정명 (예: 현금및현금성자산)")
    account_type: AccountType
    parent_account_id: Optional[str] = Field(None, description="상위 계정 ID (없으면 최상위)")
    currency: str = Field(default="KRW", description="기준 통화")
    notes: Optional[str] = Field(None, description="비고")


class AccountUpdate(BaseModel):
    """계정 수정 요청 바디 (모든 필드 선택적)."""
    account_code: Optional[str] = None
    name: Optional[str] = None
    account_type: Optional[AccountType] = None
    parent_account_id: Optional[str] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class Account(BaseModel):
    """계정 응답 모델."""
    account_id: str
    account_code: str
    name: str
    account_type: AccountType
    parent_account_id: Optional[str] = None
    currency: str
    is_active: bool = True
    notes: Optional[str] = None
    created_at: str
