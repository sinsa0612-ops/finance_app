/**
 * utils/formatters.js
 * ───────────────────
 * 숫자·날짜·통화 포맷 유틸리티 함수 모음.
 */

/**
 * 숫자를 통화 형식으로 포맷한다.
 * @param {number|null} value - 금액
 * @param {string} currency - 통화 코드 (KRW, USD 등)
 * @param {number} decimals - 소수점 자릿수
 */
export function formatCurrency(value, currency = "KRW", decimals = 0) {
  if (value === null || value === undefined) return "-";
  const locale = currency === "KRW" ? "ko-KR" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * 숫자를 천 단위 구분자 형식으로 포맷한다.
 * @param {number|null} value
 * @param {number} decimals
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * 손익을 색상 클래스와 함께 반환한다.
 * @param {number|null} value - 손익 금액
 * @returns {{ text: string, color: string }}
 */
export function formatPnl(value, currency = "USD") {
  if (value === null || value === undefined) return { text: "-", color: "#999" };
  const sign = value >= 0 ? "+" : "";
  const text = sign + formatCurrency(value, currency, 2);
  const color = value > 0 ? "#cf1322" : value < 0 ? "#0050b3" : "#666"; // 한국 관행: 빨강=상승, 파랑=하락
  return { text, color };
}

/**
 * 퍼센트 손익을 포맷한다.
 */
export function formatPct(value) {
  if (value === null || value === undefined) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * ISO 날짜 문자열을 한국 형식으로 포맷한다.
 * @param {string} isoString
 */
export function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 계정 유형을 한국어로 반환한다.
 */
export const ACCOUNT_TYPE_LABELS = {
  asset: "자산",
  liability: "부채",
  equity: "자본",
  income: "수익",
  expense: "비용",
};

export const ASSET_TYPE_LABELS = {
  stock: "주식",
  crypto: "암호화폐",
  etf: "ETF",
  fund: "펀드",
  bond: "채권",
  other: "기타",
};

export const ACTION_LABELS = {
  buy: "매수",
  sell: "매도",
  dividend: "배당",
  split: "주식분할",
  transfer: "이전",
};
