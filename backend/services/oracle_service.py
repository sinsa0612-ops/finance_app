"""
services/oracle_service.py
──────────────────────────
Oracle Cloud Database 서비스 레이어.

Google Sheets 서비스와 동일한 공개 인터페이스를 유지하므로
라우터 코드 변경이 최소화된다.

접속 방식
  ① Wallet (ADB): Oracle Cloud Console에서 지갑 다운로드 → wallet/ 폴더에 압축 해제
                   python-oracledb Thin 모드에서 wallet_location 지정
  ② 직접 TCP   : oracle_wallet_location 이 비어 있으면 host:port/service 로 접속

커넥션 풀
  - oracledb.create_pool()로 생성하고 앱 시작 시 set_pool()로 주입한다.
  - 각 메서드는 pool.acquire() 컨텍스트 매니저로 연결을 체크아웃/반납한다.

DDL
  - init_tables()를 앱 시작 시 호출하면 존재하지 않는 테이블만 생성한다.
  - ORA-00955(이미 존재) 오류는 무시한다.
"""

import uuid
import oracledb
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from config import settings


# ─── DDL ─────────────────────────────────────────────────────────────────────

# 계정과목표
_DDL_ACCOUNTS = """
CREATE TABLE accounts (
    account_id          VARCHAR2(36)   PRIMARY KEY,
    account_code        VARCHAR2(20)   NOT NULL,
    name                VARCHAR2(100)  NOT NULL,
    account_type        VARCHAR2(20)   NOT NULL
        CONSTRAINT chk_acc_type CHECK (account_type IN
            ('asset','liability','equity','income','expense')),
    parent_account_id   VARCHAR2(36),
    currency            VARCHAR2(10)   DEFAULT 'KRW' NOT NULL,
    is_active           NUMBER(1)      DEFAULT 1 NOT NULL
        CONSTRAINT chk_is_active CHECK (is_active IN (0, 1)),
    notes               VARCHAR2(1000),
    created_at          VARCHAR2(35)
)
"""

# 복식부기 분개 항목 (거래 1건 = 2개 이상의 분개)
_DDL_JOURNAL_ENTRIES = """
CREATE TABLE journal_entries (
    entry_id            VARCHAR2(36)   PRIMARY KEY,
    transaction_id      VARCHAR2(36)   NOT NULL,
    entry_date          VARCHAR2(10)   NOT NULL,
    description         VARCHAR2(500)  NOT NULL,
    account_id          VARCHAR2(36)   NOT NULL,
    debit_amount        NUMBER(22, 8)  DEFAULT 0 NOT NULL,
    credit_amount       NUMBER(22, 8)  DEFAULT 0 NOT NULL,
    currency            VARCHAR2(10)   DEFAULT 'KRW' NOT NULL,
    notes               VARCHAR2(1000),
    created_at          VARCHAR2(35)
)
"""

# 투자 포지션 (현재 보유 종목)
_DDL_INVESTMENT_POSITIONS = """
CREATE TABLE investment_positions (
    position_id         VARCHAR2(36)   PRIMARY KEY,
    account_id          VARCHAR2(36)   NOT NULL,
    ticker              VARCHAR2(30)   NOT NULL,
    asset_type          VARCHAR2(20)   NOT NULL,
    exchange            VARCHAR2(50),
    quantity            NUMBER(30, 8)  DEFAULT 0 NOT NULL,
    avg_cost_price      NUMBER(30, 8)  DEFAULT 0 NOT NULL,
    total_cost          NUMBER(30, 8)  DEFAULT 0 NOT NULL,
    currency            VARCHAR2(10)   DEFAULT 'USD' NOT NULL,
    notes               VARCHAR2(1000),
    updated_at          VARCHAR2(35),
    CONSTRAINT uq_pos_account_ticker UNIQUE (account_id, ticker)
)
"""

# 투자 거래 이력 (매수·매도·배당 등)
_DDL_INVESTMENT_TRANSACTIONS = """
CREATE TABLE investment_transactions (
    inv_txn_id              VARCHAR2(36)   PRIMARY KEY,
    position_id             VARCHAR2(36)   NOT NULL,
    ticker                  VARCHAR2(30)   NOT NULL,
    txn_date                VARCHAR2(10)   NOT NULL,
    action                  VARCHAR2(20)   NOT NULL
        CONSTRAINT chk_inv_action CHECK (action IN
            ('buy','sell','dividend','split','transfer')),
    quantity                NUMBER(30, 8)  NOT NULL,
    price                   NUMBER(30, 8)  NOT NULL,
    amount                  NUMBER(30, 8)  NOT NULL,
    fee                     NUMBER(30, 8)  DEFAULT 0 NOT NULL,
    currency                VARCHAR2(10)   DEFAULT 'USD' NOT NULL,
    linked_transaction_id   VARCHAR2(36),
    notes                   VARCHAR2(1000),
    created_at              VARCHAR2(35)
)
"""

# 생성 순서에 주의 (FK 의존 없음이지만 논리적 순서 유지)
_ALL_DDL = [
    ("accounts",               _DDL_ACCOUNTS),
    ("journal_entries",        _DDL_JOURNAL_ENTRIES),
    ("investment_positions",   _DDL_INVESTMENT_POSITIONS),
    ("investment_transactions", _DDL_INVESTMENT_TRANSACTIONS),
]


def init_tables(pool: oracledb.ConnectionPool) -> None:
    """
    앱 시작 시 필요한 테이블을 생성한다.
    ORA-00955(이미 존재) 오류는 정상 케이스로 무시한다.
    """
    with pool.acquire() as conn:
        with conn.cursor() as cur:
            for table_name, ddl in _ALL_DDL:
                try:
                    cur.execute(ddl)
                    conn.commit()
                    print(f"[DB] 테이블 생성: {table_name}")
                except oracledb.DatabaseError as e:
                    (error,) = e.args
                    if error.code == 955:
                        # ORA-00955: 이미 존재하는 테이블 — 정상
                        pass
                    else:
                        # 다른 오류는 재발생
                        raise


# ─── 인덱스 DDL (선택적 성능 향상) ──────────────────────────────────────────

_INDEXES = [
    "CREATE INDEX idx_je_txn_id  ON journal_entries (transaction_id)",
    "CREATE INDEX idx_je_acc_id  ON journal_entries (account_id)",
    "CREATE INDEX idx_je_date    ON journal_entries (entry_date)",
    "CREATE INDEX idx_it_pos_id  ON investment_transactions (position_id)",
    "CREATE INDEX idx_it_date    ON investment_transactions (txn_date)",
]


def init_indexes(pool: oracledb.ConnectionPool) -> None:
    """성능 인덱스를 생성한다. ORA-01408(이미 존재) 무시."""
    with pool.acquire() as conn:
        with conn.cursor() as cur:
            for idx_sql in _INDEXES:
                try:
                    cur.execute(idx_sql)
                    conn.commit()
                except oracledb.DatabaseError as e:
                    (error,) = e.args
                    if error.code not in (955, 1408):
                        raise


# ─── 모듈 수준 싱글턴 ────────────────────────────────────────────────────────

_pool_instance: Optional[oracledb.ConnectionPool] = None
_service_instance: Optional["OracleService"] = None


def create_pool() -> oracledb.ConnectionPool:
    """
    설정 값을 읽어 Oracle 커넥션 풀을 생성한다.
    - Wallet 경로가 설정되어 있으면 mTLS(Autonomous DB) 접속
    - 비어 있으면 일반 TCP 접속
    """
    params = dict(
        user=settings.oracle_user,
        password=settings.oracle_password,
        dsn=settings.oracle_dsn,
        min=settings.oracle_pool_min,
        max=settings.oracle_pool_max,
        increment=settings.oracle_pool_increment,
    )
    # Wallet 경로가 있을 때만 wallet 옵션 추가
    # config_dir: tnsnames.ora / sqlnet.ora 위치 (wallet 폴더와 동일)
    if settings.oracle_wallet_location:
        params["wallet_location"] = settings.oracle_wallet_location
        params["config_dir"] = settings.oracle_wallet_location
        if settings.oracle_wallet_password:
            params["wallet_password"] = settings.oracle_wallet_password

    return oracledb.create_pool(**params)


def set_pool(pool: oracledb.ConnectionPool) -> None:
    """앱 startup 시 커넥션 풀을 서비스에 주입한다."""
    global _pool_instance, _service_instance
    _pool_instance = pool
    _service_instance = OracleService(pool)


def get_oracle_service() -> "OracleService":
    """FastAPI Depends에서 사용할 OracleService 싱글턴을 반환한다."""
    if _service_instance is None:
        raise RuntimeError("Oracle 풀이 초기화되지 않았습니다. main.py lifespan을 확인하세요.")
    return _service_instance


# ─── 서비스 클래스 ────────────────────────────────────────────────────────────

class OracleService:
    """
    Oracle DB CRUD 서비스.
    SheetsService와 동일한 공개 메서드 시그니처를 유지한다.
    """

    def __init__(self, pool: oracledb.ConnectionPool) -> None:
        self._pool = pool

    # ── 내부 유틸리티 ─────────────────────────────────────────────────────────

    @staticmethod
    def _rows_to_dicts(cursor) -> List[Dict]:
        """커서 결과 전체를 소문자 컬럼명 딕셔너리 목록으로 변환한다."""
        if cursor.description is None:
            return []
        cols = [col[0].lower() for col in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]

    @staticmethod
    def _row_to_dict(cursor, row) -> Optional[Dict]:
        """단일 행을 소문자 컬럼명 딕셔너리로 변환한다."""
        if row is None:
            return None
        cols = [col[0].lower() for col in cursor.description]
        return dict(zip(cols, row))

    @staticmethod
    def _new_id() -> str:
        """UUID4 기반 고유 ID를 생성한다."""
        return str(uuid.uuid4())

    @staticmethod
    def _now_iso() -> str:
        """현재 UTC 시각을 ISO 8601 문자열로 반환한다."""
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _to_bool(val: Any) -> bool:
        """Oracle NUMBER(1) → Python bool 변환."""
        return bool(int(val)) if val is not None else True

    def _normalize_account(self, row: Dict) -> Dict:
        """is_active 필드를 bool로 변환하고 None 문자열을 처리한다."""
        if not row:
            return row
        row["is_active"] = self._to_bool(row.get("is_active", 1))
        # Oracle NULL은 None으로 오지만 혹시 빈 문자열인 경우 처리
        for key in ("parent_account_id", "notes"):
            if row.get(key) == "":
                row[key] = None
        return row

    # ── 계정(Accounts) ────────────────────────────────────────────────────────

    def get_all_accounts(self) -> List[Dict]:
        """모든 계정을 계정 코드 순으로 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM accounts ORDER BY account_code"
                )
                rows = self._rows_to_dicts(cur)
        return [self._normalize_account(r) for r in rows]

    def get_account_by_id(self, account_id: str) -> Optional[Dict]:
        """account_id로 단일 계정을 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM accounts WHERE account_id = :1",
                    [account_id],
                )
                row = self._row_to_dict(cur, cur.fetchone())
        return self._normalize_account(row) if row else None

    def create_account(self, data: Dict) -> Dict:
        """새 계정을 추가하고 생성된 딕셔너리를 반환한다."""
        record = {
            "account_id":        self._new_id(),
            "account_code":      data["account_code"],
            "name":              data["name"],
            "account_type":      data["account_type"],
            "parent_account_id": data.get("parent_account_id") or None,
            "currency":          data.get("currency", "KRW"),
            "is_active":         1,
            "notes":             data.get("notes") or None,
            "created_at":        self._now_iso(),
        }
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO accounts
                        (account_id, account_code, name, account_type,
                         parent_account_id, currency, is_active, notes, created_at)
                    VALUES
                        (:account_id, :account_code, :name, :account_type,
                         :parent_account_id, :currency, :is_active, :notes, :created_at)
                """, record)
            conn.commit()
        # 응답에는 bool로 변환해서 반환
        record["is_active"] = True
        return record

    def update_account(self, account_id: str, updates: Dict) -> Optional[Dict]:
        """지정한 필드만 업데이트한다. 해당 행이 없으면 None 반환."""
        if not updates:
            return self.get_account_by_id(account_id)
        # bool → NUMBER(1) 변환
        if "is_active" in updates:
            updates["is_active"] = 1 if updates["is_active"] else 0
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["_account_id"] = account_id
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE accounts SET {set_clause} WHERE account_id = :_account_id",
                    updates,
                )
                if cur.rowcount == 0:
                    return None
            conn.commit()
        return self.get_account_by_id(account_id)

    def delete_account(self, account_id: str) -> bool:
        """계정을 삭제하고 성공 여부를 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM accounts WHERE account_id = :1",
                    [account_id],
                )
                deleted = cur.rowcount > 0
            if deleted:
                conn.commit()
        return deleted

    # ── 분개(Journal Entries) ─────────────────────────────────────────────────

    def get_all_journal_entries(self) -> List[Dict]:
        """모든 분개 항목을 날짜 내림차순으로 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT entry_id,
                           transaction_id,
                           entry_date   AS "date",
                           description,
                           account_id,
                           debit_amount,
                           credit_amount,
                           currency,
                           notes,
                           created_at
                    FROM   journal_entries
                    ORDER  BY entry_date DESC, created_at DESC
                """)
                return self._rows_to_dicts(cur)

    def get_entries_by_transaction(self, transaction_id: str) -> List[Dict]:
        """특정 transaction_id에 속한 분개 항목을 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT entry_id,
                           transaction_id,
                           entry_date   AS "date",
                           description,
                           account_id,
                           debit_amount,
                           credit_amount,
                           currency,
                           notes,
                           created_at
                    FROM   journal_entries
                    WHERE  transaction_id = :1
                    ORDER  BY created_at
                """, [transaction_id])
                return self._rows_to_dicts(cur)

    def create_journal_entries(
        self,
        transaction_id: str,
        date: str,
        description: str,
        currency: str,
        lines: List[Dict],
    ) -> List[Dict]:
        """
        복수의 분개 라인을 executemany로 배치 삽입한다.
        API 호출(DB 왕복) 횟수를 1회로 최소화한다.
        """
        batch_data = []
        created = []
        now = self._now_iso()

        for line in lines:
            record = {
                "entry_id":       self._new_id(),
                "transaction_id": transaction_id,
                "entry_date":     date,
                "description":    description,
                "account_id":     line["account_id"],
                "debit_amount":   float(line.get("debit_amount", 0)),
                "credit_amount":  float(line.get("credit_amount", 0)),
                "currency":       currency,
                "notes":          line.get("notes") or None,
                "created_at":     now,
            }
            batch_data.append(record)
            # 라우터 응답 형식에 맞게 entry_date → date 키로 노출
            created.append({**record, "date": record["entry_date"]})

        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.executemany("""
                    INSERT INTO journal_entries
                        (entry_id, transaction_id, entry_date, description,
                         account_id, debit_amount, credit_amount,
                         currency, notes, created_at)
                    VALUES
                        (:entry_id, :transaction_id, :entry_date, :description,
                         :account_id, :debit_amount, :credit_amount,
                         :currency, :notes, :created_at)
                """, batch_data)
            conn.commit()

        return created

    def delete_entries_by_transaction(self, transaction_id: str) -> int:
        """transaction_id에 속한 분개 전체를 삭제하고 삭제 건수를 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM journal_entries WHERE transaction_id = :1",
                    [transaction_id],
                )
                deleted = cur.rowcount
            if deleted > 0:
                conn.commit()
        return deleted

    # ── 투자 포지션(Investment Positions) ────────────────────────────────────

    def get_all_positions(self) -> List[Dict]:
        """모든 투자 포지션을 티커 오름차순으로 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM investment_positions ORDER BY ticker"
                )
                return self._rows_to_dicts(cur)

    def get_position_by_id(self, position_id: str) -> Optional[Dict]:
        """position_id로 단일 포지션을 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM investment_positions WHERE position_id = :1",
                    [position_id],
                )
                return self._row_to_dict(cur, cur.fetchone())

    def get_position_by_ticker(self, ticker: str, account_id: str) -> Optional[Dict]:
        """동일 계정 내 특정 티커 포지션을 반환한다 (UNIQUE 제약 기반)."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT * FROM investment_positions
                    WHERE  ticker = :1 AND account_id = :2
                """, [ticker.upper(), account_id])
                return self._row_to_dict(cur, cur.fetchone())

    def create_position(self, data: Dict) -> Dict:
        """새 투자 포지션을 추가한다."""
        quantity  = float(data["quantity"])
        avg_price = float(data["avg_cost_price"])
        record = {
            "position_id":    self._new_id(),
            "account_id":     data["account_id"],
            "ticker":         data["ticker"].upper(),
            "asset_type":     data["asset_type"],
            "exchange":       data.get("exchange") or None,
            "quantity":       quantity,
            "avg_cost_price": avg_price,
            "total_cost":     round(quantity * avg_price, 8),
            "currency":       data.get("currency", "USD"),
            "notes":          data.get("notes") or None,
            "updated_at":     self._now_iso(),
        }
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO investment_positions
                        (position_id, account_id, ticker, asset_type, exchange,
                         quantity, avg_cost_price, total_cost,
                         currency, notes, updated_at)
                    VALUES
                        (:position_id, :account_id, :ticker, :asset_type, :exchange,
                         :quantity, :avg_cost_price, :total_cost,
                         :currency, :notes, :updated_at)
                """, record)
            conn.commit()
        return record

    def update_position(self, position_id: str, updates: Dict) -> Optional[Dict]:
        """포지션 수량·평균가·메모 등을 부분 업데이트한다."""
        updates["updated_at"] = self._now_iso()

        # quantity 또는 avg_cost_price 변경 시 total_cost 자동 재계산
        if "quantity" in updates or "avg_cost_price" in updates:
            pos = self.get_position_by_id(position_id)
            if pos:
                qty = float(updates.get("quantity", pos["quantity"]))
                avg = float(updates.get("avg_cost_price", pos["avg_cost_price"]))
                updates["total_cost"] = round(qty * avg, 8)

        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["_position_id"] = position_id

        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE investment_positions SET {set_clause} WHERE position_id = :_position_id",
                    updates,
                )
                if cur.rowcount == 0:
                    return None
            conn.commit()
        return self.get_position_by_id(position_id)

    def delete_position(self, position_id: str) -> bool:
        """포지션을 삭제하고 성공 여부를 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM investment_positions WHERE position_id = :1",
                    [position_id],
                )
                deleted = cur.rowcount > 0
            if deleted:
                conn.commit()
        return deleted

    # ── 투자 거래(Investment Transactions) ──────────────────────────────────

    def get_all_investment_transactions(self) -> List[Dict]:
        """모든 투자 거래 이력을 날짜 내림차순으로 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT inv_txn_id,
                           position_id,
                           ticker,
                           txn_date          AS "date",
                           action,
                           quantity,
                           price,
                           amount,
                           fee,
                           currency,
                           linked_transaction_id,
                           notes,
                           created_at
                    FROM   investment_transactions
                    ORDER  BY txn_date DESC, created_at DESC
                """)
                return self._rows_to_dicts(cur)

    def get_inv_txns_by_position(self, position_id: str) -> List[Dict]:
        """특정 포지션의 거래 이력을 날짜 오름차순으로 반환한다."""
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT inv_txn_id,
                           position_id,
                           ticker,
                           txn_date          AS "date",
                           action,
                           quantity,
                           price,
                           amount,
                           fee,
                           currency,
                           linked_transaction_id,
                           notes,
                           created_at
                    FROM   investment_transactions
                    WHERE  position_id = :1
                    ORDER  BY txn_date, created_at
                """, [position_id])
                return self._rows_to_dicts(cur)

    def create_investment_transaction(self, data: Dict) -> Dict:
        """
        투자 거래를 기록하고 포지션의 수량·평균가를 가중평균법으로 재계산한다.
        """
        position = self.get_position_by_id(data["position_id"])
        ticker   = position["ticker"] if position else ""
        quantity = float(data["quantity"])
        price    = float(data["price"])
        fee      = float(data.get("fee", 0))
        amount   = round(quantity * price, 8)

        record = {
            "inv_txn_id":             self._new_id(),
            "position_id":            data["position_id"],
            "ticker":                 ticker,
            "txn_date":               data["date"],
            "action":                 data["action"],
            "quantity":               quantity,
            "price":                  price,
            "amount":                 amount,
            "fee":                    fee,
            "currency":               data.get("currency", "USD"),
            "linked_transaction_id":  data.get("linked_transaction_id") or None,
            "notes":                  data.get("notes") or None,
            "created_at":             self._now_iso(),
        }

        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO investment_transactions
                        (inv_txn_id, position_id, ticker, txn_date, action,
                         quantity, price, amount, fee, currency,
                         linked_transaction_id, notes, created_at)
                    VALUES
                        (:inv_txn_id, :position_id, :ticker, :txn_date, :action,
                         :quantity, :price, :amount, :fee, :currency,
                         :linked_transaction_id, :notes, :created_at)
                """, record)
            conn.commit()

        # 포지션 평균가·수량 재계산 (DB 집계 쿼리 사용)
        if position:
            self._recalculate_position(data["position_id"])

        # 라우터가 기대하는 date 키로 변환
        record["date"] = record.pop("txn_date")
        return record

    def _recalculate_position(self, position_id: str) -> None:
        """
        가중평균법(WAC)으로 포지션 수량·평균매입가를 재계산한다.
        SQL 집계로 Python 루프 없이 단 1회 DB 왕복으로 처리한다.

        알고리즘:
          총_매수_원가 = Σ(매수 수량 × 단가 + 수수료)
          매도_원가_비율 = 총_매도_수량 / 총_매수_수량
          잔여_원가 = 총_매수_원가 × (1 - 매도_원가_비율)
          평균가 = 잔여_원가 / 잔여_수량
        """
        with self._pool.acquire() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        SUM(CASE WHEN action = 'buy'  THEN quantity         ELSE 0 END) AS buy_qty,
                        SUM(CASE WHEN action = 'buy'  THEN quantity * price + fee
                                 ELSE 0 END)                                             AS buy_cost,
                        SUM(CASE WHEN action = 'sell' THEN quantity         ELSE 0 END) AS sell_qty
                    FROM investment_transactions
                    WHERE position_id = :1
                """, [position_id])
                row = cur.fetchone()

        if not row:
            return

        buy_qty  = float(row[0] or 0)
        buy_cost = float(row[1] or 0)
        sell_qty = float(row[2] or 0)
        net_qty  = buy_qty - sell_qty

        if net_qty <= 0:
            avg_price = 0.0
            net_qty   = 0.0
        else:
            # 매도 비율만큼 원가 차감
            sell_ratio     = (sell_qty / buy_qty) if buy_qty > 0 else 0
            remaining_cost = buy_cost * (1 - sell_ratio)
            avg_price      = remaining_cost / net_qty if net_qty > 0 else 0

        self.update_position(position_id, {
            "quantity":       round(net_qty, 8),
            "avg_cost_price": round(avg_price, 8),
        })
