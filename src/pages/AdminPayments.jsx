import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminPaymentsPage() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | subscribed | not-subscribed

  useEffect(() => {
    const fetchHosts = async () => {
      try {
        const hostsRef = collection(db, 'hosts');
        const snap = await getDocs(hostsRef);
        const data = [];
        snap.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() });
        });
        setHosts(data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading host subscriptions', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHosts();
  }, []);

  const filteredHosts = hosts.filter((h) => {
    const hasPlan = !!h.subscriptionPlan;
    if (filter === 'subscribed') return hasPlan;
    if (filter === 'not-subscribed') return !hasPlan;
    return true;
  });

  const handlePrint = () => {
    const generatedAt = new Date().toLocaleString();

    const rows = filteredHosts
      .map((host) => {
        const updatedAt = host.updatedAt?.toDate ? host.updatedAt.toDate() : null;
        const price =
          typeof host.subscriptionPrice === 'number'
            ? `₱${host.subscriptionPrice.toFixed(2)}`
            : '—';
        const listingLimit =
          host.listingLimit === null || host.listingLimit === undefined
            ? 'Unlimited'
            : typeof host.listingLimit === 'number'
              ? `${host.listingLimit} listings`
              : 'Not set';

        return `
          <tr>
            <td>${host.id}</td>
            <td>${host.displayName || host.hostName || 'N/A'}</td>
            <td>${host.subscriptionPlan || 'Not subscribed'}</td>
            <td>${price}</td>
            <td>${listingLimit}</td>
            <td>${updatedAt ? updatedAt.toLocaleString() : '—'}</td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>Host Subscriptions Report</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #f9fafb; color: #111827; }
      .vh-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .vh-brand { font-size: 18px; font-weight: 700; color: #16a34a; }
      .vh-meta { font-size: 11px; color: #6b7280; text-align: right; }
      h1 { font-size: 20px; margin: 4px 0 2px 0; }
      p { font-size: 13px; margin-top: 0; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; font-weight: 600; }
      tr:nth-child(even) { background: #f9fafb; }
      @media print { body { background: #ffffff; } }
    </style>
  </head>
  <body>
    <div class="vh-header">
      <div class="vh-brand">VentureHub Admin</div>
      <div class="vh-meta">
        <div>Host Subscriptions Report</div>
        <div>Generated: ${generatedAt}</div>
      </div>
    </div>
    <h1>Host Subscriptions</h1>
    <p>Overview of host subscription plans, pricing, and listing limits.</p>
    <table>
      <thead>
        <tr>
          <th>Host ID</th>
          <th>Host Name</th>
          <th>Subscription Plan</th>
          <th>Price</th>
          <th>Listing Limit</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6">No hosts found for the selected filter.</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-green-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Host Subscriptions</h1>
            <p className="text-gray-600">
              View which hosts are subscribed to paid plans and what benefits they receive.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Filter by subscription status</p>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="mt-1 border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All hosts</option>
                <option value="subscribed">Subscribed hosts</option>
                <option value="not-subscribed">Not subscribed</option>
              </select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading host subscriptions...</p>
          ) : filteredHosts.length === 0 ? (
            <p className="text-sm text-gray-600">No hosts found for the selected filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Host</th>
                    <th className="text-left py-2 px-2">Subscription Plan</th>
                    <th className="text-left py-2 px-2">Price</th>
                    <th className="text-left py-2 px-2">Listing Limit</th>
                    <th className="text-left py-2 px-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHosts.map((host) => {
                    const updatedAt = host.updatedAt?.toDate ? host.updatedAt.toDate() : null;
                    const price =
                      typeof host.subscriptionPrice === 'number'
                        ? `₱${host.subscriptionPrice.toFixed(2)}`
                        : '—';
                    const listingLimit =
                      host.listingLimit === null || host.listingLimit === undefined
                        ? 'Unlimited'
                        : typeof host.listingLimit === 'number'
                          ? `${host.listingLimit} listings`
                          : 'Not set';

                    const hostDisplay =
                      host.displayName ||
                      host.hostName ||
                      host.name ||
                      host.email ||
                      host.id;

                    return (
                      <tr key={host.id} className="border-b">
                        <td className="py-2 px-2">{hostDisplay}</td>
                        <td className="py-2 px-2">{host.subscriptionPlan || 'Not subscribed'}</td>
                        <td className="py-2 px-2">{price}</td>
                        <td className="py-2 px-2">{listingLimit}</td>
                        <td className="py-2 px-2 text-xs text-gray-500">
                          {updatedAt ? updatedAt.toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
