export const kpis = [
  { label: "Total Revenue", value: "$1,204,532", delta: "+12.4%" },
  { label: "Orders", value: "18,402", delta: "+4.2%" },
  { label: "Avg. Order Value", value: "$65.42", delta: "+2.1%" },
  { label: "Returning Customers", value: "38%", delta: "+1.3%" },
];

export const lineData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  datasets: [
    {
      label: "Revenue",
      data: [52, 60, 75, 62, 88, 95, 110, 120, 115, 130, 128, 145],
      borderColor: "#3B82F6",
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      fill: true,
      tension: 0.35,
      pointRadius: 0,
    },
  ],
};

export const barData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Orders",
      data: [210, 260, 195, 310, 402, 280, 220],
      backgroundColor: "#22C55E",
      borderRadius: 6,
    },
  ],
};

export const topProducts = {
  headers: ["Product", "Category", "Units", "Revenue"],
  rows: [
    ["Noise-Canceling Headphones", "Audio", 832, "$86,240"],
    ["4K Action Camera", "Cameras", 610, "$122,000"],
    ["Smart Fitness Tracker", "Wearables", 742, "$37,100"],
    ["Mechanical Keyboard", "Accessories", 520, "$41,600"],
    ["USB-C Hub (8-in-1)", "Accessories", 1050, "$31,500"],
  ],
};
