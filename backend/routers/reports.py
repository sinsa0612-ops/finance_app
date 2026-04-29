"""
routers/reports.py
──────────────────
재무 보고서 REST API 엔드포인트.

GET /api/reports/balance-sheet       - 재무상태표 (자산·부채·자본)
GET /api/reports/income-statement    - 손익계산서 (수익·비용)
GET /api/reports/net-worth           - 순자산 트렌드
GET /api/reports/account-summary     - 전체 계정 잔액 요약
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional, Dict, List

from services.oracle_service import OracleService, get_oracle_service

router = APIRouter(prefix="/api/reports", tags=["reports"])

_DB = Depends(get_oracle_service)


def _compute_account_balances(db: OracleService) -> Dict[str, dict]:
    """
    모든 계정의 차변·대변 합계와 잔액을 계산한다.
    Returns: {account_id: {name, type, debit, credit, balance}}
    """
    all_accounts = db.get_all_accounts()
    all_entries  = db.get_all_journal_entries()

    balances: Dict[str, dict] = {}
    for acc in all_accounts:
        balances[acc["account_id"]] = {
            "account_id":   acc["account_id"],
            "account_code": acc.get("account_code", ""),
            "name":         acc.get("name", ""),
            "account_type": acc.get("account_type", ""),
            "currency":     acc.get("currency", "KRW"),
            "total_debit":  0.0,
            "total_credit": 0.0,
            "balance":      0.0,
        }

    for entry in all_entries:
        acc_id = entry.get("account_id", "")
        if acc_id in balances:
            balances[acc_id]["total_debit"]  += float(entry.get("debit_amount",  0))
            balances[acc_id]["total_credit"] += float(entry.get("credit_amount", 0))

    for data in balances.values():
        data["balance"] = data["total_debit"] - data["total_credit"]

    return balances


@router.get("/account-summary")
def get_account_summary(db: OracleService = _DB):
    """전체 계정의 잔액 요약을 계정 유형별로 그룹핑해 반환한다."""
    balances = _compute_account_balances(db)
    grouped: Dict[str, List] = {
        "asset": [], "liability": [], "equity": [], "income": [], "expense": []
    }
    for data in balances.values():
        acc_type = data["account_type"]
        if acc_type in grouped:
            grouped[acc_type].append(data)
    return grouped


@router.get("/balance-sheet")
def get_balance_sheet(
    as_of_date: Optional[str] = Query(None, description="기준일 YYYY-MM-DD (미입력 시 전체)"),
    db: OracleService = _DB,
):
    """
    재무상태표 (Balance Sheet) 반환.
    자산 = 부채 + 자본 등식이 성립해야 한다.
    """
    all_accounts = db.get_all_accounts()
    all_entries  = db.get_all_journal_entries()

    # 기준일 이전 항목만 집계
    if as_of_date:
        all_entries = [e for e in all_entries if e.get("date", "") <= as_of_date]

    accounts_map = {a["account_id"]: a for a in all_accounts}
    section_totals: Dict[str, Dict[str, float]] = {}

    for entry in all_entries:
        acc_id   = entry.get("account_id", "")
        acc      = accounts_map.get(acc_id, {})
        acc_type = acc.get("account_type", "unknown")
        acc_name = acc.get("name", acc_id)
        debit    = float(entry.get("debit_amount",  0))
        credit   = float(entry.get("credit_amount", 0))

        if acc_type not in section_totals:
            section_totals[acc_type] = {}
        if acc_name not in section_totals[acc_type]:
            section_totals[acc_type][acc_name] = 0.0

        # 자산·비용: 차변 증가 / 부채·자본·수익: 대변 증가
        if acc_type in ("asset", "expense"):
            section_totals[acc_type][acc_name] += debit - credit
        else:
            section_totals[acc_type][acc_name] += credit - debit

    total_assets      = sum(section_totals.get("asset",    {}).values())
    total_liabilities = sum(section_totals.get("liability",{}).values())
    total_equity      = sum(section_totals.get("equity",   {}).values())
    net_income        = (
        sum(section_totals.get("income",  {}).values())
        - sum(section_totals.get("expense",{}).values())
    )

    return {
        "as_of_date":  as_of_date or "전체",
        "assets":      section_totals.get("asset",     {}),
        "liabilities": section_totals.get("liability", {}),
        "equity":      section_totals.get("equity",    {}),
        "totals": {
            "total_assets":                  round(total_assets,      2),
            "total_liabilities":             round(total_liabilities, 2),
            "total_equity":                  round(total_equity,      2),
            "net_income":                    round(net_income,        2),
            "total_liabilities_and_equity":  round(total_liabilities + total_equity + net_income, 2),
        },
    }


@router.get("/income-statement")
def get_income_statement(
    start_date: Optional[str] = Query(None, description="시작 날짜 YYYY-MM-DD"),
    end_date:   Optional[str] = Query(None, description="종료 날짜 YYYY-MM-DD"),
    db: OracleService = _DB,
):
    """
    손익계산서 (Income Statement) 반환.
    당기순이익 = 수익 합계 - 비용 합계
    """
    all_accounts = db.get_all_accounts()
    all_entries  = db.get_all_journal_entries()

    # 날짜 필터
    if start_date:
        all_entries = [e for e in all_entries if e.get("date", "") >= start_date]
    if end_date:
        all_entries = [e for e in all_entries if e.get("date", "") <= end_date]

    accounts_map   = {a["account_id"]: a for a in all_accounts}
    income_items:  Dict[str, float] = {}
    expense_items: Dict[str, float] = {}

    for entry in all_entries:
        acc_id   = entry.get("account_id", "")
        acc      = accounts_map.get(acc_id, {})
        acc_type = acc.get("account_type", "")
        acc_name = acc.get("name", acc_id)
        debit    = float(entry.get("debit_amount",  0))
        credit   = float(entry.get("credit_amount", 0))

        if acc_type == "income":
            income_items[acc_name]  = income_items.get(acc_name, 0)  + (credit - debit)
        elif acc_type == "expense":
            expense_items[acc_name] = expense_items.get(acc_name, 0) + (debit - credit)

    total_income  = sum(income_items.values())
    total_expense = sum(expense_items.values())

    return {
        "period": {"start": start_date or "전체", "end": end_date or "전체"},
        "income":   income_items,
        "expenses": expense_items,
        "totals": {
            "total_income":   round(total_income,  2),
            "total_expenses": round(total_expense, 2),
            "net_income":     round(total_income - total_expense, 2),
        },
    }


@router.get("/net-worth")
def get_net_worth(db: OracleService = _DB):
    """
    순자산(Net Worth) = 총 자산 - 총 부채 를 반환한다.
    월별 누적 트렌드 데이터도 함께 제공한다.
    """
    all_accounts = db.get_all_accounts()
    all_entries  = db.get_all_journal_entries()
    accounts_map = {a["account_id"]: a for a in all_accounts}

    # 월별 증분 집계 (YYYY-MM 키)
    monthly: Dict[str, Dict[str, float]] = {}
    for entry in all_entries:
        date = entry.get("date", "")
        if len(date) < 7:
            continue
        month_key = date[:7]
        acc_id    = entry.get("account_id", "")
        acc       = accounts_map.get(acc_id, {})
        acc_type  = acc.get("account_type", "")
        debit     = float(entry.get("debit_amount",  0))
        credit    = float(entry.get("credit_amount", 0))

        if month_key not in monthly:
            monthly[month_key] = {"assets": 0.0, "liabilities": 0.0}

        if acc_type == "asset":
            monthly[month_key]["assets"]      += debit - credit
        elif acc_type == "liability":
            monthly[month_key]["liabilities"] += credit - debit

    # 누적 계산
    trend        = []
    cum_assets      = 0.0
    cum_liabilities = 0.0
    for month in sorted(monthly.keys()):
        cum_assets      += monthly[month]["assets"]
        cum_liabilities += monthly[month]["liabilities"]
        trend.append({
            "month":       month,
            "assets":      round(cum_assets,       2),
            "liabilities": round(cum_liabilities,  2),
            "net_worth":   round(cum_assets - cum_liabilities, 2),
        })

    current_net_worth = trend[-1]["net_worth"] if trend else 0.0
    return {"current_net_worth": current_net_worth, "trend": trend}
