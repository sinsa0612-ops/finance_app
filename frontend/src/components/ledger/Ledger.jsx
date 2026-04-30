/**
 * components/ledger/Ledger.jsx
 * ─────────────────────────────
 * 복식부기 거래 원장 화면.
 * 거래 목록 조회, 필터링, 거래 추가/삭제 기능을 포함한다.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Table, Button, Space, Popconfirm, Tag, Drawer, Form,
  Input, DatePicker, Select, Alert, message, Row, Col, Card, Statistic,
} from "antd";
import { PlusOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { transactionApi, accountApi, investmentApi } from "../../api/client";
import { formatCurrency, ACCOUNT_TYPE_LABELS } from "../../utils/formatters";
import TransactionForm from "./TransactionForm";

const { RangePicker } = DatePicker;
const { Option } = Select;

export default function Ledger() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);   // 거래 추가 드로어
  const [detailDrawer, setDetailDrawer] = useState(null); // 거래 상세 드로어
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});

  // 데이터 로드
  const load_data = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txns, accs, pos] = await Promise.all([
        transactionApi.getAll(filters),
        accountApi.getAll(),
        investmentApi.getPositions(),
      ]);
      setTransactions(txns);
      setAccounts(accs);
      setPositions(pos);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load_data(); }, [load_data]);

  // 거래 삭제
  const handle_delete = async (transaction_id) => {
    try {
      await transactionApi.delete(transaction_id);
      message.success("거래가 삭제되었습니다.");
      load_data();
    } catch (e) {
      message.error(e.message);
    }
  };

  // 거래 생성 완료 콜백
  const handle_created = () => {
    setDrawerOpen(false);
    load_data();
  };

  // 필터 적용
  const handle_filter_change = (values) => {
    const { date_range, account_id, description } = values;
    setFilters({
      start_date: date_range?.[0]?.format("YYYY-MM-DD"),
      end_date: date_range?.[1]?.format("YYYY-MM-DD"),
      account_id,
      description,
    });
  };

  // 계정 이름 맵
  const account_map = Object.fromEntries(accounts.map((a) => [a.account_id, a]));

  // 컬럼 정의
  const columns = [
    {
      title: "날짜",
      dataIndex: "date",
      key: "date",
      width: 110,
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: "설명",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "분개 계정",
      dataIndex: "entries",
      key: "accounts",
      render: (entries) =>
        entries?.map((e) => {
          const acc = account_map[e.account_id];
          return (
            <Tag key={e.entry_id} color={acc?.account_type === "asset" ? "blue" : acc?.account_type === "expense" ? "red" : "green"}>
              {acc?.name || e.account_id}
            </Tag>
          );
        }),
    },
    {
      title: "금액",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right",
      width: 130,
      render: (v, record) => formatCurrency(v, record.currency),
    },
    {
      title: "통화",
      dataIndex: "currency",
      key: "currency",
      width: 70,
    },
    {
      title: "작업",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailDrawer(record)}
          />
          <Popconfirm
            title="이 거래를 삭제하시겠습니까?"
            onConfirm={() => handle_delete(record.transaction_id)}
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
    <div>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable />}

      {/* ── 필터 영역 ─────────────────────────────────────────────── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form layout="inline" onValuesChange={(_, vals) => handle_filter_change(vals)}>
          <Form.Item name="date_range" label="기간">
            <RangePicker format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="account_id" label="계정">
            <Select placeholder="전체" allowClear style={{ width: 160 }}>
              {accounts.map((a) => (
                <Option key={a.account_id} value={a.account_id}>
                  {a.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input placeholder="검색..." style={{ width: 140 }} />
          </Form.Item>
        </Form>
      </Card>

      {/* ── 거래 목록 테이블 ───────────────────────────────────────── */}
      <Card
        title={`거래 목록 (${transactions.length}건)`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            거래 추가
          </Button>
        }
      >
        <Table
          dataSource={transactions}
          columns={columns}
          rowKey="transaction_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="small"
          expandable={{
            expandedRowRender: (record) => (
              <Table
                dataSource={record.entries}
                rowKey="entry_id"
                pagination={false}
                size="small"
                columns={[
                  { title: "계정", dataIndex: "account_name", key: "account_name" },
                  { title: "유형", dataIndex: "account_type", key: "account_type", render: (v) => ACCOUNT_TYPE_LABELS[v] || v },
                  { title: "차변", dataIndex: "debit_amount", key: "debit_amount", align: "right", render: (v) => v > 0 ? formatCurrency(v, record.currency) : "-" },
                  { title: "대변", dataIndex: "credit_amount", key: "credit_amount", align: "right", render: (v) => v > 0 ? formatCurrency(v, record.currency) : "-" },
                ]}
              />
            ),
          }}
        />
      </Card>

      {/* ── 거래 추가 드로어 ───────────────────────────────────────── */}
      <Drawer
        title="새 거래 입력 (복식부기)"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        destroyOnClose
      >
        <TransactionForm accounts={accounts} positions={positions} on_success={handle_created} />
      </Drawer>
    </div>
  );
}
