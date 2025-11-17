import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

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
      await updateDoc(ref, { status });
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status } : p))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating payment status', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Payments</h1>
            <p className="text-gray-600">Manage payment methods and statuses.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-600">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-600">No payments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Booking ID</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Method</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="py-2">{payment.bookingId || 'N/A'}</td>
                      <td className="py-2">₱{payment.amount || 0}</td>
                      <td className="py-2">{payment.method || 'N/A'}</td>
                      <td className="py-2">{payment.status || 'pending'}</td>
                      <td className="py-2">
                        {payment.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePaymentStatus(payment.id, 'confirmed')}
                              className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(payment.id, 'reviewed')}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                            >
                              Review
                            </button>
                          </div>
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
