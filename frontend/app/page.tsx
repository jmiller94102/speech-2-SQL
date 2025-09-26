import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { TableCard } from "@/components/TableCard";
import { lineData, barData, kpis, topProducts } from "@/lib/mock";
import { DollarSign, ShoppingBag, Gauge, Repeat } from "lucide-react";

export default function Page() {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[16rem_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Topbar />
        <main className="p-4 md:p-6 space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label={kpis[0].label} value={kpis[0].value} delta={kpis[0].delta} icon={<DollarSign className="w-5 h-5" />} />
            <KpiCard label={kpis[1].label} value={kpis[1].value} delta={kpis[1].delta} icon={<ShoppingBag className="w-5 h-5" />} />
            <KpiCard label={kpis[2].label} value={kpis[2].value} delta={kpis[2].delta} icon={<Gauge className="w-5 h-5" />} />
            <KpiCard label={kpis[3].label} value={kpis[3].value} delta={kpis[3].delta} icon={<Repeat className="w-5 h-5" />} />
          </section>
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <ChartCard
                title="Revenue over time"
                description="Last 12 months"
                type="line"
                data={lineData}
                options={{
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: "#9CA3AF" } },
                    y: { grid: { color: "#1F2937" }, ticks: { color: "#9CA3AF" } },
                  },
                }}
              />
            </div>
            <div>
              <ChartCard
                title="Orders by weekday"
                type="bar"
                data={barData}
                options={{
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: "#9CA3AF" } },
                    y: { grid: { color: "#1F2937" }, ticks: { color: "#9CA3AF" } },
                  },
                }}
              />
            </div>
          </section>
          <section className="grid grid-cols-1 gap-4">
            <TableCard title="Top Products" headers={topProducts.headers} rows={topProducts.rows} />
          </section>
        </main>
      </div>
    </div>
  );
}
