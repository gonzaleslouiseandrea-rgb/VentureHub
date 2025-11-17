import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../airbnb.css';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import useFavorites from '../hooks/useFavorites.js';

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkIn, setCheckIn] = useState(null);
  const [checkOut, setCheckOut] = useState(null);
  const [guests, setGuests] = useState(1);
  const [promoCode, setPromoCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [shareMessage, setShareMessage] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);

  const [expandedImage, setExpandedImage] = useState(null);

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

  const getDateRangeText = () => {
    if (!checkIn && !checkOut) return 'Check-in & Check-out';
    const formatDate = (date) => {
      if (!date) return '';
      try {
        let dateObj;
        if (date instanceof Date) {
          dateObj = date;
        } else if (typeof date === 'string') {
          dateObj = new Date(date);
        } else if (typeof date === 'object' && date.toDate) {
          // Firebase Timestamp
          dateObj = date.toDate();
        } else {
          return '';
        }
        if (isNaN(dateObj.getTime())) return '';
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return '';
      }
    };
    if (checkIn && !checkOut) return `${formatDate(checkIn)} → Select check-out`;
    if (checkIn && checkOut) {
      return `${formatDate(checkIn)} → ${formatDate(checkOut)}`;
    }
    return 'Check-in & Check-out';
  };

  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    setCheckIn(start || null);
    setCheckOut(end || null);
  };

  const getAvailabilityBounds = () => {
    if (!listing) return { min: new Date(), max: null };
    let min = new Date();
    let max = null;

    if (listing.availabilityStart) {
      const s = new Date(listing.availabilityStart);
      if (!Number.isNaN(s.getTime())) min = s;
    }
    if (listing.availabilityEnd) {
      const e = new Date(listing.availabilityEnd);
      if (!Number.isNaN(e.getTime())) max = e;
    }
    return { min, max };
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    try {
      let startDate, endDate;
      
      // Handle different date formats
      if (checkIn instanceof Date) {
        startDate = checkIn;
      } else if (typeof checkIn === 'string') {
        startDate = new Date(checkIn);
      } else if (typeof checkIn === 'object' && checkIn.toDate) {
        startDate = checkIn.toDate();
      } else {
        return 0;
      }

      if (checkOut instanceof Date) {
        endDate = checkOut;
      } else if (typeof checkOut === 'string') {
        endDate = new Date(checkOut);
      } else if (typeof checkOut === 'object' && checkOut.toDate) {
        endDate = checkOut.toDate();
      } else {
        return 0;
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
      return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  const computeBookingTotal = () => {
    if (!listing) return 0;
    const nights = calculateNights();
    if (!nights || !listing.rate) return 0;
    const subtotal = listing.rate * nights;
    const effectiveDiscount = discountApplied ? (listing.discount || 0) : 0;
    const discountAmount = Math.round((subtotal * effectiveDiscount) / 100);
    const total = subtotal - discountAmount;
    return total > 0 ? total : 0;
  };

  const handleApplyPromo = () => {
    if (!listing || !listing.promo) {
      setPromoMessage('No promo is configured for this listing.');
      setDiscountApplied(false);
      return;
    }

    if (!promoCode.trim()) {
      setPromoMessage('Enter a promo code.');
      setDiscountApplied(false);
      return;
    }

    const expected = String(listing.promo).trim().toLowerCase();
    const entered = promoCode.trim().toLowerCase();
    if (entered === expected) {
      setDiscountApplied(true);
      setPromoMessage('Promo applied.');
    } else {
      setDiscountApplied(false);
      setPromoMessage('Promo code not valid for this listing.');
    }
  };

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        const ref = doc(db, 'listings', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setListing({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading listing', err);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  // Load guest wallet balance
  useEffect(() => {
    const loadWallet = async () => {
      if (!user) {
        setWalletBalance(0);
        setWalletLoading(false);
        return;
      }

      try {
        setWalletLoading(true);
        const walletRef = doc(db, 'wallets', user.uid);
        const snap = await getDoc(walletRef);
        if (snap.exists()) {
          const data = snap.data();
          const bal = typeof data.balance === 'number' ? data.balance : 0;
          setWalletBalance(bal);
        } else {
          setWalletBalance(0);
        }
      } catch {
        setWalletBalance(0);
      } finally {
        setWalletLoading(false);
      }
    };

    loadWallet();
  }, [user]);

  useEffect(() => {
    if (!user || !id) {
      setChatMessages([]);
      setChatLoading(false);
      return;
    }

    try {
      setChatLoading(true);
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('listingId', '==', id),
        where('guestId', '==', user.uid),
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const sortedItems = items.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
            const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
            return aTime - bTime;
          });
          setChatMessages(sortedItems);
          setChatLoading(false);
        },
        () => {
          setChatMessages([]);
          setChatLoading(false);
        },
      );

      return () => unsubscribe();
    } catch {
      setChatMessages([]);
      setChatLoading(false);
    }
  }, [id, user]);

  const handleShare = async () => {
    try {
      const shareUrl = window.location.href;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('Link copied to clipboard!');
        setTimeout(() => setShareMessage(''), 3000);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setShareMessage('Link copied to clipboard!');
        setTimeout(() => setShareMessage(''), 3000);
      }
    } catch (err) {
      setShareMessage('Failed to copy link');
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  const handleBookingClick = () => {
    setBookingError('');
    setBookingSuccess('');

    if (!user) {
      navigate('/login');
      return;
    }

    if (!checkIn || !checkOut) {
      setBookingError('Please select check-in and check-out dates.');
      return;
    }
    if (checkOut < checkIn) {
      setBookingError('Check-out must be after check-in.');
      return;
    }
    if (!listing || !listing.rate) {
      setBookingError('This listing is missing a valid rate.');
      return;
    }
    if (guests < 1) {
      setBookingError('Guest count must be at least 1.');
      return;
    }

    const total = computeBookingTotal();
    if (!total) {
      setBookingError('Unable to calculate total price. Please check your dates.');
      return;
    }

    setShowPayment(true);
  };

  const handleWalletPayment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const total = computeBookingTotal();
    if (!total) {
      setBookingError('Unable to calculate total price for payment.');
      return;
    }

    if (walletLoading) {
      setBookingError('Wallet balance is still loading. Please wait a moment.');
      return;
    }

    if (walletBalance < total) {
      setBookingError('Insufficient wallet balance for this booking.');
      return;
    }

    try {
      setIsProcessing(true);
      setBookingError('');

      const walletRef = doc(db, 'wallets', user.uid);
      const walletSnap = await getDoc(walletRef);
      let currentBalance = 0;
      if (walletSnap.exists()) {
        const data = walletSnap.data();
        currentBalance = typeof data.balance === 'number' ? data.balance : 0;
      }

      if (currentBalance < total) {
        setBookingError('Insufficient wallet balance for this booking.');
        setIsProcessing(false);
        return;
      }

      const bookingsRef = collection(db, 'bookings');
      const nights = calculateNights();

      const bookingDoc = await addDoc(bookingsRef, {
        guestId: user.uid,
        hostId: listing.hostId || null,
        listingId: listing.id || id,
        checkIn,
        checkOut,
        guestCount: Number(guests) || 1,
        totalPrice: total,
        nights,
        status: 'pending',
        promoApplied: discountApplied || false,
        promoCode: discountApplied ? promoCode.trim() || null : null,
        paymentMethod: 'wallet',
        paid: true,
        createdAt: serverTimestamp(),
      });

      // Decrement wallet balance
      const newBalance = currentBalance - total;
      await setDoc(
        walletRef,
        {
          balance: newBalance,
          currency: 'PHP',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Record wallet transaction
      const walletTxRef = collection(db, 'walletTransactions');
      await addDoc(walletTxRef, {
        userId: user.uid,
        type: 'spend',
        amount: total,
        currency: 'PHP',
        paypalOrderId: null,
        bookingId: bookingDoc.id,
        createdAt: serverTimestamp(),
      });

      setWalletBalance(newBalance);
      setBookingSuccess('Booking created and paid with your wallet.');
      setShowPayment(false);
      setIsProcessing(false);

      setTimeout(() => {
        navigate('/guest/account', { state: { tab: 'bookings' } });
      }, 800);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error completing wallet booking', err);
      setBookingError('We could not complete your booking with wallet funds. Please try again or use PayPal.');
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      setMessageError('Please enter a message');
      return;
    }
    setMessageError('');
    try {
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        listingId: id,
        guestId: user ? user.uid : null,
        hostId: listing.hostId || null,
        senderId: user ? user.uid : null,
        senderRole: 'guest',
        listingTitle: listing.title || null,
        guestEmail: user?.email || null,
        text: messageText.trim(),
        createdAt: serverTimestamp(),
      });
      setMessageText('');
    } catch (err) {
      setMessageError(err.message || 'Failed to send message');
    }
  };

    if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
            <button
              onClick={() => navigate('/browse')}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition"
            >
              <ArrowBackIcon />
              Back to Browse
            </button>
          </div>
        </header>
        <div className="pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-gray-600">Loading listing...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
            <button
              onClick={() => navigate('/browse')}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition"
            >
              <ArrowBackIcon />
              Back to Browse
            </button>
          </div>
        </header>
        <div className="pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-gray-600">Listing not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 relative">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
            <button
              onClick={() => navigate('/browse')}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition"
            >
              <ArrowBackIcon />
              Back to Browse
            </button>
          </div>
        </header>

        <div className="pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main listing content */}
              <div className="lg:col-span-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-3xl font-bold text-gray-900">{listing.title}</h1>
                      {listing.discount > 0 && (
                        <span className="bg-red-600 text-white px-2 py-1 rounded text-sm font-bold">
                          {listing.discount}% OFF
                        </span>
                      )}
                      {listing.promo && (
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-sm font-bold">
                          {listing.promo}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{listing.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(id)}
                        className="p-2 rounded-full bg-white shadow hover:shadow-md"
                        aria-label="toggle favorite"
                      >
                        {favorites.has(id) ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                      </button>
                      <button
                        onClick={handleShare}
                        className="p-2 rounded-full bg-white shadow hover:shadow-md"
                      >
                        <ShareIcon />
                      </button>
                    </div>
                    {shareMessage && (
                      <p className="text-xs text-green-600 font-medium">{shareMessage}</p>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  {(() => {
                    const images =
                      listing.images && listing.images.length > 0
                        ? listing.images
                        : listing.imageUrls && listing.imageUrls.length > 0
                        ? listing.imageUrls
                        : listing.coverImage
                        ? [listing.coverImage]
                        : [];

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 h-96 bg-gray-200 rounded-lg overflow-hidden">
                          {images.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedImage(images[0])}
                              className="w-full h-full text-left"
                            >
                              <img
                                src={images[0]}
                                alt={listing.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </button>
                          ) : (
                            <div className="w-full h-full bg-gray-100" />
                          )}
                        </div>
                        <div className="space-y-2">
                          {images.slice(1, 5).map((img, idx) => (
                            <div key={idx} className="h-24 bg-gray-100 rounded-md overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedImage(img)}
                                className="w-full h-full text-left"
                              >
                                <img
                                  src={img}
                                  alt={`${listing.title}-${idx}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {listing.promo && (
                  <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Promo Code</h2>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 font-medium text-lg">{listing.promo}</p>
                      <p className="text-green-600 text-sm mt-1">
                        Use this code when booking to get special pricing
                      </p>
                    </div>
                  </section>
                )}

                <section className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">About this space</h2>
                  {listing.description && (
                    <p className="text-gray-700 mb-4">{listing.description}</p>
                  )}

                  {listing.amenities && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Amenities</h3>
                      {Array.isArray(listing.amenities) ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                          {listing.amenities.map((amenity, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span>{amenity}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-700">
                          {String(listing.amenities)}
                        </p>
                      )}
                    </div>
                  )}

                  {(listing.rules || listing.houseRules) && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">House rules</h3>
                      {Array.isArray(listing.rules || listing.houseRules) ? (
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                          {(listing.rules || listing.houseRules).map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-700">
                          {listing.rules || listing.houseRules}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* Booking sidebar */}
              <aside className="lg:col-span-1">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold">
                      {listing.rate ? `₱${listing.rate}` : 'Price'}
                    </div>
                    <div className="text-sm text-gray-600">—</div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {/* Date range picker for guest booking */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Dates
                      </label>
                      <div className="w-full">
                        {(() => {
                          const { min, max } = getAvailabilityBounds();
                          return (
                            <DatePicker
                              selected={checkIn}
                              onChange={handleDateRangeChange}
                              startDate={checkIn}
                              endDate={checkOut}
                              selectsRange
                              minDate={min}
                              maxDate={max || undefined}
                              dateFormat="MMM dd"
                              placeholderText={getDateRangeText()}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 cursor-pointer bg-white text-sm"
                              renderCustomHeader={(headerProps) => (
                                <div className="flex items-center justify-between mb-2 px-1">
                                  <button
                                    type="button"
                                    onClick={headerProps.decreaseMonth}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                                  >
                                    Prev
                                  </button>
                                  <span className="text-sm font-semibold text-gray-800">
                                    {headerProps.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={headerProps.increaseMonth}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                                  >
                                    Next
                                  </button>
                                </div>
                              )}
                            />
                          );
                        })()}
                      </div>
                    </div>

                    <div className="relative">
                      {(() => {
                        const nights = calculateNights();
                        const subtotal = listing.rate * nights;
                        const effectiveDiscount = discountApplied
                          ? listing.discount || 0
                          : 0;
                        const discountAmount = Math.round(
                          (subtotal * effectiveDiscount) / 100,
                        );
                        const total = subtotal - discountAmount;
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                ₱{listing.rate} × {nights} night
                                {nights !== 1 ? 's' : ''}
                              </span>
                              <span>₱{subtotal.toLocaleString()}</span>
                            </div>
                            {effectiveDiscount > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Discount ({effectiveDiscount}%)</span>
                                <span>-₱{discountAmount.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                              <span>Total</span>
                              <span>₱{total.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div>
                      <input
                        type="number"
                        value={guests}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (listing.maxGuests && value > listing.maxGuests) {
                            setGuests(listing.maxGuests);
                          } else if (value < 1) {
                            setGuests(1);
                          } else {
                            setGuests(value);
                          }
                        }}
                        min="1"
                        max={listing.maxGuests || undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500"
                      />
                      {listing.maxGuests && (
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum {listing.maxGuests} guests
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Promo code
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder={
                            listing.promo ? 'Enter code (optional)' : 'No promo available'
                          }
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                        >
                          Apply
                        </button>
                      </div>
                      {promoMessage && (
                        <p
                          className={`mt-1 text-xs ${
                            discountApplied ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {promoMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {bookingError && (
                    <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {bookingError}
                    </div>
                  )}
                  {bookingSuccess && (
                    <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                      {bookingSuccess}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBookingClick}
                    disabled={isProcessing}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 disabled:opacity-60"
                  >
                    {isProcessing ? 'Processing...' : 'Request to Book'}
                  </button>

                  {showPayment && paypalClientId && (
                    <div className="mt-4">
                      <PayPalScriptProvider
                        options={{
                          clientId: paypalClientId,
                          intent: 'capture',
                          currency: 'PHP',
                        }}
                      >
                        <PayPalButtons
                          style={{ layout: 'vertical', shape: 'pill' }}
                          disabled={isProcessing}
                          forceReRender={[computeBookingTotal(), discountApplied, promoCode]}
                          createOrder={(data, actions) => {
                            const total = computeBookingTotal();
                            if (!total) {
                              setBookingError(
                                'Unable to calculate total price for payment.',
                              );
                              return Promise.reject(new Error('Invalid total'));
                            }
                            setIsProcessing(true);
                            return actions.order.create({
                              purchase_units: [
                                {
                                  amount: {
                                    value: total.toString(),
                                    currency_code: 'PHP',
                                  },
                                  description: listing.title || 'VentureHub booking',
                                },
                              ],
                            });
                          }}
                          onApprove={async (data, actions) => {
                            try {
                              setBookingError('');
                              const details = await actions.order.capture();
                              const total = computeBookingTotal();

                              const bookingsRef = collection(db, 'bookings');
                              const nights = calculateNights();

                              await addDoc(bookingsRef, {
                                guestId: user.uid,
                                hostId: listing.hostId || null,
                                listingId: listing.id || id,
                                checkIn,
                                checkOut,
                                guestCount: Number(guests) || 1,
                                totalPrice: total,
                                nights,
                                status: 'pending',
                                promoApplied: discountApplied || false,
                                promoCode: discountApplied
                                  ? promoCode.trim() || null
                                  : null,
                                paypalOrderId: data.orderID || null,
                                paypalPayerId: data.payerID || null,
                                paypalDetails: details || null,
                                createdAt: serverTimestamp(),
                              });

                              setBookingSuccess(
                                'Payment successful! Your booking request has been sent to the host.',
                              );
                              setShowPayment(false);
                              setIsProcessing(false);

                              setTimeout(() => {
                                navigate('/guest/account', {
                                  state: { tab: 'bookings' },
                                });
                              }, 800);
                            } catch (err) {
                              // eslint-disable-next-line no-console
                              console.error('Error completing booking', err);
                              setBookingError(
                                'Payment was captured, but we could not create your booking. Please contact support.',
                              );
                              setIsProcessing(false);
                            }
                          }}
                          onError={(err) => {
                            // eslint-disable-next-line no-console
                            console.error('PayPal error', err);
                            setBookingError(
                              'There was an error processing your PayPal payment. Please try again.',
                            );
                            setIsProcessing(false);
                          }}
                          onCancel={() => {
                            setIsProcessing(false);
                          }}
                        />
                      </PayPalScriptProvider>
                    </div>
                  )}

                  <hr className="my-4" />

                  <div>
                    <h3 className="text-sm font-medium mb-2">Message the host</h3>
                    <div className="mb-3 max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-gray-50 p-2">
                      {chatLoading ? (
                        <p className="text-xs text-gray-500">Loading conversation...</p>
                      ) : chatMessages.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          No messages yet. Start the conversation.
                        </p>
                      ) : (
                        chatMessages.map((msg) => {
                          const isGuest =
                            msg.senderRole === 'guest' || msg.guestId === user?.uid;
                          const createdAt = msg.createdAt?.toDate
                            ? msg.createdAt.toDate()
                            : null;
                          return (
                            <div
                              key={msg.id}
                              className={`mb-2 flex ${
                                isGuest ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-3 py-2 text-xs ${
                                  isGuest
                                    ? 'bg-green-600 text-white rounded-br-none'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">
                                  {msg.text}
                                </p>
                                {createdAt && (
                                  <p className="mt-1 text-[10px] opacity-70">
                                    {createdAt.toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500"
                      placeholder="Ask the host a question"
                    />
                    {messageError && (
                      <div className="text-red-600 text-sm mt-2">{messageError}</div>
                    )}
                    <button
                      onClick={handleSendMessage}
                      className="w-full mt-3 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Send Message
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {bookingError || bookingSuccess ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4">
          <div
            className={`max-w-md min-w-[260px] px-4 py-3 rounded-lg shadow-lg border text-sm flex items-start justify-between gap-3 ${
              bookingError
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            <span>{bookingError || bookingSuccess}</span>
            <button
              type="button"
              onClick={() => {
                if (bookingError) setBookingError('');
                if (bookingSuccess) setBookingSuccess('');
              }}
              className="ml-2 text-xs font-semibold px-2 py-1 rounded-full bg-white/80 text-gray-700 hover:bg-white border border-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] mx-4 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedImage(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full bg-white text-gray-900 shadow"
              aria-label="Close image preview"
            >
              ×
            </button>
            <img
              src={expandedImage}
              alt="Expanded listing"
              className="max-h-[80vh] w-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}