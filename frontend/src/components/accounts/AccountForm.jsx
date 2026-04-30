/**
 * components/accounts/AccountForm.jsx
 * ─────────────────────────────────────
 * 계정 생성/수정 폼.
 * 계정 유형 선택 시 해당 유형 범위의 다음 코드를 자동 배정한다.
 */

import React, { useState } from "react";
import { Form, Input, Select, Switch, Button, Alert, message, Tag } from "antd";
import { accountApi } from "../../api/client";
import { ACCOUNT_TYPE_LABELS } from "../../utils/formatters";

const { Option } = Select;

// 계정 유형별 코드 앞자리 (한국 표준 계정과목 체계)
const TYPE_CODE_PREFIX = {
  asset:     "1",   // 자산  1xxx
  liability: "2",   // 부채  2xxx
  equity:    "3",   // 자본  3xxx
  income:    "4",   // 수익  4xxx
  expense:   "5",   // 비용  5xxx
};

// 해당 유형에서 사용 가능한 다음 코드 계산
function next_code_for_type(type, accounts) {
  const prefix = TYPE_CODE_PREFIX[type];
  if (!prefix) return "";

  const used = accounts
    .map((a) => parseInt(a.account_code, 10))
    .filter((n) => !isNaN(n) && String(n).startsWith(prefix));

  const max = used.length > 0 ? Math.max(...used) : Number(`${prefix}000`);
  return String(max + 1);
}

export default function AccountForm({ account, accounts = [], on_success }) {
  const [form] = Form.useForm();
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState(null);
  const [auto_assigned, set_auto_assigned] = useState(false);

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

  const handle_type_change = (type) => {
    if (is_edit) return;
    const code = next_code_for_type(type, accounts);
    form.setFieldValue("account_code", code);
    set_auto_assigned(true);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initial_values}
      onValuesChange={(changed) => {
        if (!is_edit && changed.account_type) handle_type_change(changed.account_type);
        if (changed.account_code !== undefined) set_auto_assigned(false);
      }}
    >
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => set_error(null)} />}

      <Form.Item name="account_type" label="계정 유형" rules={[{ required: true, message: "계정 유형을 선택하세요." }]}>
        <Select placeholder="유형 선택 — 코드가 자동 배정됩니다">
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>
              <Tag color={{ asset: "blue", liability: "orange", equity: "purple", income: "green", expense: "red" }[k]}>
                {TYPE_CODE_PREFIX[k]}xxx
              </Tag>
              {v}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="account_code"
        label={
          <span>
            계정 코드{" "}
            {auto_assigned && !is_edit && (
              <Tag color="blue" style={{ fontSize: 11, marginLeft: 4 }}>자동 배정</Tag>
            )}
          </span>
        }
        rules={[{ required: true, message: "계정 코드를 입력하세요." }]}
        help={
          is_edit
            ? "코드를 직접 수정할 수 있습니다."
            : "계정 유형 선택 시 자동 배정됩니다. 직접 수정도 가능합니다."
        }
      >
        <Input placeholder="계정 유형을 먼저 선택하세요" />
      </Form.Item>

      <Form.Item name="name" label="계정명" rules={[{ required: true, message: "계정명을 입력하세요." }]}>
        <Input placeholder="예: 현금및현금성자산" />
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
