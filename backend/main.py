"""
main.py
───────
FastAPI 애플리케이션 진입점.

변경 이력:
  - DB를 Google Sheets → Oracle Cloud Database로 교체
  - lifespan 컨텍스트 매니저로 Oracle 커넥션 풀 관리
  - 앱 시작 시 테이블·인덱스 자동 생성 (init_tables / init_indexes)

실행:
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from services.oracle_service import (
    create_pool,
    set_pool,
    init_tables,
    init_indexes,
)
from routers import accounts, transactions, investments, prices, reports


# ─── 앱 생명 주기 ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    startup: Oracle 커넥션 풀 생성 → 테이블 초기화 → 인덱스 생성
    shutdown: 커넥션 풀 닫기
    """
    # 커넥션 풀 생성
    pool = create_pool()
    # 풀을 서비스 싱글턴에 주입
    set_pool(pool)
    # 테이블이 없으면 자동 생성 (이미 있으면 무시)
    init_tables(pool)
    # 성능 인덱스 생성 (이미 있으면 무시)
    init_indexes(pool)

    print(f"[DB] Oracle 커넥션 풀 준비 완료 (DSN: {settings.oracle_dsn})")
    yield  # 앱 실행 구간

    # 종료 시 풀 반납
    pool.close()
    print("[DB] Oracle 커넥션 풀 닫힘")


# ─── FastAPI 앱 생성 ───────────────────────────────────────────────────────────
app = FastAPI(
    title="개인 복식부기 가계부 API",
    description=(
        "복식부기 기반 개인 자산관리 API. "
        "주식·암호화폐 실시간 시세 조회, 복식부기 분개, 재무보고서 제공. "
        "DB: Oracle Cloud Autonomous Database."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS 미들웨어 ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 라우터 등록 ───────────────────────────────────────────────────────────────
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(investments.router)
app.include_router(prices.router)
app.include_router(reports.router)


# ─── 헬스체크 ──────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health_check():
    """서버 상태를 확인한다."""
    return {"status": "ok", "version": "2.0.0", "db": "oracle"}


@app.get("/", tags=["health"])
def root():
    """루트 엔드포인트."""
    return {
        "message": "개인 복식부기 가계부 API (Oracle Cloud DB)",
        "docs":    "/docs",
        "redoc":   "/redoc",
    }
