import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState('bookings');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

    const filtered = getFilteredData();
    if (filtered.length === 0) return;

    const headers = Object.keys(filtered[0]).join(',');
    const rows = filtered.map((row) => Object.values(row).join(','));
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

    const filtered = getFilteredData();
    if (filtered.length === 0) return;

    const headers = Object.keys(filtered[0]);
    const rowsHtml = filtered
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
    const generatedAt = new Date().toLocaleString();

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #f9fafb; color: #111827; }
      .vh-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .vh-brand { font-size: 18px; font-weight: 700; color: #16a34a; }
      .vh-meta { font-size: 11px; color: #6b7280; text-align: right; }
      h1 { font-size: 20px; margin: 4px 0 2px 0; }
      p { font-size: 12px; margin-top: 0; color: #6b7280; }
      hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0 16px 0; }
      table { border-collapse: collapse; width: 100%; margin-top: 4px; }
      @media print {
        body { background: #ffffff; }
      }
    </style>
  </head>
  <body>
    <div class="vh-header">
      <div class="vh-brand">VentureHub Admin</div>
      <div class="vh-meta">
        <div>${title}</div>
        <div>Generated: ${generatedAt}</div>
      </div>
    </div>
    <h1>${title}</h1>
    <p>Platform report exported from VentureHub admin panel.</p>
    <hr />
    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    // Give the browser a moment to render before triggering print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  const getRowDate = (row) => {
    const raw = row.createdAt;
    if (!raw) return null;
    if (raw.toDate && typeof raw.toDate === 'function') {
      return raw.toDate();
    }
    if (raw.seconds && typeof raw.seconds === 'number') {
      return new Date(raw.seconds * 1000);
    }
    // Fallback: try Date constructor
    const d = new Date(raw);
    // eslint-disable-next-line no-restricted-globals
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getFilteredData = () => {
    let filtered = [...reportData];

    // Apply date range filter for all report types
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

      filtered = filtered.filter((row) => {
        const d = getRowDate(row);
        if (!d) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    // Extra status filter for bookings report only
    if (reportType !== 'bookings' || statusFilter === 'all') return filtered;

    return filtered.filter((row) => {
      const status = (row.status || '').toString().toLowerCase();
      // If no explicit status on the booking, treat as pending so it still shows
      if (!status) {
        return statusFilter === 'pending';
      }

      if (statusFilter === 'completed') {
        return status === 'confirmed' || status === 'completed';
      }
      if (statusFilter === 'pending') {
        return status === 'pending';
      }
      if (statusFilter === 'declined') {
        return status === 'rejected' || status === 'declined' || status === 'cancelled' || status === 'canceled';
      }
      return true;
    });
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
          <div className="flex flex-wrap gap-4 mb-4 items-center">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="bookings">Bookings Report</option>
              <option value="earnings">Earnings Report</option>
              <option value="hosts">Hosts Report</option>
            </select>
            {reportType === 'bookings' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="declined">Declined</option>
              </select>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="font-semibold mr-1">Date range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1"
              />
            </div>
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
                    {Object.keys(getFilteredData()[0] || reportData[0]).map((key) => (
                      <th
                        key={key}
                        className="text-left py-2 px-4 text-xs font-semibold text-gray-600 whitespace-nowrap border-b"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getFilteredData().map((row, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50/80">
                      {Object.values(row).map((value, i) => (
                        <td
                          key={i}
                          className="py-2 px-4 align-top text-gray-800 text-xs whitespace-pre-wrap break-words max-w-xs"
                        >
                          {String(value)}
                        </td>
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
