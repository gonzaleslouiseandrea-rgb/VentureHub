import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../airbnb.css';
import { useAuth } from '../auth/AuthContext.jsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState(null);
  const [checkOut, setCheckOut] = useState(null);
  const [guests, setGuests] = useState('');
  const [dateError, setDateError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const getDateRangeText = () => {
    if (!checkIn && !checkOut) return 'Check-in & Check-out';
    if (checkIn && !checkOut) {
      return `${checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → Select check-out`;
    }
    if (checkIn && checkOut) {
      return `${checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Check-in & Check-out';
  };

  const handleSearch = (e) => {
    e && e.preventDefault();
    setDateError('');
    if (checkIn && checkOut && checkOut < checkIn) {
      setDateError('Check-out date must be after check-in date');
      return;
    }
    const params = new URLSearchParams();
    if (location) params.set('where', location);
    if (checkIn) params.set('checkIn', checkIn.toISOString().split('T')[0]);
    if (checkOut) params.set('checkOut', checkOut.toISOString().split('T')[0]);
    if (guests) params.set('guests', guests);
    navigate(`/browse?${params.toString()}`);
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user || user.role === 'host') {
        setNotifications([]);
        return;
      }

      try {
        setLoadingNotifications(true);
        const items = [];

        const bookingsRef = collection(db, 'bookings');
        const qb = query(bookingsRef, where('guestId', '==', user.uid));
        const bookingsSnap = await getDocs(qb);
        bookingsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: `booking-${docSnap.id}`,
            type: 'booking',
            status: data.status,
            createdAt: data.createdAt,
            totalPrice: data.totalPrice,
            listingTitle: data.listingTitle || data.listingTitle || '',
          });
        });

        const refundsRef = collection(db, 'refunds');
        const qr = query(refundsRef, where('guestId', '==', user.uid));
        const refundsSnap = await getDocs(qr);
        refundsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: `refund-${docSnap.id}`,
            type: 'refund',
            status: data.status,
            createdAt: data.createdAt,
            amount: data.amount,
            listingTitle: data.listingTitle || '',
          });
        });

        items.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });

        setNotifications(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading guest notifications', err);
        setNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [user]);

  // Don't render guest header for authenticated hosts
  if (user && user.role === 'host') {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-2xl text-green-700 hover:text-green-800 transition">
          VentureHub
        </Link>

        <div className="flex-1 mx-6">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Where"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="px-3 py-2 rounded-full border border-gray-200 w-44 focus:outline-none focus:ring-1 focus:ring-green-400 text-sm"
            />
            <div className="w-56 relative">
              <DatePicker
                selected={checkIn}
                onChange={(dates) => {
                  const [start, end] = dates;
                  setCheckIn(start || null);
                  setCheckOut(end || null);
                  setDateError('');
                }}
                startDate={checkIn}
                endDate={checkOut}
                selectsRange
                placeholderText={getDateRangeText()}
                dateFormat="MMM dd"
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium cursor-pointer"
                monthsShown={1}
                minDate={new Date()}
              />
            </div>
            <input
              type="number"
              min="1"
              placeholder="Guests"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-200 w-20 focus:outline-none focus:ring-1 focus:ring-green-400 text-sm"
            />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 text-sm font-medium">
              Search
            </button>
          </form>
          {dateError && <div className="text-red-600 text-xs mt-1">{dateError}</div>}
        </div>

        <nav className="flex gap-4 items-center relative">
          {!user && (
            <>
              <Link to="/host/register" className="text-gray-700 hover:text-green-700 font-medium transition">
                Become a host
              </Link>
              <Link to="/login" className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition font-medium">
                Log in
              </Link>
            </>
          )}
          {user && user.role !== 'host' && (
            <>
              <button
                type="button"
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative p-2 rounded-full border border-green-200 hover:bg-green-50 transition flex items-center justify-center"
                aria-label="Notifications"
              >
                <span className="text-lg text-green-700">🔔</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {notifications.length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-10 w-80 bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden z-50 border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="font-semibold">Notifications Center</div>
                    <div className="bg-green-600 text-xs text-white font-semibold px-2 py-0.5 rounded-full">
                      {notifications.length}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <div className="px-4 py-4 text-sm text-gray-500">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-gray-500">You have no notifications yet.</div>
                    ) : (
                      notifications.map((item) => {
                        const createdAt = item.createdAt?.toDate ? item.createdAt.toDate() : null;
                        const isBooking = item.type === 'booking';
                        const titlePrefix = isBooking ? 'Booking' : 'Refund';
                        return (
                          <div
                            key={item.id}
                            className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-default"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">
                                {titlePrefix}
                                {item.status ? ` ${item.status}` : ''}
                              </div>
                              {createdAt && (
                                <div className="text-xs text-gray-500">
                                  {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {item.listingTitle ? `For ${item.listingTitle}` : ''}
                            </div>
                            {isBooking && typeof item.totalPrice === 'number' && (
                              <div className="text-xs text-gray-500 mt-1">Total ₱{item.totalPrice.toFixed(2)}</div>
                            )}
                            {!isBooking && typeof item.amount === 'number' && (
                              <div className="text-xs text-gray-500 mt-1">Amount ₱{item.amount.toFixed(2)}</div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/guest/account', { state: { tab: 'bookings' } })}
                    className="w-full text-center text-sm font-medium py-3 border-t border-gray-800 hover:bg-gray-800"
                  >
                    View all bookings
                  </button>
                </div>
              )}
              <Link
                to="/guest/account"
                className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition flex items-center justify-center"
                aria-label="Account settings"
              >
                <span className="text-lg">⚙️</span>
              </Link>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await logout();
                    navigate('/');
                  } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Error during logout', err);
                  }
                }}
                className="ml-2 px-3 py-1.5 text-xs font-medium rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Log out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
