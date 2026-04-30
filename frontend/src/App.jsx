/**
 * App.jsx
 * ───────
 * 루트 컴포넌트. React Router로 탭/페이지를 관리한다.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import koKR from "antd/locale/ko_KR";
import AppLayout       from "./components/layout/AppLayout";
import Dashboard       from "./components/dashboard/Dashboard";
import Ledger          from "./components/ledger/Ledger";
import AssetManagement from "./components/assets/AssetManagement";
import Accounts        from "./components/accounts/Accounts";
import Reports         from "./components/reports/Reports";

export default function App() {
  return (
    // Ant Design 한국어 로케일 설정
    <ConfigProvider locale={koKR} theme={{ token: { colorPrimary: "#1677ff" } }}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"   element={<Dashboard />} />
              <Route path="ledger"      element={<Ledger />} />
              <Route path="assets"      element={<AssetManagement />} />
              {/* 이전 /investments 경로 하위 호환 */}
              <Route path="investments" element={<Navigate to="/assets" replace />} />
              <Route path="accounts"    element={<Accounts />} />
              <Route path="reports"     element={<Reports />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
