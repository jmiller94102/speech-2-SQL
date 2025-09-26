"use client";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

export type ChartCardProps = {
  title: string;
  description?: string;
  type: "line" | "bar";
  data: any;
  options?: any;
};

export function ChartCard({ title, description, type, data, options }: ChartCardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="font-medium text-white">{title}</div>
          {description && <div className="text-text-muted text-xs">{description}</div>}
        </div>
      </div>
      <div className="card-content">
        {type === "line" ? (
          <Line data={data} options={options} />
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    </div>
  );
}
