import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const paymentsRef = collection(db, 'payments');
        const snap = await getDocs(paymentsRef);
        const data = [];
        snap.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() });
        });
        setPayments(data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading payments', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const updatePaymentStatus = async (paymentId, status) => {
    try {
      const ref = doc(db, 'payments', paymentId);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status } : p))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating payment status', err);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (statusFilter === 'all') return true;
    const status = (p.status || '').toString().toLowerCase();
    if (!status) return statusFilter === 'pending';
    if (statusFilter === 'pending') return status === 'pending';
    if (statusFilter === 'approved') return status === 'approved' || status === 'confirmed';
    if (statusFilter === 'rejected') return status === 'rejected' || status === 'declined';
    return true;
  });

  return (
    <div className="min-h-screen bg-green-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Host Payout Requests</h1>
            <p className="text-gray-600">Review and approve payout requests from hosts.</p>
          </div>
        </div>

        <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Filter by status</p>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All payouts</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading payments...</p>
          ) : filteredPayments.length === 0 ? (
            <p className="text-sm text-gray-600">No payouts found for the selected filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Host ID</th>
                    <th className="text-left py-2">Booking ID</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Method</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="py-2">{payment.hostId || 'N/A'}</td>
                      <td className="py-2">{payment.bookingId || 'N/A'}</td>
                      <td className="py-2">{payment.amount || 0}</td>
                      <td className="py-2">{payment.method || 'N/A'}</td>
                      <td className="py-2 capitalize">{payment.status || 'pending'}</td>
                      <td className="py-2">
                        {payment.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(payment.id, 'approved')}
                              className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                            >
                              Approve payout
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(payment.id, 'rejected')}
                              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
