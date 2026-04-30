/**
 * components/investments/MarketTicker.jsx
 * ────────────────────────────────────────
 * 주요 지수 실시간 전광판.
 * 1분마다 자동 갱신, 호버 시 스크롤 일시정지.
 */

import React, { useEffect, useState } from "react";
import { priceApi } from "../../api/client";

const REFRESH_MS = 60_000;

const TICKER_CSS = `
@keyframes mkt-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.mkt-ticker-wrap:hover .mkt-ticker-inner {
  animation-play-state: paused;
}
`;

export default function MarketTicker() {
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    const load = () => priceApi.getMarkets().then(setMarkets).catch(() => {});
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (!markets.length) return null;

  const items = [...markets, ...markets]; // 무한 루프를 위해 복제

  return (
    <>
      <style>{TICKER_CSS}</style>
      <div
        className="mkt-ticker-wrap"
        style={{
          background: "#0d0d0d",
          overflow: "hidden",
          height: 38,
          borderRadius: 6,
          marginBottom: 16,
          userSelect: "none",
          border: "1px solid #1f1f1f",
        }}
      >
        <div
          className="mkt-ticker-inner"
          style={{
            display: "flex",
            width: "max-content",
            animation: "mkt-scroll 40s linear infinite",
          }}
        >
          {items.map((m, i) => (
            <TickerItem key={i} item={m} />
          ))}
        </div>
      </div>
    </>
  );
}

function TickerItem({ item }) {
  const pct = item.change_pct ?? 0;
  const up = pct >= 0;
  const color = item.error ? "#595959" : up ? "#ff4d4f" : "#1677ff";
  const arrow = up ? "▲" : "▼";

  const priceStr =
    item.price == null
      ? "—"
      : item.label === "달러/원" || item.label === "KOSPI" || item.label === "KOSDAQ"
      ? item.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
      : item.price.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <span
      style={{
        padding: "0 22px",
        borderRight: "1px solid #262626",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 13,
        height: 38,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "#595959", fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
        {item.label}
      </span>
      <span style={{ color: "#d9d9d9", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {priceStr}
      </span>
      {item.change_pct != null && !item.error && (
        <span style={{ color, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {arrow} {Math.abs(pct).toFixed(2)}%
        </span>
      )}
    </span>
  );
}
