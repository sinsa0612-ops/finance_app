"""
routers/transactions.py
───────────────────────
복식부기 거래(Transaction) REST API 엔드포인트.

POST   /api/transactions               - 거래 생성 (분개 포함)
GET    /api/transactions               - 거래 목록 (필터·페이지네이션)
GET    /api/transactions/{id}          - 단일 거래 조회
DELETE /api/transactions/{id}          - 거래 삭제 (분개 포함)
GET    /api/transactions/account/{id}  - 계정별 거래 조회 (원장)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from models.transaction import Transaction, TransactionCreate, JournalEntry
from services.oracle_service import OracleService, get_oracle_service

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

_DB = Depends(get_oracle_service)


def _build_transaction(
    transaction_id: str,
    entries: List[dict],
    accounts_map: dict,
    description: str,
    date: str,
    currency: str,
    notes: str,
    created_at: str,
) -> Transaction:
    """분개 항목 목록을 Transaction 응답 모델로 조립한다."""
    journal_entries = []
    total_debit = 0.0
    for e in entries:
        account_id = e.get("account_id", "")
        acc        = accounts_map.get(account_id, {})
        debit      = float(e.get("debit_amount", 0))
        total_debit += debit
        journal_entries.append(JournalEntry(
            entry_id       = e.get("entry_id", ""),
            transaction_id = transaction_id,
            date           = e.get("date", date),
            description    = description,
            account_id     = account_id,
            account_name   = acc.get("name"),
            account_type   = acc.get("account_type"),
            debit_amount   = debit,
            credit_amount  = float(e.get("credit_amount", 0)),
            currency       = currency,
            notes          = e.get("notes") or None,
            created_at     = e.get("created_at", created_at),
        ))
    return Transaction(
        transaction_id = transaction_id,
        date           = date,
        description    = description,
        currency       = currency,
        total_amount   = total_debit,
        entries        = journal_entries,
        notes          = notes or None,
        created_at     = created_at,
    )


@router.post("", response_model=Transaction, status_code=201)
def create_transaction(body: TransactionCreate, db: OracleService = _DB):
    """새 거래를 생성하고 분개 항목을 저장한다."""
    transaction_id = str(uuid.uuid4())
    created_at     = datetime.now(timezone.utc).isoformat()

    created_entries = db.create_journal_entries(
        transaction_id = transaction_id,
        date           = body.date,
        description    = body.description,
        currency       = body.currency,
        lines          = [e.model_dump() for e in body.entries],
    )
    all_accounts  = db.get_all_accounts()
    accounts_map  = {a["account_id"]: a for a in all_accounts}

    return _build_transaction(
        transaction_id, created_entries, accounts_map,
        body.description, body.date, body.currency, body.notes or "", created_at,
    )


@router.get("", response_model=List[Transaction])
def list_transactions(
    start_date:  Optional[str] = Query(None, description="시작 날짜 YYYY-MM-DD"),
    end_date:    Optional[str] = Query(None, description="종료 날짜 YYYY-MM-DD"),
    account_id:  Optional[str] = Query(None, description="계정 ID 필터"),
    description: Optional[str] = Query(None, description="설명 검색"),
    limit:  int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: OracleService = _DB,
):
    """
    거래 목록을 반환한다.
    분개 항목을 transaction_id로 그룹핑해 Transaction 목록으로 구성한다.
    """
    all_entries  = db.get_all_journal_entries()
    all_accounts = db.get_all_accounts()
    accounts_map = {a["account_id"]: a for a in all_accounts}

    # transaction_id 기준 그룹핑
    txn_groups: dict = {}
    for e in all_entries:
        tid = e.get("transaction_id", "")
        if tid not in txn_groups:
            txn_groups[tid] = []
        txn_groups[tid].append(e)

    transactions = []
    for tid, entries in txn_groups.items():
        first      = entries[0]
        entry_date = first.get("date", "")
        desc       = first.get("description", "")
        curr       = first.get("currency", "KRW")
        notes      = first.get("notes", "")
        created_at = first.get("created_at", "")

        # 날짜 필터
        if start_date and entry_date < start_date:
            continue
        if end_date   and entry_date > end_date:
            continue
        # 계정 ID 필터
        if account_id and not any(e.get("account_id") == account_id for e in entries):
            continue
        # 설명 검색
        if description and description.lower() not in desc.lower():
            continue

        transactions.append(
            _build_transaction(tid, entries, accounts_map, desc, entry_date, curr, notes, created_at)
        )

    # 날짜 내림차순 정렬 후 페이지네이션
    transactions.sort(key=lambda t: t.date, reverse=True)
    return transactions[offset: offset + limit]


@router.get("/account/{account_id}", response_model=List[Transaction])
def get_account_ledger(account_id: str, db: OracleService = _DB):
    """특정 계정의 원장(Ledger)을 반환한다."""
    return list_transactions(account_id=account_id, db=db)


@router.get("/{transaction_id}", response_model=Transaction)
def get_transaction(transaction_id: str, db: OracleService = _DB):
    """단일 거래를 반환한다."""
    entries = db.get_entries_by_transaction(transaction_id)
    if not entries:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
    all_accounts = db.get_all_accounts()
    accounts_map = {a["account_id"]: a for a in all_accounts}
    first = entries[0]
    return _build_transaction(
        transaction_id, entries, accounts_map,
        first.get("description", ""),
        first.get("date", ""),
        first.get("currency", "KRW"),
        first.get("notes", ""),
        first.get("created_at", ""),
    )


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: str, db: OracleService = _DB):
    """거래와 모든 분개 항목을 삭제한다. 연동된 투자 거래도 함께 삭제한다."""
    # 연동 투자 거래 삭제 (포지션 수량·평균가 재계산 포함)
    for inv_txn in db.get_inv_txns_by_linked_transaction(transaction_id):
        inv_txn_id = inv_txn.get("inv_txn_id", "")
        if inv_txn_id:
            db.delete_investment_transaction(inv_txn_id)

    if db.delete_entries_by_transaction(transaction_id) == 0:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
