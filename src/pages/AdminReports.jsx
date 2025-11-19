import { useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState('bookings');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [baseDate, setBaseDate] = useState('');
  const [periodType, setPeriodType] = useState('month'); // 'week' | 'month' | 'year'
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

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

    // Apply date-based period filter (week / month / year) for all report types
    if (baseDate) {
      const base = new Date(`${baseDate}T00:00:00`);
      const start = new Date(base);
      const end = new Date(base);

      if (periodType === 'week') {
        // Start of week (assume Monday)
        const day = start.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // convert Sunday(0) -> previous Monday
        start.setDate(start.getDate() + diff);
        // End of week (Sunday)
        end.setTime(start.getTime());
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (periodType === 'year') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
      } else {
        // Default: month
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0); // last day of month
        end.setHours(23, 59, 59, 999);
      }

      filtered = filtered.filter((row) => {
        const d = getRowDate(row);
        if (!d) return false;
        if (d < start) return false;
        if (d > end) return false;
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

  const calendarWeeks = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const startDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    const days = [];
    for (let i = 0; i < startDay; i += 1) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      days.push(d);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [calendarMonth]);

  const formatDateValue = (year, monthIndex, day) => {
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <div>
                <span className="block font-semibold mb-1">Date:</span>
                <div className="inline-flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    className="px-2 py-1 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                      )}
                  >
                    1
                  </button>
                  <span className="text-xs font-medium text-gray-700">
                    {calendarMonth.toLocaleString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    className="px-2 py-1 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                      )}
                  >
                    7
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-2 bg-white shadow-sm inline-block">
                  <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-gray-500">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarWeeks.map((week, wi) =>
                      week.map((day, di) => {
                        if (!day) {
                          return <span key={`${wi}-${di}`} className="h-7" />;
                        }
                        const value = formatDateValue(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth(),
                          day,
                        );
                        const isSelected = baseDate === value;
                        return (
                          <button
                            key={`${wi}-${di}`}
                            type="button"
                            onClick={() => setBaseDate(value)}
                            className={`h-7 w-7 rounded-full text-[11px] flex items-center justify-center border ${
                              isSelected
                                ? 'bg-green-600 text-white border-green-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Period:</span>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </div>
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
