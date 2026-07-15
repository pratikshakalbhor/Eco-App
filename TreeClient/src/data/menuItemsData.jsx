import { 
  LayoutDashboard, 
  TreePine, 
  Trees, 
  Leaf, 
  ShieldCheck, 
  ShoppingBag,
  Sprout,
  Map as MapIcon, 
  User,
  Coins,
  Globe,
  Settings
} from "lucide-react";
      
export const menuItemsData = [
  { id: 1,  label: "Dashboard",        path: "/dashboard",      Icon: LayoutDashboard },
  { id: 2,  label: "Plant Tree",       path: "/planttree",      Icon: TreePine        },
  { id: 3,  label: "My Trees",         path: "/mytrees",        Icon: Trees           },
  { id: 4,  label: "Replantation",     path: "/debt",           Icon: Sprout          },
  { id: 5,  label: "Carbon Credits",   path: "/carboncredits",  Icon: Coins           },
  { id: 6,  label: "Marketplace",      path: "/marketplace",    Icon: ShoppingBag     },
  { id: 7,  label: "Environment",      path: "/environment",    Icon: Globe           },
  { id: 8,  label: "Map",              path: "/map",            Icon: MapIcon         },
  { id: 9,  label: "Verification Hub", path: "/verification",   Icon: ShieldCheck     },
  { id: 10, label: "Profile",          path: "/profile",        Icon: User            },
];

// Role-gated items — shown based on user.role in MenuItems
export const adminMenuItems = [
  { id: 11, label: "Admin Panel",      path: "/admin",          Icon: Settings        },
];

export default menuItemsData;
