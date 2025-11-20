import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminAnalyticsPage() {
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [hostEarnings, setHostEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionRevenue, setSubscriptionRevenue] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch reviews
        const reviewsRef = collection(db, 'reviews');
        const reviewsSnap = await getDocs(reviewsRef);
        const reviewsData = [];
        reviewsSnap.forEach((docSnap) => {
          reviewsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        setReviews(reviewsData);

        // Fetch bookings
        const bookingsRef = collection(db, 'bookings');
        const bookingsSnap = await getDocs(bookingsRef);
        const bookingsData = [];
        bookingsSnap.forEach((docSnap) => {
          bookingsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        setBookings(bookingsData);

        // Fetch host earnings
        const earningsRef = collection(db, 'hostEarnings');
        const earningsSnap = await getDocs(earningsRef);
        const earningsData = [];
        earningsSnap.forEach((docSnap) => {
          earningsData.push({ id: docSnap.id, ...docSnap.data() });
        });
        setHostEarnings(earningsData);

        // Fetch hosts to compute subscription revenue (sum of subscriptionPrice)
        const hostsRef = collection(db, 'hosts');
        const hostsSnap = await getDocs(hostsRef);
        let subscriptionTotal = 0;
        hostsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (typeof data.subscriptionPrice === 'number') {
            subscriptionTotal += data.subscriptionPrice;
          }
        });
        setSubscriptionRevenue(subscriptionTotal);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading analytics data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const bestReviews = reviews.filter((r) => r.rating >= 4).sort((a, b) => b.rating - a.rating);
  const lowestReviews = reviews.filter((r) => r.rating <= 2).sort((a, b) => a.rating - b.rating);

  // Bookings analytics
  const totalBookings = bookings.length;
  const bookingsByStatus = bookings.reduce(
    (acc, b) => {
      const key = b.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {},
  );

  // Revenue analytics from hostEarnings
  let totalRevenue = 0;
  let topHosts = [];
  if (hostEarnings.length > 0) {
    hostEarnings.forEach((h) => {
      const amount = typeof h.totalEarnings === 'number' ? h.totalEarnings : 0;
      totalRevenue += amount;
    });
    topHosts = [...hostEarnings]
      .map((h) => ({
        id: h.id,
        hostName: h.hostName || h.displayName || h.id,
        totalEarnings: typeof h.totalEarnings === 'number' ? h.totalEarnings : 0,
      }))
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, 5);
  }

  return (
    <div className="min-h-screen bg-green-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Analytics</h1>
            <p className="text-gray-600">Insights into bookings, revenue, and reviews.</p>
          </div>
        </div>

        {/* Summary cards: bookings + revenue */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Bookings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loading ? '—' : totalBookings}</p>
          </div>
          <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Bookings by Status</p>
            {loading ? (
              <p className="mt-2 text-sm text-gray-600">Loading...</p>
            ) : totalBookings === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No bookings yet.</p>
            ) : (
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                {Object.entries(bookingsByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="capitalize">{status}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Subscription Revenue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {loading ? '—' : `₱${subscriptionRevenue.toLocaleString()}`}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {loading
                ? '—'
                : `Host earnings recorded: ₱${totalRevenue.toLocaleString()}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Best Reviews */}
          <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Best Reviews</h2>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : bestReviews.length === 0 ? (
              <p className="text-sm text-gray-600">No high-rated reviews yet.</p>
            ) : (
              <ul className="space-y-2">
                {bestReviews.slice(0, 5).map((review) => (
                  <li key={review.id} className="text-sm">
                    <span className="font-medium">⭐ {review.rating}/5</span> - {review.comment || 'No comment'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lowest Reviews */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lowest Reviews</h2>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : lowestReviews.length === 0 ? (
              <p className="text-sm text-gray-600">No low-rated reviews yet.</p>
            ) : (
              <ul className="space-y-2">
                {lowestReviews.slice(0, 5).map((review) => (
                  <li key={review.id} className="text-sm">
                    <span className="font-medium">⭐ {review.rating}/5</span> - {review.comment || 'No comment'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Top earning hosts */}
        <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Earning Hosts</h2>
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : topHosts.length === 0 ? (
            <p className="text-sm text-gray-600">No earnings data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Host</th>
                    <th className="text-left py-2">Total Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {topHosts.map((host) => (
                    <tr key={host.id} className="border-b">
                      <td className="py-2">{host.hostName}</td>
                      <td className="py-2">₱{host.totalEarnings.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bookings List */}
        <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Bookings</h2>
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-gray-600">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Listing</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Total Price</th>
                    <th className="text-left py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b">
                      <td className="py-2">{booking.listingTitle || 'N/A'}</td>
                      <td className="py-2">{booking.status || 'N/A'}</td>
                      <td className="py-2">₱{booking.totalPrice || 0}</td>
                      <td className="py-2">{booking.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}</td>
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
