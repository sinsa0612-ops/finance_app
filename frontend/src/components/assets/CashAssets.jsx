/**
 * components/assets/CashAssets.jsx
 * ──────────────────────────────────
 * 현금자산 탭 — 현금, 은행 예금, 파킹통장 등 관리 (준비 중)
 */

import React from "react";
import { Card, Row, Col, Typography, Tag } from "antd";
import { WalletOutlined, BankOutlined, DollarOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const PLANNED_FEATURES = [
  { icon: <WalletOutlined />, label: "현금 보유 현황", desc: "지갑·금고 현금 잔액 추적" },
  { icon: <BankOutlined />,   label: "은행 계좌 연동", desc: "예금·적금·파킹통장 잔액 관리" },
  { icon: <DollarOutlined />, label: "외화 자산",      desc: "달러·엔화 등 외화 현금 보유 현황" },
];

export default function CashAssets() {
  return (
    <div style={{ padding: "40px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <WalletOutlined style={{ fontSize: 52, color: "#bfbfbf" }} />
        <Title level={4} style={{ marginTop: 16, color: "#595959" }}>
          현금자산 관리
        </Title>
        <Text type="secondary">
          현금, 은행 예금, 파킹통장 등 유동성 자산을 한눈에 관리합니다.
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
