/**
 * components/assets/PensionAssets.jsx
 * ─────────────────────────────────────
 * 연금자산 탭 — 국민연금, 퇴직연금, 개인연금 등 관리 (준비 중)
 */

import React from "react";
import { Card, Row, Col, Typography, Tag } from "antd";
import { SafetyOutlined, AuditOutlined, TeamOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const PLANNED_FEATURES = [
  { icon: <TeamOutlined />,   label: "국민연금",   desc: "납부 내역 및 예상 수령액 조회" },
  { icon: <AuditOutlined />,  label: "퇴직연금",   desc: "DC·DB형 퇴직연금 잔액 추적" },
  { icon: <SafetyOutlined />, label: "개인연금",   desc: "IRP·연금저축 포트폴리오 관리" },
];

export default function PensionAssets() {
  return (
    <div style={{ padding: "40px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <SafetyOutlined style={{ fontSize: 52, color: "#bfbfbf" }} />
        <Title level={4} style={{ marginTop: 16, color: "#595959" }}>
          연금자산 관리
        </Title>
        <Text type="secondary">
          국민연금, 퇴직연금, 개인연금(IRP·연금저축)을 통합 관리합니다.
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
