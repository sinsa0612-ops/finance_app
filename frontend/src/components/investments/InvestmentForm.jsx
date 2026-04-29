/**
 * components/investments/InvestmentForm.jsx
 * ──────────────────────────────────────────
 * 포지션 생성 폼 (mode="position") 또는
 * 매수/매도/배당 거래 입력 폼 (mode="transaction").
 */

import React, { useState } from "react";
import {
  Form, Input, Select, InputNumber, DatePicker, Button, Alert, message,
} from "antd";
import dayjs from "dayjs";
import { investmentApi } from "../../api/client";

const { Option } = Select;

// 지원 거래소 목록
const EXCHANGES = ["NASDAQ", "NYSE", "KRX", "KOSDAQ", "TSE", "Binance", "Upbit", "Bithumb", "Coinbase", "기타"];

export default function InvestmentForm({ mode, accounts = [], position = null, on_success }) {
  const [form] = Form.useForm();
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState(null);
  const [asset_type, set_asset_type] = useState(position?.asset_type || "stock");

  const handle_submit = async () => {
    try {
      const values = await form.validateFields();
      set_submitting(true);
      set_error(null);

      if (mode === "position") {
        // 새 포지션 생성
        await investmentApi.createPosition({
          account_id: values.account_id,
          ticker: values.ticker.toUpperCase(),
          asset_type: values.asset_type,
          exchange: values.exchange,
          quantity: values.quantity,
          avg_cost_price: values.avg_cost_price,
          currency: values.currency,
          notes: values.notes,
        });
        message.success("포지션이 추가되었습니다.");
      } else {
        // 투자 거래 추가 (매수/매도/배당)
        await investmentApi.createTransaction({
          position_id: position.position_id,
          date: values.date.format("YYYY-MM-DD"),
          action: values.action,
          quantity: values.quantity,
          price: values.price,
          fee: values.fee || 0,
          currency: values.currency,
          notes: values.notes,
        });
        message.success("거래가 기록되었습니다. 평균가가 자동 재계산됩니다.");
      }

      on_success?.();
    } catch (e) {
      set_error(e.message);
    } finally {
      set_submitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" initialValues={{ currency: "USD", action: "buy", date: dayjs() }}>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => set_error(null)} />}

      {/* ── 포지션 모드 필드 ────────────────────────────────────── */}
      {mode === "position" && (
        <>
          <Form.Item name="account_id" label="연결 계정 (자산 계정)" rules={[{ required: true }]}>
            <Select placeholder="계정 선택">
              {accounts.map((a) => (
                <Option key={a.account_id} value={a.account_id}>
                  [{a.account_code}] {a.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="ticker" label="종목 코드 (Ticker)" rules={[{ required: true }]}
            help="예: AAPL, 005930.KS (삼성전자), BTC-USD">
            <Input placeholder="예: AAPL" style={{ textTransform: "uppercase" }} />
          </Form.Item>

          <Form.Item name="asset_type" label="자산 유형" rules={[{ required: true }]}>
            <Select onChange={(v) => set_asset_type(v)}>
              <Option value="stock">주식</Option>
              <Option value="crypto">암호화폐</Option>
              <Option value="etf">ETF</Option>
              <Option value="fund">펀드</Option>
              <Option value="bond">채권</Option>
              <Option value="other">기타</Option>
            </Select>
          </Form.Item>

          <Form.Item name="exchange" label="거래소">
            <Select placeholder="선택 (선택사항)" allowClear>
              {EXCHANGES.map((e) => <Option key={e} value={e}>{e}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="avg_cost_price" label="평균 매입가" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} precision={6}
              formatter={(v) => v?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => v?.replace(/,/g, "")} />
          </Form.Item>

          <Form.Item name="quantity" label="보유 수량" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} precision={8} />
          </Form.Item>
        </>
      )}

      {/* ── 거래 모드 필드 ──────────────────────────────────────── */}
      {mode === "transaction" && (
        <>
          <Form.Item label="종목">
            <Input value={position?.ticker} disabled />
          </Form.Item>

          <Form.Item name="date" label="거래 날짜" rules={[{ required: true }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="action" label="거래 유형" rules={[{ required: true }]}>
            <Select>
              <Option value="buy">매수</Option>
              <Option value="sell">매도</Option>
              <Option value="dividend">배당</Option>
              <Option value="split">주식 분할</Option>
            </Select>
          </Form.Item>

          <Form.Item name="quantity" label="수량" rules={[{ required: true }]}>
            <InputNumber min={0.000001} style={{ width: "100%" }} precision={8} />
          </Form.Item>

          <Form.Item name="price" label="거래 단가" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} precision={6}
              formatter={(v) => v?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => v?.replace(/,/g, "")} />
          </Form.Item>

          <Form.Item name="fee" label="수수료 (선택)">
            <InputNumber min={0} style={{ width: "100%" }} precision={4} />
          </Form.Item>
        </>
      )}

      {/* ── 공통 필드 ─────────────────────────────────────────── */}
      <Form.Item name="currency" label="통화" rules={[{ required: true }]}>
        <Select>
          <Option value="USD">USD</Option>
          <Option value="KRW">KRW</Option>
          <Option value="JPY">JPY</Option>
          <Option value="EUR">EUR</Option>
          <Option value="BTC">BTC</Option>
        </Select>
      </Form.Item>

      <Form.Item name="notes" label="비고">
        <Input.TextArea rows={2} />
      </Form.Item>

      <Button type="primary" block onClick={handle_submit} loading={submitting}>
        {mode === "position" ? "포지션 추가" : "거래 기록"}
      </Button>
    </Form>
  );
}
