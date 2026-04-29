/**
 * components/ledger/TransactionForm.jsx
 * ──────────────────────────────────────
 * 복식부기 거래 입력 폼.
 *
 * 사용자는 날짜·설명을 입력하고, 복수의 분개 라인(계정, 차변, 대변)을 추가한다.
 * 차변 합계 ≠ 대변 합계이면 서버가 400을 반환하고 에러를 표시한다.
 */

import React, { useState } from "react";
import {
  Form, Input, DatePicker, Select, Button, Space, InputNumber,
  Table, Alert, message, Divider, Row, Col, Tag,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { transactionApi } from "../../api/client";
import { ACCOUNT_TYPE_LABELS, formatCurrency } from "../../utils/formatters";

const { Option } = Select;

// 계정 유형별 기본 분개 방향 힌트
const TYPE_DEBIT_HINT = {
  asset: "차변 (자산 증가)",
  expense: "차변 (비용 발생)",
  liability: "대변 (부채 증가)",
  equity: "대변 (자본 증가)",
  income: "대변 (수익 발생)",
};

export default function TransactionForm({ accounts, on_success }) {
  const [form] = Form.useForm();
  const [entries, set_entries] = useState([
    { key: 0, account_id: "", debit_amount: 0, credit_amount: 0, notes: "" },
    { key: 1, account_id: "", debit_amount: 0, credit_amount: 0, notes: "" },
  ]);
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState(null);

  // 총 차변·대변 계산
  const total_debit = entries.reduce((s, e) => s + (e.debit_amount || 0), 0);
  const total_credit = entries.reduce((s, e) => s + (e.credit_amount || 0), 0);
  const is_balanced = Math.abs(total_debit - total_credit) < 0.01;

  // 분개 라인 추가
  const add_entry = () => {
    set_entries((prev) => [
      ...prev,
      { key: Date.now(), account_id: "", debit_amount: 0, credit_amount: 0, notes: "" },
    ]);
  };

  // 분개 라인 삭제 (최소 2줄 유지)
  const remove_entry = (key) => {
    if (entries.length <= 2) {
      message.warning("최소 2개의 분개 항목이 필요합니다.");
      return;
    }
    set_entries((prev) => prev.filter((e) => e.key !== key));
  };

  // 분개 라인 값 변경
  const update_entry = (key, field, value) => {
    set_entries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e))
    );
  };

  // 폼 제출
  const handle_submit = async () => {
    try {
      const values = await form.validateFields();
      if (!is_balanced) {
        set_error(`차변 합계(${total_debit})와 대변 합계(${total_credit})가 일치하지 않습니다.`);
        return;
      }
      set_submitting(true);
      set_error(null);

      await transactionApi.create({
        date: values.date.format("YYYY-MM-DD"),
        description: values.description,
        currency: values.currency,
        notes: values.notes,
        entries: entries.map(({ account_id, debit_amount, credit_amount, notes: n }) => ({
          account_id,
          debit_amount: debit_amount || 0,
          credit_amount: credit_amount || 0,
          notes: n,
        })),
      });

      message.success("거래가 저장되었습니다.");
      on_success?.();
    } catch (e) {
      set_error(e.message);
    } finally {
      set_submitting(false);
    }
  };

  // 계정 선택 시 힌트 표시용 계정 맵
  const account_map = Object.fromEntries(accounts.map((a) => [a.account_id, a]));

  return (
    <div>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => set_error(null)} />}

      {/* ── 거래 헤더 정보 ───────────────────────────────────────── */}
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item name="date" label="거래 날짜" rules={[{ required: true }]} initialValue={dayjs()}>
              <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="currency" label="통화" initialValue="KRW">
              <Select>
                <Option value="KRW">KRW (원)</Option>
                <Option value="USD">USD (달러)</Option>
                <Option value="JPY">JPY (엔)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="거래 설명" rules={[{ required: true, message: "설명을 입력하세요." }]}>
          <Input placeholder="예: 마트 식비 결제" />
        </Form.Item>
        <Form.Item name="notes" label="비고">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>

      <Divider>분개 항목</Divider>

      {/* ── 분개 라인 입력 ─────────────────────────────────────────── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["계정", "계정유형", "차변 금액", "대변 금액", "비고", ""].map((h) => (
                <th key={h} style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const acc = account_map[entry.account_id];
              return (
                <tr key={entry.key}>
                  {/* 계정 선택 */}
                  <td style={{ padding: "4px 8px", minWidth: 180 }}>
                    <Select
                      value={entry.account_id || undefined}
                      onChange={(v) => update_entry(entry.key, "account_id", v)}
                      placeholder="계정 선택"
                      style={{ width: "100%" }}
                      showSearch
                      filterOption={(input, opt) =>
                        opt.children?.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {accounts.map((a) => (
                        <Option key={a.account_id} value={a.account_id}>
                          [{a.account_code}] {a.name}
                        </Option>
                      ))}
                    </Select>
                  </td>
                  {/* 계정 유형 태그 */}
                  <td style={{ padding: "4px 8px", width: 90 }}>
                    {acc ? (
                      <Tag color={acc.account_type === "asset" ? "blue" : acc.account_type === "expense" ? "red" : "green"}>
                        {ACCOUNT_TYPE_LABELS[acc.account_type]}
                      </Tag>
                    ) : "-"}
                  </td>
                  {/* 차변 */}
                  <td style={{ padding: "4px 8px", width: 140 }}>
                    <InputNumber
                      value={entry.debit_amount}
                      onChange={(v) => update_entry(entry.key, "debit_amount", v || 0)}
                      min={0}
                      style={{ width: "100%" }}
                      formatter={(v) => v?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      parser={(v) => v?.replace(/,/g, "")}
                    />
                  </td>
                  {/* 대변 */}
                  <td style={{ padding: "4px 8px", width: 140 }}>
                    <InputNumber
                      value={entry.credit_amount}
                      onChange={(v) => update_entry(entry.key, "credit_amount", v || 0)}
                      min={0}
                      style={{ width: "100%" }}
                      formatter={(v) => v?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      parser={(v) => v?.replace(/,/g, "")}
                    />
                  </td>
                  {/* 비고 */}
                  <td style={{ padding: "4px 8px", width: 120 }}>
                    <Input
                      value={entry.notes}
                      onChange={(e) => update_entry(entry.key, "notes", e.target.value)}
                      placeholder="비고"
                    />
                  </td>
                  {/* 삭제 */}
                  <td style={{ padding: "4px 8px", width: 40 }}>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove_entry(entry.key)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* 합계 행 */}
          <tfoot>
            <tr style={{ background: is_balanced ? "#f6ffed" : "#fff2f0" }}>
              <td colSpan={2} style={{ padding: "8px", fontWeight: "bold", fontSize: 12 }}>합계</td>
              <td style={{ padding: "8px", fontWeight: "bold", color: "#1677ff" }}>
                {total_debit.toLocaleString()}
              </td>
              <td style={{ padding: "8px", fontWeight: "bold", color: "#1677ff" }}>
                {total_credit.toLocaleString()}
              </td>
              <td colSpan={2} style={{ padding: "8px", fontWeight: "bold", color: is_balanced ? "#52c41a" : "#ff4d4f" }}>
                {is_balanced ? "✓ 균형" : `불균형: ${(total_debit - total_credit).toLocaleString()}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── 버튼 영역 ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
        <Button icon={<PlusOutlined />} onClick={add_entry}>
          분개 라인 추가
        </Button>
        <Button
          type="primary"
          onClick={handle_submit}
          loading={submitting}
          disabled={!is_balanced}
        >
          거래 저장
        </Button>
      </div>
    </div>
  );
}
