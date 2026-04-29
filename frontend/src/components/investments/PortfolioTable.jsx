/**
 * components/investments/PortfolioTable.jsx
 * ──────────────────────────────────────────
 * 포지션 목록 테이블 (실시간 평가 데이터 포함).
 * 가격 출처(캐시/실시간), 미실현 손익을 컬러로 표시한다.
 */

import React from "react";
import { Table, Button, Space, Popconfirm, Tag, Tooltip, Badge } from "antd";
import { DeleteOutlined, SwapOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { formatCurrency, formatNumber, formatPct, ASSET_TYPE_LABELS } from "../../utils/formatters";

export default function PortfolioTable({ positions, on_delete, on_trade }) {
  const columns = [
    {
      title: "종목",
      dataIndex: "ticker",
      key: "ticker",
      fixed: "left",
      width: 120,
      render: (ticker, record) => (
        <div>
          <strong>{ticker}</strong>
          <div>
            <Tag style={{ fontSize: 10 }}>{ASSET_TYPE_LABELS[record.asset_type] || record.asset_type}</Tag>
            {record.exchange && <Tag color="default" style={{ fontSize: 10 }}>{record.exchange}</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: "보유 수량",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 110,
      render: (v) => formatNumber(v, 4),
    },
    {
      title: "평균 매입가",
      dataIndex: "avg_cost_price",
      key: "avg_cost_price",
      align: "right",
      width: 120,
      render: (v, r) => formatCurrency(v, r.currency, 4),
    },
    {
      title: "총 투자금",
      dataIndex: "total_cost",
      key: "total_cost",
      align: "right",
      width: 130,
      render: (v, r) => formatCurrency(v, r.currency, 2),
    },
    {
      title: (
        <span>
          현재가{" "}
          <Tooltip title="실시간 시세 (yfinance → CoinGecko → Alpha Vantage 순 폴백)">
            <InfoCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: "current_price",
      key: "current_price",
      align: "right",
      width: 130,
      render: (v, r) => {
        if (v === null || v === undefined) {
          return <span style={{ color: "#999" }}>-</span>;
        }
        // 캐시 여부 표시
        const badge_status = r.price_source === "cache" ? "warning" : "success";
        return (
          <Tooltip title={`출처: ${r.price_source || "알 수 없음"} | ${r.price_updated_at?.slice(0, 16) || ""}`}>
            <span>
              <Badge status={badge_status} />
              {formatCurrency(v, r.currency, 4)}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: "평가금액",
      dataIndex: "current_value",
      key: "current_value",
      align: "right",
      width: 130,
      render: (v, r) => v != null ? formatCurrency(v, r.currency, 2) : "-",
    },
    {
      title: "미실현 손익",
      key: "pnl",
      align: "right",
      width: 160,
      render: (_, r) => {
        if (r.unrealized_pnl === null || r.unrealized_pnl === undefined) return "-";
        const is_profit = r.unrealized_pnl >= 0;
        const color = is_profit ? "#cf1322" : "#0050b3"; // 한국 증권 관행
        return (
          <div>
            <div style={{ color, fontWeight: "bold" }}>
              {is_profit ? "+" : ""}{formatCurrency(r.unrealized_pnl, r.currency, 2)}
            </div>
            <div style={{ color, fontSize: 12 }}>
              {is_profit ? "+" : ""}{formatPct(r.unrealized_pnl_pct)}
            </div>
          </div>
        );
      },
      sorter: (a, b) => (a.unrealized_pnl_pct || 0) - (b.unrealized_pnl_pct || 0),
    },
    {
      title: "가격 오류",
      dataIndex: "price_error",
      key: "price_error",
      width: 80,
      render: (err) => err ? (
        <Tooltip title={err}>
          <Tag color="error" style={{ fontSize: 10 }}>오류</Tag>
        </Tooltip>
      ) : null,
    },
    {
      title: "작업",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<SwapOutlined />}
            onClick={() => on_trade?.(record)}
            title="매수/매도"
          />
          <Popconfirm
            title={`${record.ticker} 포지션을 삭제하시겠습니까?`}
            onConfirm={() => on_delete?.(record.position_id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      dataSource={positions}
      columns={columns}
      rowKey="position_id"
      scroll={{ x: 1100 }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      size="small"
      rowClassName={(r) => {
        if (!r.unrealized_pnl_pct) return "";
        return r.unrealized_pnl_pct >= 5 ? "profit-row" : r.unrealized_pnl_pct <= -5 ? "loss-row" : "";
      }}
    />
  );
}
