"""
routers/accounts.py
───────────────────
계정과목표(Chart of Accounts) REST API 엔드포인트.

GET    /api/accounts          - 전체 계정 목록
POST   /api/accounts          - 계정 생성
GET    /api/accounts/{id}     - 단일 계정 조회
PUT    /api/accounts/{id}     - 계정 수정
DELETE /api/accounts/{id}     - 계정 삭제
GET    /api/accounts/{id}/balance - 계정 잔액 조회
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models.account import Account, AccountCreate, AccountUpdate
from services.oracle_service import OracleService, get_oracle_service

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

# 의존성 주입 단축 별칭
_DB = Depends(get_oracle_service)


@router.get("", response_model=List[Account])
def list_accounts(db: OracleService = _DB):
    """모든 계정과목을 반환한다."""
    return db.get_all_accounts()


@router.post("", response_model=Account, status_code=201)
def create_account(body: AccountCreate, db: OracleService = _DB):
    """새 계정과목을 생성한다."""
    return db.create_account(body.model_dump())


@router.get("/{account_id}", response_model=Account)
def get_account(account_id: str, db: OracleService = _DB):
    """단일 계정과목을 반환한다."""
    row = db.get_account_by_id(account_id)
    if not row:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")
    return row


@router.put("/{account_id}", response_model=Account)
def update_account(account_id: str, body: AccountUpdate, db: OracleService = _DB):
    """계정과목 정보를 수정한다."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="업데이트할 항목이 없습니다.")
    updated = db.update_account(account_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")
    return updated


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: str, db: OracleService = _DB):
    """계정과목을 삭제한다."""
    if not db.delete_account(account_id):
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")


@router.get("/{account_id}/balance")
def get_account_balance(account_id: str, db: OracleService = _DB):
    """
    특정 계정의 현재 잔액을 반환한다.
    잔액 = 차변 합계 - 대변 합계 (자산·비용 기준 정잔액이 양수)
    """
    account = db.get_account_by_id(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

    # Oracle에서 직접 집계 — 전체 분개를 Python으로 끌어오지 않는다
    entries = db.get_all_journal_entries()
    total_debit  = sum(float(e.get("debit_amount",  0)) for e in entries if e.get("account_id") == account_id)
    total_credit = sum(float(e.get("credit_amount", 0)) for e in entries if e.get("account_id") == account_id)

    return {
        "account_id":   account_id,
        "account_name": account.get("name"),
        "account_type": account.get("account_type"),
        "total_debit":  total_debit,
        "total_credit": total_credit,
        "balance":      total_debit - total_credit,
        "currency":     account.get("currency", "KRW"),
    }
