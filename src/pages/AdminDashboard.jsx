import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalHosts: 0,
    totalListings: 0,
    totalBookings: 0,
    totalEarnings: 0,
    subscriptionRevenue: 0,
    totalSubscriptions: 0,
    totalTransactions: 0,
    totalReviews: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentHosts, setRecentHosts] = useState([]);
  const [recentRefunds, setRecentRefunds] = useState([]);
  const [userBreakdown, setUserBreakdown] = useState({ guests: 0, hosts: 0, admins: 0 });
  const [topListings, setTopListings] = useState([]);
  const [topReviews, setTopReviews] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [timeFilter, setTimeFilter] = useState('month');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch total users and role breakdown
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(usersRef);
        let totalUsers = 0;
        let guests = 0;
        let hostsCount = 0;
        let admins = 0;
        usersSnap.forEach((docSnap) => {
          totalUsers += 1;
          const data = docSnap.data();
          if (data.role === 'guest') guests += 1;
          if (data.role === 'host') hostsCount += 1;
          if (data.role === 'admin') admins += 1;
        });

        // Fetch total hosts
        const hostsRef = collection(db, 'hosts');
        const hostsSnap = await getDocs(hostsRef);
        const totalHosts = hostsSnap.size;

        // Fetch total listings
        const listingsRef = collection(db, 'listings');
        const listingsSnap = await getDocs(listingsRef);
        const totalListings = listingsSnap.size;

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

        // Fetch total subscriptions (hosts with subscriptionPlan) and subscription revenue
        let totalSubscriptions = 0;
        let subscriptionRevenue = 0;
        hostsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.subscriptionPlan) totalSubscriptions += 1;
          if (typeof data.subscriptionPrice === 'number') {
            subscriptionRevenue += data.subscriptionPrice;
          }
        });

        // Fetch total transactions from walletTransactions
        let totalTransactions = 0;
        const txRef = collection(db, 'walletTransactions');
        const txSnap = await getDocs(txRef);
        totalTransactions = txSnap.size;

        setStats({
          totalUsers,
          totalHosts,
          totalListings,
          totalBookings,
          totalEarnings,
          subscriptionRevenue,
          totalSubscriptions,
          totalTransactions,
        });
        setUserBreakdown({ guests, hosts: hostsCount, admins });
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

        // Reviews for analytics-style cards
        const reviewsRef = collection(db, 'reviews');
        const reviewsSnap = await getDocs(reviewsRef);
        const reviewsData = [];
        reviewsSnap.forEach((docSnap) => {
          reviewsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        setReviews(reviewsData);

        // Top performing listings based on booking count
        const counts = new Map();
        bookings.forEach((b) => {
          const key = b.listingId || b.listingTitle || b.id;
          if (!key) return;
          const existing = counts.get(key) || {
            key,
            listingTitle: b.listingTitle || 'Listing',
            bookings: 0,
          };
          existing.bookings += 1;
          counts.set(key, existing);
        });
        const topListingsArr = Array.from(counts.values()).sort((a, b) => b.bookings - a.bookings);
        setTopListings(topListingsArr.slice(0, 5));

        // Top reviews by rating
        const topReviewsArr = reviewsData
          .filter((r) => typeof r.rating === 'number')
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5);
        setTopReviews(topReviewsArr);

        // Aggregate review stats for dashboard cards
        let ratingSum = 0;
        let ratingCount = 0;
        reviewsData.forEach((r) => {
          if (typeof r.rating === 'number') {
            ratingSum += r.rating;
            ratingCount += 1;
          }
        });
        const averageRating = ratingCount ? ratingSum / ratingCount : 0;
        setStats((prev) => ({
          ...prev,
          totalReviews: reviewsData.length,
          averageRating,
        }));
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
    <div className="min-h-screen bg-green-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back! Here’s your platform overview.</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/70 border border-gray-200 rounded-full px-1 py-1 shadow-sm">
            <button
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-full ${timeFilter === 'week' ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}
              onClick={() => setTimeFilter('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-full ${timeFilter === 'month' ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}
              onClick={() => setTimeFilter('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-full ${timeFilter === 'year' ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}
              onClick={() => setTimeFilter('year')}
            >
              Year
            </button>
          </div>
        </div>

        {/* Primary stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Users</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalUsers}</p>
            <p className="mt-1 text-xs text-gray-500">
              {loading
                ? '—'
                : `${userBreakdown.guests} Guests • ${userBreakdown.hosts} Hosts • ${userBreakdown.admins} Admins`}
            </p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Listings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalListings}</p>
            <p className="mt-1 text-xs text-gray-500">All published listings across hosts.</p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Bookings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalBookings}</p>
            <p className="mt-1 text-xs text-gray-500">Confirmed + pending reservations.</p>
          </div>
        </div>

        {/* Secondary stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Subscription Revenue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {loading ? '—' : `₱${stats.subscriptionRevenue.toLocaleString()}`}
            </p>
            <p className="mt-1 text-xs text-gray-500">Based on current host subscription plans.</p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Active Subscriptions</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalSubscriptions}</p>
            <p className="mt-1 text-xs text-gray-500">Hosts with an active plan.</p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Transactions</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalTransactions}</p>
            <p className="mt-1 text-xs text-gray-500">Wallet transactions recorded.</p>
          </div>
        </div>

        {/* Reviews summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/90 border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Guest Reviews</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : stats.totalReviews}</p>
            <p className="mt-1 text-xs text-gray-500">
              {loading || !stats.totalReviews
                ? 'No reviews recorded yet.'
                : `Average rating ${stats.averageRating.toFixed(1)} / 5`}
            </p>
          </div>
        </div>

        {/* Top listings & reviews row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-600 text-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Top Performing Listings</h2>
            {topListings.length === 0 ? (
              <p className="text-sm text-emerald-100">No booking data yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topListings.map((l, index) => (
                  <li
                    key={l.key}
                    className="flex items-center justify-between bg-emerald-700/50 rounded-xl px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-white text-green-700 text-xs font-semibold">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium truncate max-w-[180px]">{l.listingTitle}</p>
                        <p className="text-green-100 text-xs">Stays / Services</p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold">{l.bookings} bookings</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-green-100 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Top Reviews</h2>
            {topReviews.length === 0 ? (
              <p className="text-sm text-gray-600">No reviews yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topReviews.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <div className="truncate">
                      <p className="font-medium truncate max-w-[180px]">
                        {r.listingTitle || 'Listing'}
                      </p>
                      <p className="text-gray-500 text-xs truncate max-w-[220px]">
                        {r.comment || 'No comment'}
                      </p>
                    </div>
                    <p className="text-yellow-500 text-sm font-semibold whitespace-nowrap">
                      ⭐ {typeof r.rating === 'number' ? r.rating.toFixed(1) : r.rating}/5
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white border border-green-100 rounded-2xl p-6 shadow-sm">
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
