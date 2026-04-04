import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";

// ── Helpers ───────────────────────────────────────────────────────────────────

function quarterLabel(q: number, fy: number): string {
  const periods = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];
  return `Q${q} ${periods[q - 1]} ${fy}/${String(fy + 1).slice(2)}`;
}

// Category colour legend (matches Word doc exactly)
const CATEGORY_LEGEND = [
  { color: "#8EAADB", label: "Operational" },
  { color: "#F4B083", label: "CS Engagement" },
  { color: "#0070C0", label: "Training" },
  { color: "#C00000", label: "FS Enforcement" },
  { color: "#FFD966", label: "Safety & Assurance" },
  { color: "#A8D08D", label: "Preparedness" },
];

export default function QuarterlyReportPrint() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quarterly-report-print", reportId],
    queryFn: async () => backend.quarterly_report.get(reportId),
    enabled: !!reportId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading report…</p>
      </div>
    );
  }

  if (isError || !data?.report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Failed to load report.</p>
      </div>
    );
  }

  const report = data.report;
  const metCount = report.items.filter((i) => i.met).length +
    report.custom_items.filter((i) => i.met).length;
  const totalCount = report.items.length + report.custom_items.length;

  return (
    <>
      {/* Print-specific styles injected inline */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .print-page { padding: 0; }
        }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #999; padding: 4px 8px; }
        th { font-weight: bold; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-3 z-50">
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded text-sm font-medium shadow"
        >
          🖨️ Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm"
        >
          Close
        </button>
      </div>

      {/* Document body */}
      <div className="print-page max-w-4xl mx-auto p-6">

        {/* SFRS Logo */}
        <img
          src="/sfrs-logo.png"
          alt="Scottish Fire and Rescue Service"
          style={{ width: "100%", maxHeight: 70, objectFit: "cover", marginBottom: 16 }}
        />

        {/* Document Title */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: "bold", fontSize: "14pt" }}>
            CITY OF GLASGOW LSO AREA PERFORMANCE
          </div>
          <div style={{ fontWeight: "bold", fontSize: "13pt", marginTop: 4 }}>
            WATCH BASED QUARTERLY CHECKLIST
          </div>
        </div>

        {/* Header table: Station / Watch / WC / Quarter */}
        <table style={{ marginBottom: 10 }}>
          <tbody>
            <tr>
              <td style={{ backgroundColor: "#BFBFBF", fontWeight: "bold", width: "18%" }}>Station</td>
              <td style={{ width: "32%" }}>{report.station_name}</td>
              <td style={{ backgroundColor: "#BFBFBF", fontWeight: "bold", width: "18%" }}>Watch</td>
              <td style={{ width: "32%" }}>{report.watch}</td>
            </tr>
            <tr>
              <td style={{ backgroundColor: "#BFBFBF", fontWeight: "bold" }}>Watch Commander</td>
              <td>{report.watch_commander_name}</td>
              <td style={{ backgroundColor: "#BFBFBF", fontWeight: "bold" }}>Quarter / Year</td>
              <td>{quarterLabel(report.quarter, report.financial_year)}</td>
            </tr>
          </tbody>
        </table>

        {/* Category legend */}
        <table style={{ marginBottom: 10 }}>
          <tbody>
            <tr>
              {CATEGORY_LEGEND.slice(0, 2).map((c) => (
                <>
                  <td key={c.label + "-swatch"} style={{ backgroundColor: c.color, width: "6%" }}>&nbsp;</td>
                  <td key={c.label + "-label"} style={{ width: "44%" }}>{c.label}</td>
                </>
              ))}
            </tr>
            <tr>
              {CATEGORY_LEGEND.slice(2, 4).map((c) => (
                <>
                  <td key={c.label + "-swatch"} style={{ backgroundColor: c.color }}>&nbsp;</td>
                  <td key={c.label + "-label"}>{c.label}</td>
                </>
              ))}
            </tr>
            <tr>
              {CATEGORY_LEGEND.slice(4, 6).map((c) => (
                <>
                  <td key={c.label + "-swatch"} style={{ backgroundColor: c.color }}>&nbsp;</td>
                  <td key={c.label + "-label"}>{c.label}</td>
                </>
              ))}
            </tr>
          </tbody>
        </table>

        {/* KPI table */}
        <table style={{ marginBottom: 10 }}>
          <thead>
            <tr style={{ backgroundColor: "#BFBFBF" }}>
              <th style={{ width: "8%" }}>KPI</th>
              <th style={{ width: "62%" }}>Description</th>
              <th style={{ width: "22%" }}>Target</th>
              <th style={{ width: "8%", textAlign: "center" }}>✓</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.id} style={{ backgroundColor: `#${item.row_color}` }}>
                <td style={{ fontWeight: "bold" }}>{item.kpi_code}</td>
                <td>{item.description}</td>
                <td>{item.target_text}</td>
                <td style={{ textAlign: "center", fontSize: "14pt" }}>
                  {item.met ? "✓" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Other Actions */}
        <table style={{ marginBottom: 10 }}>
          <thead>
            <tr style={{ backgroundColor: "#BFBFBF" }}>
              <th colSpan={4} style={{ textAlign: "left" }}>
                OTHER ACTIONS AS DESIGNATED BY STATION COMMANDER (e.g. CybSafe Modules, Driving License Checks etc.)
              </th>
            </tr>
            <tr style={{ backgroundColor: "#BFBFBF" }}>
              <th style={{ width: "8%" }}>KPI</th>
              <th style={{ width: "62%" }}>Description</th>
              <th style={{ width: "22%" }}>Target</th>
              <th style={{ width: "8%", textAlign: "center" }}>✓</th>
            </tr>
          </thead>
          <tbody>
            {report.custom_items.length === 0 ? (
              // Render 5 blank rows matching the Word template
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))
            ) : (
              <>
                {report.custom_items.map((item) => (
                  <tr key={item.id}>
                    <td>&nbsp;</td>
                    <td>{item.description}</td>
                    <td>{item.target_text ?? ""}</td>
                    <td style={{ textAlign: "center", fontSize: "14pt" }}>
                      {item.met ? "✓" : ""}
                    </td>
                  </tr>
                ))}
                {/* Pad to at least 5 rows */}
                {report.custom_items.length < 5 &&
                  Array.from({ length: 5 - report.custom_items.length }).map((_, i) => (
                    <tr key={`pad-${i}`}>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
              </>
            )}
          </tbody>
        </table>

        {/* Notes */}
        <table style={{ marginBottom: 10 }}>
          <tbody>
            <tr style={{ backgroundColor: "#BFBFBF" }}>
              <td style={{ fontWeight: "bold" }}>NOTES:</td>
            </tr>
            <tr>
              <td style={{ height: 120, verticalAlign: "top" }}>
                {report.notes ?? ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer summary (screen only) */}
        <div className="no-print mt-6 text-xs text-gray-400 text-center">
          {metCount}/{totalCount} KPIs met · Status: {report.status}
        </div>
      </div>
    </>
  );
}
