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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Reports</h1>
            <p className="text-gray-600">Generate and download platform reports.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
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
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Generate Report
            </button>
            {reportData.length > 0 && (
              <button
                onClick={downloadCSV}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Download CSV
              </button>
            )}
          </div>
          {loading && <p className="text-sm text-gray-600">Generating report...</p>}
        </div>

        {reportData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
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
