/**
 * components/assets/RealEstate.jsx
 * ──────────────────────────────────
 * 부동산 탭 — 아파트, 토지, 상가 등 부동산 자산 관리 (준비 중)
 */

import React from "react";
import { Card, Row, Col, Typography, Tag } from "antd";
import { HomeOutlined, EnvironmentOutlined, ShopOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const PLANNED_FEATURES = [
  { icon: <HomeOutlined />,        label: "주거용 부동산", desc: "아파트·빌라·오피스텔 자산가치 추적" },
  { icon: <EnvironmentOutlined />, label: "토지",          desc: "토지 면적·공시지가·시세 관리" },
  { icon: <ShopOutlined />,        label: "수익형 부동산", desc: "상가·오피스 임대수익 및 자산가치" },
];

export default function RealEstate() {
  return (
    <div style={{ padding: "40px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <HomeOutlined style={{ fontSize: 52, color: "#bfbfbf" }} />
        <Title level={4} style={{ marginTop: 16, color: "#595959" }}>
          부동산 자산 관리
        </Title>
        <Text type="secondary">
          보유 부동산의 자산가치, 담보 현황, 임대수익을 통합 관리합니다.
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
