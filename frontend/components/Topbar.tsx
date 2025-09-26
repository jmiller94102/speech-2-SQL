"use client";
import { Bell, Search, ChevronDown } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-card">
      <div className="flex items-center gap-2 w-96">
        <div className="relative w-full">
          <input
            className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2 placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Search for reports, people, or products"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-[10px]" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-muted">
          <Bell className="w-5 h-5 text-text-muted" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-danger" />
        </button>
        <button className="flex items-center gap-2 bg-muted border border-border px-3 py-2 rounded-lg">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-purple-500" />
          <span className="text-sm">Alex Johnson</span>
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </button>
      </div>
    </header>
  );
}
