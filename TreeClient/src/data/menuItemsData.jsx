import { 
  Home, 
  TreePine, 
  Trees, 
  LayoutDashboard, 
  Calculator, 
  Scissors, 
  Map as MapIcon, 
  User, 
  ShieldCheck, 
  Leaf, 
  Trophy 
} from "lucide-react";
      
export const menuItemsData = [
  { id: 4, label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
  { id: 2, label: "Plant Tree", path: "/planttree", Icon: TreePine },
  { id: 3, label: "My Trees", path: "/mytrees", Icon: Trees },
  { id: 10, label: "Environmental Debt", path: "/debt", Icon: Leaf },
  { id: 9, label: "Verification Hub", path: "/verification", Icon: ShieldCheck },
  { id: 8, label: "Profile", path: "/profile", Icon: User },
];   

export default menuItemsData;
