"""
config.py
─────────
전역 환경 변수 및 설정 값을 관리하는 모듈.
애플리케이션 전반에서 settings 객체를 임포트해 사용한다.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# config.py 위치를 기준으로 경로를 절대 경로로 변환하는 헬퍼
_BASE_DIR = Path(__file__).parent.resolve()


def _abs(path: str) -> str:
    """상대 경로를 backend/ 기준 절대 경로로 변환한다."""
    if not path:
        return path
    p = Path(path)
    return str(p if p.is_absolute() else _BASE_DIR / p)


class Settings:
    """환경 변수를 읽어 타입-세이프하게 제공하는 설정 클래스."""

    # ── Oracle Database ────────────────────────────────────────────────────
    oracle_user: str = os.getenv("ORACLE_USER", "admin")
    oracle_password: str = os.getenv("ORACLE_PASSWORD", "")
    oracle_dsn: str = os.getenv("ORACLE_DSN", "")

    # Wallet 기반 (Oracle Cloud ADB): 경로가 빈 문자열이면 직접 TCP 접속으로 처리
    oracle_wallet_location: str = _abs(os.getenv("ORACLE_WALLET_LOCATION", ""))
    oracle_wallet_password: str = os.getenv("ORACLE_WALLET_PASSWORD", "")

    # 커넥션 풀 크기
    oracle_pool_min: int = int(os.getenv("ORACLE_POOL_MIN", "2"))
    oracle_pool_max: int = int(os.getenv("ORACLE_POOL_MAX", "10"))
    oracle_pool_increment: int = int(os.getenv("ORACLE_POOL_INCREMENT", "1"))

    # ── 대체 API 키 ───────────────────────────────────────────────────────
    alpha_vantage_api_key: str = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")

    # ── 서버 설정 ─────────────────────────────────────────────────────────
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "True").lower() == "true"
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # ── 가격 캐시 TTL (초) ────────────────────────────────────────────────
    price_cache_ttl: int = 300           # 정상 캐시: 5분
    price_cache_fallback_ttl: int = 900  # 오류 시 연장: 15분

    # ── 레이트 리밋 설정 ──────────────────────────────────────────────────
    yfinance_max_per_hour: int = 100
    coingecko_max_per_minute: int = 10
    alpha_vantage_max_per_minute: int = 5


# 싱글턴 인스턴스
settings = Settings()
