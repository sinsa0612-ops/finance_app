/**
 * components/assets/DebtManagement.jsx
 * ──────────────────────────────────────
 * 부채 탭 — 대출, 신용카드, 할부 등 부채 관리 (준비 중)
 */

import React from "react";
import { Card, Row, Col, Typography, Tag } from "antd";
import { CreditCardOutlined, BankOutlined, FileTextOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const PLANNED_FEATURES = [
  { icon: <BankOutlined />,        label: "대출 관리",       desc: "주택담보·신용대출 잔액·이자율 추적" },
  { icon: <CreditCardOutlined />,  label: "신용카드·할부",   desc: "카드 사용액 및 할부 잔액 관리" },
  { icon: <FileTextOutlined />,    label: "부채 상환 계획",  desc: "원리금 상환 일정 및 이자 비용 분석" },
];

export default function DebtManagement() {
  return (
    <div style={{ padding: "40px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <CreditCardOutlined style={{ fontSize: 52, color: "#bfbfbf" }} />
        <Title level={4} style={{ marginTop: 16, color: "#595959" }}>
          부채 관리
        </Title>
        <Text type="secondary">
          대출, 신용카드, 할부 등 모든 부채를 한곳에서 추적하고 상환 계획을 관리합니다.
        </Text>
      </div>

      <Row gutter={[16, 16]} justify="center">
        {PLANNED_FEATURES.map((f) => (
          <Col key={f.label} xs={24} sm={8}>
            <Card size="small" style={{ textAlign: "center", borderStyle: "dashed" }}>
              <div style={{ fontSize: 28, color: "#d9d9d9", marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{f.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Tag color="default">준비 중</Tag>
      </div>
    </div>
  );
}
