/**
 * components/dashboard/Dashboard.jsx
 * ────────────────────────────────────
 * 메인 대시보드: 순자산, 계정 잔액, 포트폴리오 요약, 최근 거래를 보여준다.
 */

import React, { useEffect, useState } from "react";
import {
  Row, Col, Card, Statistic, Table, Spin, Alert, Tag,
} from "antd";
import {
  ArrowUpOutlined, ArrowDownOutlined, WalletOutlined,
  StockOutlined, BankOutlined,
} from "@ant-design/icons";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { reportApi, transactionApi, investmentApi } from "../../api/client";
import { formatCurrency, formatDate, formatPct, ACCOUNT_TYPE_LABELS } from "../../utils/formatters";

// 파이 차트 색상
const PIE_COLORS = ["#1677ff", "#52c41a", "#faad14", "#ff4d4f", "#722ed1"];

export default function Dashboard() {
  const [netWorthData, setNetWorthData] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [recentTxns, setRecentTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 병렬로 모든 데이터 로드
    Promise.all([
      reportApi.getNetWorth(),
      reportApi.getAccountSummary(),
      investmentApi.getPortfolioSummary(),
      transactionApi.getAll({ limit: 10 }),
    ])
      .then(([nw, summary, portfolio, txns]) => {
        setNetWorthData(nw);
        setAccountSummary(summary);
        setPortfolioSummary(portfolio);
        setRecentTxns(txns);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (error) return <Alert type="error" message={error} />;

  const currentNetWorth = netWorthData?.current_net_worth || 0;
  const trend = netWorthData?.trend || [];
  const assetAccounts = accountSummary?.asset || [];
  const liabilityAccounts = accountSummary?.liability || [];

  // 자산 파이차트 데이터
  const pieData = assetAccounts
    .filter((a) => Math.abs(a.balance) > 0)
    .map((a) => ({ name: a.name, value: Math.abs(a.balance) }));

  // 최근 거래 컬럼 정의
  const txn_columns = [
    { title: "날짜", dataIndex: "date", key: "date", width: 100 },
    { title: "설명", dataIndex: "description", key: "description" },
    {
      title: "금액",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right",
      render: (v) => formatCurrency(v, "KRW"),
    },
  ];

  return (
    <div>
      {/* ── 핵심 지표 카드 ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="순자산 (Net Worth)"
              value={currentNetWorth}
              precision={0}
              prefix={<WalletOutlined />}
              suffix="원"
              valueStyle={{ color: currentNetWorth >= 0 ? "#cf1322" : "#0050b3", fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="투자 포트폴리오 평가액"
              value={portfolioSummary?.total_value ?? "-"}
              precision={2}
              prefix={<StockOutlined />}
              suffix="USD"
              valueStyle={{ fontSize: 24 }}
            />
            {portfolioSummary?.total_unrealized_pnl !== undefined && (
              <div style={{ marginTop: 4, color: portfolioSummary.total_unrealized_pnl >= 0 ? "#cf1322" : "#0050b3" }}>
                {portfolioSummary.total_unrealized_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {" "}{formatPct(portfolioSummary.total_unrealized_pnl_pct)}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="총 자산"
              value={assetAccounts.reduce((s, a) => s + a.balance, 0)}
              precision={0}
              prefix={<BankOutlined />}
              suffix="원"
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── 순자산 트렌드 차트 ─────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card title="순자산 추이" bodyStyle={{ padding: "12px 0" }}>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 10000).toFixed(0) + "만"} />
                  <Tooltip formatter={(v) => formatCurrency(v, "KRW")} />
                  <Line type="monotone" dataKey="net_worth" stroke="#1677ff" strokeWidth={2} dot={false} name="순자산" />
                  <Line type="monotone" dataKey="assets" stroke="#52c41a" strokeWidth={1} dot={false} name="자산" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>데이터 없음</div>
            )}
          </Card>
        </Col>

        {/* 자산 구성 파이차트 */}
        <Col xs={24} lg={10}>
          <Card title="자산 구성" bodyStyle={{ padding: "12px 0" }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v) => formatCurrency(v, "KRW")} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>데이터 없음</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── 최근 거래 내역 ─────────────────────────────────────────── */}
      <Card title="최근 거래 10건">
        <Table
          dataSource={recentTxns}
          columns={txn_columns}
          rowKey="transaction_id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
