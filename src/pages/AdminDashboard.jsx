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
  const [activityLoading, setActivityLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentHosts, setRecentHosts] = useState([]);
  const [recentRefunds, setRecentRefunds] = useState([]);

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

    const fetchActivity = async () => {
      try {
        setActivityLoading(true);

        // Recent bookings
        const bookingsRef = collection(db, 'bookings');
        const bookingsSnap = await getDocs(bookingsRef);
        const bookings = [];
        bookingsSnap.forEach((docSnap) => {
          bookings.push({ id: docSnap.id, ...docSnap.data() });
        });
        bookings.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });
        setRecentBookings(bookings.slice(0, 5));

        // Recent hosts
        const hostsRef = collection(db, 'hosts');
        const hostsSnap = await getDocs(hostsRef);
        const hosts = [];
        hostsSnap.forEach((docSnap) => {
          hosts.push({ id: docSnap.id, ...docSnap.data() });
        });
        hosts.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });
        setRecentHosts(hosts.slice(0, 5));

        // Recent refunds
        const refundsRef = collection(db, 'refunds');
        const refundsSnap = await getDocs(refundsRef);
        const refunds = [];
        refundsSnap.forEach((docSnap) => {
          refunds.push({ id: docSnap.id, ...docSnap.data() });
        });
        refunds.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });
        setRecentRefunds(refunds.slice(0, 5));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading recent activity', err);
        setRecentBookings([]);
        setRecentHosts([]);
        setRecentRefunds([]);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchStats();
    fetchActivity();
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

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {activityLoading ? (
            <p className="text-sm text-gray-600">Loading recent activity...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Latest bookings</h3>
                {recentBookings.length === 0 ? (
                  <p className="text-gray-500">No bookings yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentBookings.map((b) => {
                      const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : null;
                      return (
                        <li key={b.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {b.listingTitle || 'Booking'}
                          </span>
                          <span className="text-gray-500">
                            {b.status || 'pending'}
                            {createdAt && ` • ${createdAt.toLocaleDateString()}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">New hosts</h3>
                {recentHosts.length === 0 ? (
                  <p className="text-gray-500">No host records yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentHosts.map((h) => {
                      const createdAt = h.createdAt?.toDate ? h.createdAt.toDate() : null;
                      return (
                        <li key={h.id} className="flex justify-between gap-2">
                          <span className="truncate">{h.displayName || h.email || h.id}</span>
                          <span className="text-gray-500">
                            {createdAt ? createdAt.toLocaleDateString() : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Refund requests</h3>
                {recentRefunds.length === 0 ? (
                  <p className="text-gray-500">No refund records yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentRefunds.map((r) => {
                      const createdAt = r.createdAt?.toDate ? r.createdAt.toDate() : null;
                      return (
                        <li key={r.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {r.listingTitle || 'Refund'}
                          </span>
                          <span className="text-gray-500">
                            {r.status || 'pending'}
                            {createdAt && ` • ${createdAt.toLocaleDateString()}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
