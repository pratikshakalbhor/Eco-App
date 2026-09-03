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
      
// Beginner-first navigation for the EcoChain user journey.
// Normal users see: Get Started → Your Trees → Credits → Marketplace.
// Advanced / admin tools are grouped separately (see MenuItems.jsx).
export const menuItemsData = [
  { id: 1,  label: "Dashboard",        path: "/dashboard",      Icon: LayoutDashboard },
];

// Main user-journey actions — the everyday tools a beginner uses.
export const journeyMenuItems = [
  { id: 2,  label: "Plant a Tree",     path: "/planttree",      Icon: TreePine        },
  { id: 3,  label: "My Trees",         path: "/mytrees",        Icon: Trees           },
  { id: 4,  label: "Carbon Credits",   path: "/carboncredits",  Icon: Coins           },
  { id: 5,  label: "Marketplace",      path: "/marketplace",    Icon: ShoppingBag     },
];

// Explore / learn more about the impact of everyone's trees.
export const exploreMenuItems = [
  { id: 6,  label: "Replantation",     path: "/debt",           Icon: Sprout          },
  { id: 7,  label: "Environment",      path: "/environment",    Icon: Globe           },
  { id: 8,  label: "Tree Map",         path: "/map",            Icon: MapIcon         },
  { id: 9,  label: "Profile",          path: "/profile",        Icon: User            },
];

// Role-gated items — shown based on user.role in MenuItems.
export const adminMenuItems = [
  { id: 10, label: "Verification Hub", path: "/verification",   Icon: ShieldCheck     },
  { id: 11, label: "Admin Panel",      path: "/admin",          Icon: Settings        },
];

export default menuItemsData;
