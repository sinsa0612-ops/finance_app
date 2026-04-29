# 개인 자산관리 가계부 (복식부기 기반)

Python FastAPI + React + **Oracle Cloud Database**로 구현된 **All-in-One 개인 재무 관리 플랫폼**.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **복식부기 원장** | 차변·대변 균형 검증, 분개 입력, 거래 내역 관리 |
| **실시간 투자 자산** | 주식·ETF·암호화폐 실시간 시세 (yfinance → CoinGecko → Alpha Vantage 폴백) |
| **포트폴리오 평가** | 평균매입가·수량 자동 관리, 미실현 손익 실시간 계산 |
| **재무 보고서** | 재무상태표, 손익계산서, 순자산 추이 차트 |
| **Oracle Cloud DB** | Oracle Autonomous Database (Always Free) — 커넥션 풀·인덱스 최적화 |

## 기술 스택

- **Backend**: Python FastAPI + python-oracledb + yfinance
- **Frontend**: React 18 + Ant Design 5 + Recharts
- **Database**: Oracle Cloud Autonomous Database (oracledb Thin 모드)
- **실시간 시세**: yfinance (1차) → CoinGecko (암호화폐 2차) → Alpha Vantage (주식 2차)

---

## 설치 및 실행

### 1. Oracle Cloud Database 설정

#### 1-1. Oracle Cloud 계정 및 Autonomous Database 생성
1. [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) 가입 (Always Free 제공)
2. **Oracle Database → Autonomous Transaction Processing (ATP)** 생성
   - Database name: 원하는 이름 (예: `FINANCEDB`)
   - Workload type: Transaction Processing
   - Admin 비밀번호 설정 (대·소문자 + 숫자 + 특수문자 포함)

#### 1-2. Wallet 다운로드 (mTLS 인증서)
1. ADB 상세 페이지 → **DB 연결** → **지갑 다운로드**
2. 지갑 비밀번호 설정 후 `wallet_*.zip` 다운로드
3. `backend/wallet/` 폴더 생성 후 zip 파일 **압축 해제**
   ```
   backend/
   └── wallet/
       ├── cwallet.sso
       ├── ewallet.p12
       ├── ewallet.pem
       ├── keystore.jks
       ├── ojdbc.properties
       ├── sqlnet.ora
       ├── tnsnames.ora    ← DSN 별칭 확인
       └── truststore.jks
   ```
4. `tnsnames.ora` 파일에서 사용할 서비스 별칭 확인  
   (예: `financedb_medium`, `financedb_high`, `financedb_low`)

#### 1-3. `.env` 파일 설정 (Oracle 연결 정보)
```env
ORACLE_USER=admin
ORACLE_PASSWORD=YourAdminPassword123!
ORACLE_DSN=financedb_medium          # tnsnames.ora 별칭
ORACLE_WALLET_LOCATION=./wallet      # wallet 폴더 경로
ORACLE_WALLET_PASSWORD=              # 지갑 비밀번호 (설정한 경우)
```

> **직접 TCP 접속** (온프레미스 Oracle DB):  
> `ORACLE_DSN=hostname:1521/SERVICE_NAME` 로 설정하고 `ORACLE_WALLET_LOCATION` 비워두기

---

### 2. Backend 설정

```bash
cd backend

# 가상환경 생성 및 활성화 (Windows)
python -m venv venv
venv\Scripts\activate

# 또는 Mac/Linux
python -m venv venv
source venv/bin/activate

# 패키지 설치 (oracledb 포함 — Oracle Instant Client 불필요)
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일에서 ORACLE_USER / ORACLE_PASSWORD / ORACLE_DSN 등 입력

# 서버 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API 문서: http://localhost:8000/docs

---

### 3. Frontend 설정

```bash
cd frontend

# Node.js 18+ 필요
npm install

# 개발 서버 실행
npm run dev
```

브라우저: http://localhost:5173

---

## Oracle Database 테이블 구조

앱 최초 실행 시 `init_tables()`가 자동으로 4개 테이블을 생성한다.  
이미 존재하는 테이블은 건너뛴다 (ORA-00955 무시).

| 테이블명 | 설명 |
|----------|------|
| `accounts` | 계정과목표 (자산·부채·자본·수익·비용) |
| `journal_entries` | 복식부기 분개 항목 |
| `investment_positions` | 투자 포지션 (보유 종목), `(account_id, ticker)` UNIQUE 제약 |
| `investment_transactions` | 매수·매도·배당 거래 이력 |

자동 생성 인덱스: `transaction_id`, `account_id`, `entry_date`, `position_id`, `txn_date`

### Oracle Cloud Always Free 티어 한도
- 스토리지: 20 GB
- OCPU: 1 공유
- RAM: 1 GB
- 개인 가계부 용도로는 충분한 용량

---

## 실시간 시세 제공자

```
주식/ETF:  yfinance → Alpha Vantage (무료 5 req/min) → 캐시
암호화폐:  yfinance → CoinGecko (무료 10 req/min) → 캐시
```

- **캐시 TTL**: 정상 5분, 오류 시 15분 연장
- **레이트 리밋**: 각 제공자별 슬라이딩 윈도우 방식 보호
- **차단 대비**: 모든 제공자 실패 시 마지막 성공 가격(stale cache) 반환

### Alpha Vantage API 키 발급 (선택)
무료 키: https://www.alphavantage.co/support/#api-key  
`.env`에 `ALPHA_VANTAGE_API_KEY=발급받은키` 설정

---

## 복식부기 기본 원칙

| 계정 유형 | 차변 증가 | 대변 증가 |
|-----------|-----------|-----------|
| 자산 (Asset) | ✅ | |
| 비용 (Expense) | ✅ | |
| 부채 (Liability) | | ✅ |
| 자본 (Equity) | | ✅ |
| 수익 (Income) | | ✅ |

**모든 거래: 차변 합계 = 대변 합계**

### 입력 예시

**식비 30,000원 (현금 지출)**
| 계정 | 차변 | 대변 |
|------|------|------|
| 식비 (비용) | 30,000 | |
| 현금 (자산) | | 30,000 |

**주식 매수 AAPL 10주 × $150**
| 계정 | 차변 | 대변 |
|------|------|------|
| 주식투자자산 (자산) | $1,500 | |
| 증권계좌 (자산) | | $1,500 |

---

## 프로젝트 구조

```
finance-app/
├── backend/
│   ├── main.py                 # FastAPI 진입점
│   ├── config.py               # 환경 변수 설정
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/                 # Pydantic 모델
│   │   ├── account.py
│   │   ├── transaction.py
│   │   ├── investment.py
│   │   └── price.py
│   ├── services/               # 비즈니스 로직
│   │   ├── sheets_service.py   # Google Sheets CRUD
│   │   ├── price_service.py    # 실시간 시세 (멀티 폴백)
│   │   └── investment_service.py
│   └── routers/                # API 엔드포인트
│       ├── accounts.py
│       ├── transactions.py
│       ├── investments.py
│       ├── prices.py
│       └── reports.py
└── frontend/
    ├── vite.config.js
    ├── src/
    │   ├── App.jsx
    │   ├── api/client.js       # Axios 인스턴스 + API 함수
    │   ├── utils/formatters.js # 통화·숫자 포맷
    │   └── components/
    │       ├── layout/         # 앱 레이아웃
    │       ├── dashboard/      # 대시보드
    │       ├── ledger/         # 거래 원장 + 분개 폼
    │       ├── investments/    # 포트폴리오 + 매수매도
    │       ├── accounts/       # 계정과목 관리
    │       └── reports/        # 재무 보고서
```

---

## API 엔드포인트 요약

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/accounts` | 계정 목록 |
| POST | `/api/accounts` | 계정 생성 |
| GET | `/api/accounts/{id}/balance` | 계정 잔액 |
| POST | `/api/transactions` | 거래 생성 (분개) |
| GET | `/api/transactions` | 거래 목록 (필터 가능) |
| GET | `/api/investments/positions` | 포지션 목록 (실시간 시세) |
| POST | `/api/investments/transactions` | 매수/매도 기록 |
| GET | `/api/prices/{ticker}` | 단일 종목 시세 |
| GET | `/api/reports/balance-sheet` | 재무상태표 |
| GET | `/api/reports/income-statement` | 손익계산서 |
| GET | `/api/reports/net-worth` | 순자산 추이 |
