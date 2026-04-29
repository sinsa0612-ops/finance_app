/**
 * components/layout/AppLayout.jsx
 * ─────────────────────────────────
 * 전체 앱의 레이아웃 뼈대.
 * Ant Design Layout + Sider를 사용해 좌측 사이드바 네비게이션을 구현한다.
 */

import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Typography, theme } from "antd";
import {
  DashboardOutlined,
  BookOutlined,
  StockOutlined,
  BankOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

// 사이드바 메뉴 항목 정의
const MENU_ITEMS = [
  { key: "/dashboard",   icon: <DashboardOutlined />,  label: "대시보드" },
  { key: "/ledger",      icon: <BookOutlined />,        label: "거래 원장" },
  { key: "/investments", icon: <StockOutlined />,       label: "투자 자산" },
  { key: "/accounts",    icon: <BankOutlined />,        label: "계정과목" },
  { key: "/reports",     icon: <BarChartOutlined />,    label: "재무 보고서" },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // 현재 경로의 첫 번째 세그먼트를 선택 키로 사용
  const selectedKey = "/" + location.pathname.split("/")[1];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* ── 사이드바 ──────────────────────────────────────────────── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
        width={200}
      >
        {/* 앱 로고/제목 */}
        <div style={{ padding: "16px", textAlign: "center", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          {collapsed ? (
            <Title level={4} style={{ margin: 0, color: token.colorPrimary }}>💰</Title>
          ) : (
            <Title level={5} style={{ margin: 0, color: token.colorPrimary }}>개인 자산관리</Title>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      {/* ── 메인 영역 ─────────────────────────────────────────────── */}
      <Layout>
        {/* 헤더: 사이드바 접기 버튼 */}
        <Header
          style={{
            background: token.colorBgContainer,
            padding: "0 16px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* 사이드바 접기/펼치기 버튼 */}
          {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
            style: { fontSize: 18, cursor: "pointer", color: token.colorText },
            onClick: () => setCollapsed(!collapsed),
          })}
          <Title level={5} style={{ margin: "0 0 0 16px" }}>
            {MENU_ITEMS.find((m) => m.key === selectedKey)?.label || ""}
          </Title>
        </Header>

        {/* 페이지 콘텐츠 */}
        <Content style={{ margin: "16px", padding: "16px", background: token.colorBgContainer, borderRadius: token.borderRadius }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
