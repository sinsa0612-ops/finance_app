/**
 * components/accounts/AccountForm.jsx
 * ─────────────────────────────────────
 * 계정 생성/수정 폼.
 */

import React, { useState } from "react";
import { Form, Input, Select, Switch, Button, Alert, message } from "antd";
import { accountApi } from "../../api/client";
import { ACCOUNT_TYPE_LABELS } from "../../utils/formatters";

const { Option } = Select;

export default function AccountForm({ account, accounts = [], on_success }) {
  const [form] = Form.useForm();
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState(null);

  const is_edit = !!account;

  const handle_submit = async () => {
    try {
      const values = await form.validateFields();
      set_submitting(true);
      set_error(null);

      if (is_edit) {
        await accountApi.update(account.account_id, values);
        message.success("계정이 수정되었습니다.");
      } else {
        await accountApi.create(values);
        message.success("계정이 추가되었습니다.");
      }
      on_success?.();
    } catch (e) {
      set_error(e.message);
    } finally {
      set_submitting(false);
    }
  };

  // 초기값 설정 (수정 모드)
  const initial_values = account
    ? { ...account, parent_account_id: account.parent_account_id || undefined }
    : { currency: "KRW", is_active: true };

  return (
    <Form form={form} layout="vertical" initialValues={initial_values}>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => set_error(null)} />}

      <Form.Item name="account_code" label="계정 코드" rules={[{ required: true, message: "계정 코드를 입력하세요." }]}
        help="예: 1001 (현금), 2001 (미지급금), 3001 (자본금)">
        <Input placeholder="예: 1001" />
      </Form.Item>

      <Form.Item name="name" label="계정명" rules={[{ required: true, message: "계정명을 입력하세요." }]}>
        <Input placeholder="예: 현금및현금성자산" />
      </Form.Item>

      <Form.Item name="account_type" label="계정 유형" rules={[{ required: true }]}>
        <Select>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v} ({k})</Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="parent_account_id" label="상위 계정 (선택)">
        <Select placeholder="최상위 계정" allowClear showSearch
          filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
          {accounts
            .filter((a) => !account || a.account_id !== account.account_id) // 자기 자신 제외
            .map((a) => (
              <Option key={a.account_id} value={a.account_id}>
                [{a.account_code}] {a.name}
              </Option>
            ))}
        </Select>
      </Form.Item>

      <Form.Item name="currency" label="기준 통화" rules={[{ required: true }]}>
        <Select>
          <Option value="KRW">KRW (원)</Option>
          <Option value="USD">USD (달러)</Option>
          <Option value="JPY">JPY (엔)</Option>
          <Option value="EUR">EUR (유로)</Option>
        </Select>
      </Form.Item>

      {is_edit && (
        <Form.Item name="is_active" label="활성 여부" valuePropName="checked">
          <Switch checkedChildren="활성" unCheckedChildren="비활성" />
        </Form.Item>
      )}

      <Form.Item name="notes" label="비고">
        <Input.TextArea rows={2} />
      </Form.Item>

      <Button type="primary" block onClick={handle_submit} loading={submitting}>
        {is_edit ? "계정 수정" : "계정 추가"}
      </Button>
    </Form>
  );
}
