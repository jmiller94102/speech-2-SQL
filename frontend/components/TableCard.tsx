export function TableCard({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="font-medium text-white">{title}</div>
      </div>
      <div className="card-content overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted">
              {headers.map((h) => (
                <th key={h} className="py-2 pr-4 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-border">
                {r.map((cell, cidx) => (
                  <td key={cidx} className="py-3 pr-4">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
