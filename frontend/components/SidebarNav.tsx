import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  ClipboardCheck,
  Target,
  FileText,
  Settings,
  Truck,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  ariaLabel: string;
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, ariaLabel: "Go to Dashboard" },
  { name: "People", path: "/people", icon: Users, ariaLabel: "Go to People" },
  { name: "Calendar", path: "/calendar/watch", icon: Calendar, ariaLabel: "Go to Calendar" },
  { name: "Tasks", path: "/tasks", icon: CheckSquare, ariaLabel: "Go to Tasks" },
  { name: "Inspections", path: "/inspections", icon: ClipboardCheck, ariaLabel: "Go to Inspections" },
  { name: "J4 Checks", path: "/equipment", icon: Truck, ariaLabel: "Go to J4 Equipment Checks" },
  { name: "Targets", path: "/targets", icon: Target, ariaLabel: "Go to Targets" },
  { name: "Policies", path: "/policies", icon: FileText, ariaLabel: "Go to Policies & Q&A" },
  { name: "Settings", path: "/settings", icon: Settings, ariaLabel: "Go to Settings" },
];

export default function SidebarNav() {
  const location = useLocation();

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-20 bg-gradient-to-b from-indigo-600 to-purple-700 flex flex-col items-center py-6 shadow-lg z-40"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mb-8 flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl backdrop-blur-sm">
        <span className="text-white font-bold text-xl">WC</span>
      </div>

      <TooltipProvider delayDuration={300}>
        <nav className="flex-1 flex flex-col gap-2 w-full px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== "/" && location.pathname.startsWith(item.path));

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    className={`
                      relative flex items-center justify-center w-14 h-14 rounded-xl
                      transition-all duration-200 ease-in-out
                      hover:bg-white/20 hover:scale-105
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                      ${isActive 
                        ? "bg-white/20 shadow-lg before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-white before:rounded-r-full" 
                        : "hover:shadow-md"
                      }
                    `}
                    aria-label={item.ariaLabel}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon 
                      className={`h-6 w-6 transition-colors ${isActive ? "text-white" : "text-white/70"}`}
                      aria-hidden="true"
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex items-center justify-center w-14 h-14 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Settings"
          >
            <Settings className="h-6 w-6" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          Settings
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
