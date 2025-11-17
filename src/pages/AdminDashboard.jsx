import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalHosts: 0,
    totalBookings: 0,
    totalEarnings: 0,
    totalSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch total hosts
        const hostsRef = collection(db, 'hosts');
        const hostsSnap = await getDocs(hostsRef);
        const totalHosts = hostsSnap.size;

        // Fetch total bookings
        const bookingsRef = collection(db, 'bookings');
        const bookingsSnap = await getDocs(bookingsRef);
        const totalBookings = bookingsSnap.size;

        // Fetch total earnings (sum from hostEarnings)
        let totalEarnings = 0;
        const earningsRef = collection(db, 'hostEarnings');
        const earningsSnap = await getDocs(earningsRef);
        earningsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          totalEarnings += data.totalEarnings || 0;
        });

        // Fetch total subscriptions (hosts with subscriptionPlan)
        let totalSubscriptions = 0;
        hostsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.subscriptionPlan) totalSubscriptions += 1;
        });

        setStats({
          totalHosts,
          totalBookings,
          totalEarnings,
          totalSubscriptions,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading admin stats', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
            <p className="text-gray-600">Platform overview and key metrics.</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total hosts</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalHosts}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total bookings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalBookings}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total earnings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {loading ? '—' : `₱${stats.totalEarnings.toLocaleString()}`}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Active subscriptions</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalSubscriptions}</p>
          </div>
        </div>

        {/* Placeholder for more sections */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-sm text-gray-600">Recent bookings, host registrations, and platform updates will be displayed here.</p>
        </div>
      </div>
    </div>
  );
}
