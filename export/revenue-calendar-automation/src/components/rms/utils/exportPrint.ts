// ─── Export & Print Utilities ─────────────────────────────────────────────────

export function exportToCSV(roomTypes: any[], dateColumns: any[], filename = "calendrier_tarifaire") {
  const headers = ["Type Chambre", "Code", "Plan Tarifaire", ...dateColumns.map((d: any) => d.date)];
  const rows: string[][] = [];

  roomTypes.forEach((rt: any) => {
    rt.ratePlans.forEach((rp: any) => {
      const row = [rt.roomTypeName, rt.roomTypeCode, rp.planName];
      rp.prices.forEach((p: any) => row.push(String(p.price)));
      rows.push(row);
    });
  });

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

export function exportToPDF() {
  window.print();
}

export function printCalendar() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const content = document.querySelector("body")?.innerHTML ?? "";
  printWindow.document.write(`
    <html>
      <head>
        <title>Calendrier Tarifaire - ${new Date().toLocaleDateString("fr-FR")}</title>
        <style>
          @media print {
            body { font-family: Arial, sans-serif; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
