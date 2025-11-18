import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState('bookings');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      let data = [];
      if (reportType === 'bookings') {
        const ref = collection(db, 'bookings');
        const snap = await getDocs(ref);
        snap.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() });
        });
      } else if (reportType === 'earnings') {
        const ref = collection(db, 'hostEarnings');
        const snap = await getDocs(ref);
        snap.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() });
        });
      } else if (reportType === 'hosts') {
        const ref = collection(db, 'hosts');
        const snap = await getDocs(ref);
        snap.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() });
        });
      }
      setReportData(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error generating report', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]).join(',');
    const rows = reportData.map((row) => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReportToPDF = () => {
    if (reportData.length === 0) return;

    const headers = Object.keys(reportData[0]);
    const rowsHtml = reportData
      .map((row) => {
        const cells = headers
          .map((key) => `<td style="padding:8px;border:1px solid #e5e7eb;font-size:12px;">${String(row[key] ?? '')}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const headerCells = headers
      .map((key) => `<th style="text-align:left;padding:8px;border:1px solid #e5e7eb;font-size:12px;background:#f3f4f6;">${key}</th>`)
      .join('');

    const titleMap = {
      bookings: 'Bookings Report',
      earnings: 'Earnings Report',
      hosts: 'Hosts Report',
    };

    const title = titleMap[reportType] || 'Report';

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #f9fafb; color: #111827; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { font-size: 12px; margin-top: 0; color: #6b7280; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      @media print {
        body { background: #ffffff; }
      }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>Generated from VentureHub admin panel.</p>
    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <script>
      window.onload = function() {
        window.print();
      };
    </script>
  </body>
</html>`;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-green-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Reports</h1>
            <p className="text-gray-600">Generate and download platform reports.</p>
          </div>
        </div>

        <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm mb-6">
          <div className="flex gap-4 mb-4">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="bookings">Bookings Report</option>
              <option value="earnings">Earnings Report</option>
              <option value="hosts">Hosts Report</option>
            </select>
            <button
              onClick={generateReport}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Generate Report
            </button>
            {reportData.length > 0 && (
              <button
                onClick={downloadCSV}
                className="bg-white border border-green-200 text-green-700 px-4 py-2 rounded hover:bg-green-50"
              >
                Download CSV
              </button>
            )}
            {reportData.length > 0 && (
              <button
                onClick={printReportToPDF}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Print / Save as PDF
              </button>
            )}
          </div>
          {loading && <p className="text-sm text-gray-600">Generating report...</p>}
        </div>

        {reportData.length > 0 && (
          <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Data</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {Object.keys(reportData[0]).map((key) => (
                      <th key={key} className="text-left py-2">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, index) => (
                    <tr key={index} className="border-b">
                      {Object.values(row).map((value, i) => (
                        <td key={i} className="py-2">{String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
