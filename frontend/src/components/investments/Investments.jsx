/**
 * components/investments/Investments.jsx
 * ─────────────────────────────────────────
 * 투자 자산 관리 메인 화면.
 * 포트폴리오 요약 → 포지션 목록(실시간 시세) → 거래 이력 탭으로 구성.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Tabs, Card, Statistic, Row, Col, Button, Drawer, message,
  Popconfirm, Alert, Spin, Tag, Space, Table,
} from "antd";
import { PlusOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { investmentApi, accountApi } from "../../api/client";
import {
  formatCurrency, formatNumber, formatPct, ASSET_TYPE_LABELS,
} from "../../utils/formatters";
import PortfolioTable from "./PortfolioTable";
import InvestmentForm from "./InvestmentForm";
import MarketTicker from "./MarketTicker";

export default function Investments() {
  const [positions, set_positions] = useState([]);
  const [all_txns, set_all_txns] = useState([]);
  const [summary, set_summary] = useState(null);
  const [accounts, set_accounts] = useState([]);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState(null);
  const [drawer_mode, set_drawer_mode] = useState(null); // 'position' | 'transaction' | null
  const [selected_position, set_selected_position] = useState(null);

  const load_data = useCallback(async () => {
    set_loading(true);
    set_error(null);
    const [pos, txns, smry, accs] = await Promise.allSettled([
      investmentApi.getPositions(),
      investmentApi.getAllTransactions(),
      investmentApi.getPortfolioSummary(),
      accountApi.getAll(),
    ]);
    if (pos.status === "fulfilled") set_positions(pos.value);
    if (txns.status === "fulfilled") set_all_txns(txns.value);
    if (smry.status === "fulfilled") set_summary(smry.value);
    if (accs.status === "fulfilled")
      set_accounts(accs.value.filter((a) => a.account_type === "asset"));

    const errs = [pos, txns, smry, accs]
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason?.message || "알 수 없는 오류");
    if (errs.length) set_error(errs.join(" | "));

    set_loading(false);
  }, []);

  useEffect(() => { load_data(); }, [load_data]);

  // 포지션 삭제
  const handle_delete_position = async (position_id) => {
    try {
      await investmentApi.deletePosition(position_id);
      message.success("포지션이 삭제되었습니다.");
      load_data();
    } catch (e) {
      message.error(e.message);
    }
  };

  // 매수/매도 폼 열기
  const open_transaction_form = (position) => {
    set_selected_position(position);
    set_drawer_mode("transaction");
  };

  if (loading && positions.length === 0 && !error) {
    return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  }

  const pnl_color = (summary?.total_unrealized_pnl || 0) >= 0 ? "#cf1322" : "#0050b3";

  return (
    <div>
      {/* ── 시장 지수 전광판 ─────────────────────────────────────────── */}
      <MarketTicker />

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable />}

      {/* ── 포트폴리오 요약 카드 ────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="총 투자금" value={summary?.total_cost ?? 0} precision={2} suffix="USD" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="평가금액" value={summary?.total_value ?? 0} precision={2} suffix="USD" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="미실현 손익"
              value={Math.abs(summary?.total_unrealized_pnl ?? 0)}
              precision={2}
              suffix="USD"
              prefix={(summary?.total_unrealized_pnl ?? 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: pnl_color }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="수익률"
              value={Math.abs(summary?.total_unrealized_pnl_pct ?? 0)}
              precision={2}
              suffix="%"
              prefix={(summary?.total_unrealized_pnl_pct ?? 0) >= 0 ? "+" : "-"}
              valueStyle={{ color: pnl_color }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── 탭: 포지션 / 거래 이력 ────────────────────────────────── */}
      <Tabs
        defaultActiveKey="positions"
        tabBarExtraContent={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load_data} loading={loading}>새로고침</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => set_drawer_mode("position")}>
              포지션 추가
            </Button>
          </Space>
        }
        items={[
          {
            key: "positions",
            label: `포지션 (${positions.length})`,
            children: (
              <PortfolioTable
                positions={positions}
                on_delete={handle_delete_position}
                on_trade={open_transaction_form}
              />
            ),
          },
          {
            key: "transactions",
            label: `거래 이력 (${all_txns.length})`,
            children: <TxnHistoryTable txns={all_txns} />,
          },
        ]}
      />

      {/* ── 포지션 추가 드로어 ────────────────────────────────────── */}
      <Drawer
        title="포지션 추가"
        open={drawer_mode === "position"}
        onClose={() => set_drawer_mode(null)}
        width={480}
        destroyOnClose
      >
        <InvestmentForm
          mode="position"
          accounts={accounts}
          on_success={() => { set_drawer_mode(null); load_data(); }}
        />
      </Drawer>

      {/* ── 매수/매도 드로어 ─────────────────────────────────────── */}
      <Drawer
        title={`거래 입력: ${selected_position?.ticker || ""}`}
        open={drawer_mode === "transaction"}
        onClose={() => { set_drawer_mode(null); set_selected_position(null); }}
        width={480}
        destroyOnClose
      >
        <InvestmentForm
          mode="transaction"
          position={selected_position}
          on_success={() => { set_drawer_mode(null); set_selected_position(null); load_data(); }}
        />
      </Drawer>
    </div>
  );
}

// 거래 이력 테이블 (내부 컴포넌트)
function TxnHistoryTable({ txns }) {
  const columns = [
    { title: "날짜", dataIndex: "date", key: "date", width: 100, sorter: (a, b) => a.date.localeCompare(b.date) },
    { title: "종목", dataIndex: "ticker", key: "ticker" },
    {
      title: "유형",
      dataIndex: "action",
      key: "action",
      render: (v) => (
        <Tag color={v === "buy" ? "green" : v === "sell" ? "red" : "blue"}>
          {v === "buy" ? "매수" : v === "sell" ? "매도" : v === "dividend" ? "배당" : v}
        </Tag>
      ),
    },
    { title: "수량", dataIndex: "quantity", key: "quantity", align: "right", render: (v) => formatNumber(v, 6) },
    { title: "단가", dataIndex: "price", key: "price", align: "right", render: (v, r) => formatCurrency(v, r.currency, 4) },
    { title: "금액", dataIndex: "amount", key: "amount", align: "right", render: (v, r) => formatCurrency(v, r.currency, 2) },
    { title: "수수료", dataIndex: "fee", key: "fee", align: "right", render: (v, r) => v ? formatCurrency(v, r.currency, 2) : "-" },
  ];

  return (
    <Table
      dataSource={txns}
      columns={columns}
      rowKey="inv_txn_id"
      pagination={{ pageSize: 20, showSizeChanger: true }}
      size="small"
    />
  );
}

