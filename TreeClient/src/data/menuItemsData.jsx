import {
  LayoutDashboard,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react";

export const menuItemsData = [
  { id: 1, label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
  { id: 2, label: "Analyze",   path: "/analyze",   Icon: Search },
  { id: 3, label: "Security",  path: "/security",   Icon: ShieldAlert },
  { id: 4, label: "Wallet",    path: "/wallet",     Icon: Wallet },
];

export default menuItemsData;
