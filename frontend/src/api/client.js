/**
 * api/client.js
 * ─────────────
 * Axios 인스턴스 및 공통 API 호출 함수.
 * 모든 컴포넌트는 이 모듈을 통해 백엔드와 통신한다.
 */

import axios from "axios";

// Axios 기본 설정
const api = axios.create({
  baseURL: "/api",        // vite proxy를 통해 FastAPI로 전달
  timeout: 15000,         // 15초 타임아웃
  headers: { "Content-Type": "application/json" },
});

// ─── 응답 인터셉터: 오류 메시지 정규화 ─────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(", ")   // Pydantic 검증 오류 배열 처리
      : detail || error.message || "알 수 없는 오류";
    return Promise.reject(new Error(message));
  }
);

// ─── 계정 API ────────────────────────────────────────────────────────────────
export const accountApi = {
  getAll: () => api.get("/accounts").then((r) => r.data),
  getById: (id) => api.get(`/accounts/${id}`).then((r) => r.data),
  create: (data) => api.post("/accounts", data).then((r) => r.data),
  update: (id, data) => api.put(`/accounts/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/accounts/${id}`),
  getBalance: (id) => api.get(`/accounts/${id}/balance`).then((r) => r.data),
};

// ─── 거래(분개) API ───────────────────────────────────────────────────────────
export const transactionApi = {
  getAll: (params) => api.get("/transactions", { params }).then((r) => r.data),
  getById: (id) => api.get(`/transactions/${id}`).then((r) => r.data),
  create: (data) => api.post("/transactions", data).then((r) => r.data),
  delete: (id) => api.delete(`/transactions/${id}`),
  getByAccount: (accountId) =>
    api.get(`/transactions/account/${accountId}`).then((r) => r.data),
};

// ─── 투자 API ────────────────────────────────────────────────────────────────
export const investmentApi = {
  // 포지션
  getPositions: () => api.get("/investments/positions").then((r) => r.data),
  getPosition: (id) => api.get(`/investments/positions/${id}`).then((r) => r.data),
  createPosition: (data) => api.post("/investments/positions", data).then((r) => r.data),
  updatePosition: (id, data) => api.put(`/investments/positions/${id}`, data).then((r) => r.data),
  deletePosition: (id) => api.delete(`/investments/positions/${id}`),
  getPositionTxns: (id) =>
    api.get(`/investments/positions/${id}/txns`).then((r) => r.data),
  // 투자 거래
  createTransaction: (data) =>
    api.post("/investments/transactions", data).then((r) => r.data),
  getAllTransactions: () =>
    api.get("/investments/transactions").then((r) => r.data),
  // 포트폴리오 요약
  getPortfolioSummary: () =>
    api.get("/investments/portfolio/summary").then((r) => r.data),
};

// ─── 시세 API ────────────────────────────────────────────────────────────────
export const priceApi = {
  getPrice: (ticker, assetType = "stock") =>
    api.get(`/prices/${ticker}`, { params: { asset_type: assetType } }).then((r) => r.data),
  getBatchPrices: (tickers, assetType = "stock") =>
    api
      .post("/prices/batch", tickers, { params: { asset_type: assetType } })
      .then((r) => r.data),
  getStatus: () => api.get("/prices/status").then((r) => r.data),
};

// ─── 보고서 API ───────────────────────────────────────────────────────────────
export const reportApi = {
  getBalanceSheet: (asOfDate) =>
    api.get("/reports/balance-sheet", { params: { as_of_date: asOfDate } }).then((r) => r.data),
  getIncomeStatement: (params) =>
    api.get("/reports/income-statement", { params }).then((r) => r.data),
  getNetWorth: () => api.get("/reports/net-worth").then((r) => r.data),
  getAccountSummary: () => api.get("/reports/account-summary").then((r) => r.data),
};

export default api;
