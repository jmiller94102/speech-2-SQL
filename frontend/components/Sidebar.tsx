"use client";
import { BarChart3, Layers, ShoppingCart, Users, Settings, HelpCircle, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const nav = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  { label: "Products", href: "/products", icon: Layers },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-card border-r border-border">
      <div className="h-16 flex items-center px-4 border-b border-border text-lg font-semibold">
        <span className="text-white">Acme</span>
        <span className="ml-2 px-2 py-1 text-xs rounded bg-muted text-text-muted">Sales</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent",
              active ? "bg-muted border-border" : "hover:bg-muted/60"
            )}>
              <Icon className="w-5 h-5 text-text-muted" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 mt-auto space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60">
          <Settings className="w-5 h-5 text-text-muted" />
          <span>Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60">
          <HelpCircle className="w-5 h-5 text-text-muted" />
          <span>Help</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60">
          <LogOut className="w-5 h-5 text-text-muted" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
