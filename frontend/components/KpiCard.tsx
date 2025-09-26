import { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  delta,
  icon,
  trend,
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-content">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-muted text-xs">{label}</p>
            <div className="flex items-end gap-2 mt-1">
              <h3 className="text-2xl font-semibold leading-none">{value}</h3>
              {delta && (
                <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded">{delta}</span>
              )}
            </div>
          </div>
          {icon && <div className="text-text-muted">{icon}</div>}
        </div>
        {trend && <div className="mt-3">{trend}</div>}
      </div>
    </div>
  );
}
