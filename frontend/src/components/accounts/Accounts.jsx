/**
 * components/accounts/Accounts.jsx
 * ──────────────────────────────────
 * 계정과목표(Chart of Accounts) 관리 화면.
 * 계정 목록, 잔액, 추가/수정/삭제 기능을 제공한다.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Table, Button, Drawer, Tag, Space, Popconfirm, Alert, message, Card, Badge,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { accountApi } from "../../api/client";
import { formatCurrency, ACCOUNT_TYPE_LABELS } from "../../utils/formatters";
import AccountForm from "./AccountForm";

// 계정 유형별 태그 색상
const TYPE_COLORS = {
  asset: "blue",
  liability: "orange",
  equity: "purple",
  income: "green",
  expense: "red",
};

export default function Accounts() {
  const [accounts, set_accounts] = useState([]);
  const [balances, set_balances] = useState({});
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState(null);
  const [drawer_open, set_drawer_open] = useState(false);
  const [editing_account, set_editing_account] = useState(null);

  const load_accounts = useCallback(async () => {
    set_loading(true);
    set_error(null);
    try {
      const accs = await accountApi.getAll();
      set_accounts(accs);
      // 모든 계정 잔액 병렬 조회
      const balance_results = await Promise.allSettled(
        accs.map((a) => accountApi.getBalance(a.account_id))
      );
      const bal_map = {};
      balance_results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          bal_map[accs[i].account_id] = r.value;
        }
      });
      set_balances(bal_map);
    } catch (e) {
      set_error(e.message);
    } finally {
      set_loading(false);
    }
  }, []);

  useEffect(() => { load_accounts(); }, [load_accounts]);

  const handle_delete = async (account_id) => {
    try {
      await accountApi.delete(account_id);
      message.success("계정이 삭제되었습니다.");
      load_accounts();
    } catch (e) {
      message.error(e.message);
    }
  };

  const open_edit = (account) => {
    set_editing_account(account);
    set_drawer_open(true);
  };

  const open_create = () => {
    set_editing_account(null);
    set_drawer_open(true);
  };

  // 계정 이름 맵 (상위 계정명 표시용)
  const account_map = Object.fromEntries(accounts.map((a) => [a.account_id, a]));

  const columns = [
    {
      title: "코드",
      dataIndex: "account_code",
      key: "account_code",
      width: 80,
      sorter: (a, b) => a.account_code.localeCompare(b.account_code),
    },
    {
      title: "계정명",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "유형",
      dataIndex: "account_type",
      key: "account_type",
      width: 80,
      render: (v) => (
        <Tag color={TYPE_COLORS[v] || "default"}>{ACCOUNT_TYPE_LABELS[v] || v}</Tag>
      ),
      filters: Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => ({ text: v, value: k })),
      onFilter: (value, record) => record.account_type === value,
    },
    {
      title: "상위 계정",
      dataIndex: "parent_account_id",
      key: "parent_account_id",
      render: (id) => account_map[id]?.name || "-",
    },
    {
      title: "잔액",
      key: "balance",
      align: "right",
      width: 140,
      render: (_, record) => {
        const bal = balances[record.account_id];
        if (!bal) return <Badge status="processing" text="조회 중" />;
        const balance = bal.balance;
        const color = balance >= 0 ? "inherit" : "#ff4d4f";
        return (
          <span style={{ color }}>
            {formatCurrency(balance, record.currency)}
          </span>
        );
      },
    },
    {
      title: "통화",
      dataIndex: "currency",
      key: "currency",
      width: 60,
    },
    {
      title: "활성",
      dataIndex: "is_active",
      key: "is_active",
      width: 60,
      render: (v) => <Badge status={v ? "success" : "default"} text={v ? "활성" : "비활성"} />,
    },
    {
      title: "작업",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => open_edit(record)} />
          <Popconfirm
            title="이 계정을 삭제하시겠습니까? 관련 거래가 있으면 오류가 발생할 수 있습니다."
            onConfirm={() => handle_delete(record.account_id)}
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

      <Card
        title={`계정과목표 (${accounts.length}개)`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={open_create}>
            계정 추가
          </Button>
        }
      >
        <Table
          dataSource={accounts}
          columns={columns}
          rowKey="account_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="small"
        />
      </Card>

      <Drawer
        title={editing_account ? "계정 수정" : "계정 추가"}
        open={drawer_open}
        onClose={() => { set_drawer_open(false); set_editing_account(null); }}
        width={440}
        destroyOnClose
      >
        <AccountForm
          account={editing_account}
          accounts={accounts}
          on_success={() => { set_drawer_open(false); set_editing_account(null); load_accounts(); }}
        />
      </Drawer>
    </div>
  );
}
