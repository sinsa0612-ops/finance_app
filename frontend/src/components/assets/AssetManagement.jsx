/**
 * components/assets/AssetManagement.jsx
 * ───────────────────────────────────────
 * 자산관리 메인 화면.
 * 현금자산 / 투자자산 / 연금자산 / 부동산 / 부채 탭으로 구성.
 */

import React, { useState } from "react";
import { Tabs } from "antd";
import {
  WalletOutlined,
  StockOutlined,
  SafetyOutlined,
  HomeOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";

import CashAssets    from "./CashAssets";
import Investments   from "../investments/Investments";
import PensionAssets from "./PensionAssets";
import RealEstate    from "./RealEstate";
import DebtManagement from "./DebtManagement";

const TAB_ITEMS = [
  {
    key: "cash",
    label: (
      <span>
        <WalletOutlined style={{ marginRight: 6 }} />
        현금자산
      </span>
    ),
    children: <CashAssets />,
  },
  {
    key: "investments",
    label: (
      <span>
        <StockOutlined style={{ marginRight: 6 }} />
        투자자산
      </span>
    ),
    children: <Investments />,
  },
  {
    key: "pension",
    label: (
      <span>
        <SafetyOutlined style={{ marginRight: 6 }} />
        연금자산
      </span>
    ),
    children: <PensionAssets />,
  },
  {
    key: "realestate",
    label: (
      <span>
        <HomeOutlined style={{ marginRight: 6 }} />
        부동산
      </span>
    ),
    children: <RealEstate />,
  },
  {
    key: "debt",
    label: (
      <span>
        <CreditCardOutlined style={{ marginRight: 6 }} />
        부채
      </span>
    ),
    children: <DebtManagement />,
  },
];

export default function AssetManagement() {
  const [active_tab, set_active_tab] = useState("cash");

  return (
    <Tabs
      activeKey={active_tab}
      onChange={set_active_tab}
      items={TAB_ITEMS}
      size="middle"
      style={{ marginTop: -8 }}
    />
  );
}
