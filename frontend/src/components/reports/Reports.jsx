/**
 * components/reports/Reports.jsx
 * ────────────────────────────────
 * 재무 보고서 화면.
 * 재무상태표 / 손익계산서 / 순자산 트렌드를 탭으로 제공한다.
 */

import React, { useEffect, useState } from "react";
import {
  Tabs, Card, Table, Statistic, Row, Col, DatePicker, Button,
  Alert, Spin, Divider, Typography,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import dayjs from "dayjs";
import { reportApi } from "../../api/client";
import { formatCurrency } from "../../utils/formatters";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Reports() {
  return (
    <Tabs
      defaultActiveKey="balance_sheet"
      items={[
        { key: "balance_sheet", label: "재무상태표", children: <BalanceSheetTab /> },
        { key: "income", label: "손익계산서", children: <IncomeTab /> },
        { key: "net_worth", label: "순자산 추이", children: <NetWorthTab /> },
      ]}
    />
  );
}

// ── 재무상태표 탭 ───────────────────────────────────────────────────────────
function BalanceSheetTab() {
  const [data, set_data] = useState(null);
  const [as_of, set_as_of] = useState(null);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState(null);

  const load = async () => {
    set_loading(true);
    set_error(null);
    try {
      const result = await reportApi.getBalanceSheet(as_of);
      set_data(result);
    } catch (e) {
      set_error(e.message);
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => { load(); }, [as_of]);

  if (loading) return <Spin />;
  if (error) return <Alert type="error" message={error} />;
  if (!data) return null;

  const { totals, assets, liabilities, equity } = data;

  // 섹션을 테이블 행으로 변환
  const to_rows = (obj) =>
    Object.entries(obj || {}).map(([name, value]) => ({ name, value }));

  const section_columns = [
    { title: "계정명", dataIndex: "name", key: "name" },
    {
      title: "금액",
      dataIndex: "value",
      key: "value",
      align: "right",
      render: (v) => formatCurrency(v, "KRW"),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <DatePicker
          placeholder="기준일 (미선택 시 전체)"
          onChange={(d) => set_as_of(d?.format("YYYY-MM-DD") || null)}
          format="YYYY-MM-DD"
        />
        <Text type="secondary">기준일: {data.as_of_date}</Text>
      </div>

      {/* 합산 요약 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="총 자산" value={totals.total_assets} precision={0} suffix="원" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="총 부채" value={totals.total_liabilities} precision={0} suffix="원" valueStyle={{ color: "#ff4d4f" }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="자본" value={totals.total_equity} precision={0} suffix="원" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="당기순이익" value={totals.net_income} precision={0} suffix="원"
              valueStyle={{ color: totals.net_income >= 0 ? "#cf1322" : "#0050b3" }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="자산 (Assets)" size="small">
            <Table dataSource={to_rows(assets)} columns={section_columns}
              rowKey="name" pagination={false} size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell><strong>합계</strong></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><strong>{formatCurrency(totals.total_assets, "KRW")}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="부채 + 자본 (Liabilities & Equity)" size="small">
            <Divider orientation="left" plain style={{ fontSize: 12 }}>부채</Divider>
            <Table dataSource={to_rows(liabilities)} columns={section_columns}
              rowKey="name" pagination={false} size="small" />
            <Divider orientation="left" plain style={{ fontSize: 12 }}>자본</Divider>
            <Table dataSource={to_rows(equity)} columns={section_columns}
              rowKey="name" pagination={false} size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell><strong>합계</strong></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><strong>{formatCurrency(totals.total_liabilities_and_equity, "KRW")}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ── 손익계산서 탭 ───────────────────────────────────────────────────────────
function IncomeTab() {
  const [data, set_data] = useState(null);
  const [date_range, set_date_range] = useState([dayjs().startOf("month"), dayjs()]);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState(null);

  const load = async () => {
    set_loading(true);
    set_error(null);
    try {
      const result = await reportApi.getIncomeStatement({
        start_date: date_range?.[0]?.format("YYYY-MM-DD"),
        end_date: date_range?.[1]?.format("YYYY-MM-DD"),
      });
      set_data(result);
    } catch (e) {
      set_error(e.message);
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => { load(); }, [date_range]);

  if (error) return <Alert type="error" message={error} />;
  if (!data) return <Spin />;

  const { totals, income, expenses } = data;
  const to_rows = (obj) => Object.entries(obj || {}).map(([name, value]) => ({ name, value }));
  const cols = [
    { title: "계정명", dataIndex: "name", key: "name" },
    { title: "금액", dataIndex: "value", key: "value", align: "right", render: (v) => formatCurrency(v, "KRW") },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <RangePicker
          value={date_range}
          onChange={(dates) => set_date_range(dates)}
          format="YYYY-MM-DD"
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="총 수익" value={totals.total_income} precision={0} suffix="원" valueStyle={{ color: "#cf1322" }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="총 비용" value={totals.total_expenses} precision={0} suffix="원" valueStyle={{ color: "#0050b3" }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="당기순이익" value={totals.net_income} precision={0} suffix="원"
              valueStyle={{ color: totals.net_income >= 0 ? "#cf1322" : "#0050b3", fontWeight: "bold" }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="수익 항목" size="small">
            <Table dataSource={to_rows(income)} columns={cols} rowKey="name" pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="비용 항목" size="small">
            <Table dataSource={to_rows(expenses)} columns={cols} rowKey="name" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ── 순자산 추이 탭 ──────────────────────────────────────────────────────────
function NetWorthTab() {
  const [data, set_data] = useState(null);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);

  useEffect(() => {
    reportApi.getNetWorth()
      .then(set_data)
      .catch((e) => set_error(e.message))
      .finally(() => set_loading(false));
  }, []);

  if (loading) return <Spin />;
  if (error) return <Alert type="error" message={error} />;
  if (!data) return null;

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16, display: "inline-block" }}>
        <Statistic
          title="현재 순자산"
          value={data.current_net_worth}
          precision={0}
          suffix="원"
          valueStyle={{ fontSize: 28, fontWeight: "bold" }}
        />
      </Card>

      {/* 순자산 바 차트 */}
      <Card title="월별 순자산 / 자산 / 부채 추이">
        {data.trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 10000).toFixed(0) + "만"} />
              <Tooltip formatter={(v) => formatCurrency(v, "KRW")} />
              <Legend />
              <Bar dataKey="assets" name="총 자산" fill="#1677ff" />
              <Bar dataKey="liabilities" name="총 부채" fill="#ff4d4f" />
              <Bar dataKey="net_worth" name="순자산" fill="#52c41a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: "center", padding: 60, color: "#999" }}>데이터가 없습니다. 거래를 입력해 보세요.</div>
        )}
      </Card>
    </div>
  );
}
