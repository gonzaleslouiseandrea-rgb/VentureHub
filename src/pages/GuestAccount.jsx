import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '../auth/AuthContext.jsx';
import { db, storage, auth } from '../firebase.js';
import Header from '../components/Header.jsx';
import { sendBookingDetails } from '../utils/emailService.js';

export default function GuestAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState('profile');
  const [favorites, setFavorites] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [wishlistPreferences, setWishlistPreferences] = useState([]);
  const [wishlistTags, setWishlistTags] = useState({});
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedBookingForRefund, setSelectedBookingForRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [selectedBookingForWishlist, setSelectedBookingForWishlist] = useState(null);
  const [wishlistText, setWishlistText] = useState('');
  const [submittingWishlist, setSubmittingWishlist] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [walletTx, setWalletTx] = useState([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupProcessing, setTopupProcessing] = useState(false);
  const [topupMessage, setTopupMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [couponError, setCouponError] = useState('');

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

  const availableCategories = [
    { key: 'home', label: 'Homes', emoji: '\ud83c\udfe0' },
    { key: 'experience', label: 'Experiences', emoji: '\ud83c\udfad' },
    { key: 'service', label: 'Services', emoji: '\ud83d\udee0\ufe0f' },
  ];

  // Wishlist chips now mirror the host amenities quick-pick chips from the listing wizard
  // so that selecting the same terms on both sides aligns better for filtering.
  const wishlistSuggestionOptions = {
    home: [
      'Free WiFi',
      'Air conditioning / Heating',
      'Private bathroom',
      'Fresh linens and towels',
      'Complimentary toiletries',
      'Kitchen or kitchenette access',
      'Refrigerator & basic cooking tools',
      'Television / Smart TV',
      'Workspace or desk area',
      'On-site parking / street parking',
      '24/7 security or gated entrance',
      'Laundry facilities (shared or in-unit)',
      'Outdoor seating area / balcony',
      'Essentials: soap, shampoo, toilet paper',
      'Drinking water or electric kettle',
    ],
    experience: [
      'Experienced guide or instructor',
      'Safety equipment (helmets, life vests, etc., if needed)',
      'Materials or supplies for the activity',
      'Introductory orientation or briefing',
      'Snacks or refreshments (if included)',
      'Photos or souvenirs (depending on listing)',
      'Transportation (if stated in listing)',
      'Group or private session options',
      'Printed or digital itinerary',
    ],
    service: [
      'Professional service provider',
      'Necessary tools or equipment (service-specific)',
      'Safety-checked materials and supplies',
      'Transparent pricing before booking',
      'Customer support for concerns',
      'Optional add-ons (if applicable)',
      'Satisfaction guarantee',
      'Service report or summary (when applicable)',
    ],
  };

  const normaliseListField = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
        .filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length > 0);
    }
    return [];
  };

  const buildPreferenceKeywords = () => {
    const keywords = new Set();

    Object.values(wishlistSuggestionOptions).forEach((list) => {
      list.forEach((item) => {
        if (item && typeof item === 'string') {
          keywords.add(item.toLowerCase());
        }
      });
    });

    if (wishlistTags && typeof wishlistTags === 'object') {
      Object.values(wishlistTags).forEach((tags) => {
        if (Array.isArray(tags)) {
          tags.forEach((tag) => {
            if (tag && typeof tag === 'string') {
              keywords.add(tag.toLowerCase());
            }
          });
        }
      });
    }

    return Array.from(keywords);
  };

  // Active wishlist category is single-select: either the first saved preference or default to 'home'
  const activeWishlistCategoryKey = wishlistPreferences[0] || 'home';
  const activeWishlistCategory =
    availableCategories.find((c) => c.key === activeWishlistCategoryKey) || availableCategories[0];

  // Load user's favorite listings
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavorites([]);
        return;
      }
      try {
        const favRef = collection(db, 'favorites');
        const q = query(favRef, where('userId', '==', user.uid));
        const favSnap = await getDocs(q);
        const listingIds = favSnap.docs.map((d) => d.data().listingId);

        const listings = [];
        for (const id of listingIds) {
          const ref = doc(db, 'listings', id);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            listings.push({ id: snap.id, ...snap.data() });
          }
        }
        setFavorites(listings);
      } catch (err) {
        console.error(err);
      }
    };

    fetchFavorites();
  }, [user]);

  // Load active coupons for logged-in guests
  useEffect(() => {
    const loadCoupons = async () => {
      if (!user) {
        setCoupons([]);
        setLoadingCoupons(false);
        return;
      }

      try {
        setLoadingCoupons(true);
        setCouponError('');
        const couponsRef = collection(db, 'coupons');
        const qCoupons = query(couponsRef, where('active', '==', true));
        const snap = await getDocs(qCoupons);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCoupons(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading coupons', err);
        setCouponError(err.message || 'Failed to load coupons.');
        setCoupons([]);
      } finally {
        setLoadingCoupons(false);
      }
    };

    loadCoupons();
  }, [user]);

  // Load and save wishlist preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) {
        setWishlistPreferences([]);
        setLoadingPreferences(false);
        return;
      }
      try {
        const prefRef = doc(db, 'wishlistPreferences', user.uid);
        const snap = await getDoc(prefRef);
        if (snap.exists()) {
          const data = snap.data();
          setWishlistPreferences(data.categories || []);
          setWishlistTags(data.tags || {});
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Load recommendations based on bookings and preferences
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user) {
        setRecommendations([]);
        return;
      }

      const bookedIds = bookings.map((b) => b.listingId).filter(Boolean);

      // Build preference profile from bookings
      let topCategories = [];
      let topLocations = [];
      if (bookings.length > 0) {
        const categoryCounts = {};
        const locationCounts = {};
        bookings.forEach((b) => {
          if (b.listing?.category) {
            categoryCounts[b.listing.category] = (categoryCounts[b.listing.category] || 0) + 1;
          }
          if (b.listing?.location) {
            const city = b.listing.location.split(',')[0].trim();
            locationCounts[city] = (locationCounts[city] || 0) + 1;
          }
        });
        topCategories = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat]) => cat);
        topLocations = Object.entries(locationCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([loc]) => loc);
      }

      // Combine with wishlist preferences
      const combinedCategories = [...new Set([...topCategories, ...wishlistPreferences])];

      if (combinedCategories.length === 0) {
        setRecommendations([]);
        return;
      }

      try {
        const listingsRef = collection(db, 'listings');
        const q = query(
          listingsRef,
          where('category', 'in', combinedCategories),
          where('status', '==', 'published'),
        );
        const snap = await getDocs(q);
        let listings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Exclude already booked listings
        listings = listings.filter((listing) => !bookedIds.includes(listing.id));

        // Further rank by amenities/rules/service fields vs wishlist preferences
        const prefKeywords = buildPreferenceKeywords();

        if (prefKeywords.length > 0) {
          const scored = listings.map((listing) => {
            const amenitiesList = normaliseListField(listing.amenities);
            const rulesList = normaliseListField(listing.rules);
            const serviceCategoryList = normaliseListField(listing.serviceCategory);
            const serviceAreaList = normaliseListField(listing.serviceArea);
            const serviceDurationList = normaliseListField(listing.serviceDuration);
            const serviceTimeSlotsList = normaliseListField(listing.serviceTimeSlots);

            const extraTextTokens = [];
            if (listing.title && typeof listing.title === 'string') {
              extraTextTokens.push(...listing.title.split(/[,/]/));
            }
            if (listing.description && typeof listing.description === 'string') {
              extraTextTokens.push(...listing.description.split(/[,/]/));
            }

            const extraList = normaliseListField(extraTextTokens.join(','));

            const combined = new Set([
              ...amenitiesList,
              ...rulesList,
              ...serviceCategoryList,
              ...serviceAreaList,
              ...serviceDurationList,
              ...serviceTimeSlotsList,
              ...extraList,
            ]);

            let score = 0;
            prefKeywords.forEach((kw) => {
              combined.forEach((item) => {
                if (item.includes(kw) || kw.includes(item)) {
                  score += 1;
                }
              });
            });

            return { listing, score };
          });

          const positives = scored
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

          // Only apply the score filter if at least one listing matches;
          // otherwise keep the broader category-based recommendations.
          if (positives.length > 0) {
            listings = positives.map(({ listing, score }) => ({ ...listing, matchScore: score }));
          }
        }

        setRecommendations(listings);
      } catch (err) {
        console.error('Error loading recommendations:', err);
      }
    };

    fetchRecommendations();
  }, [bookings, wishlistPreferences, wishlistTags, user]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) {
        setBookings([]);
        setLoadingBookings(false);
        return;
      }

      try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(bookingsRef, where('guestId', '==', user.uid));
        const snap = await getDocs(q);
        const results = [];

        for (const bookingDoc of snap.docs) {
          const data = bookingDoc.data();
          const listingRef = doc(db, 'listings', data.listingId);
          const listingSnap = await getDoc(listingRef);
          let listing = null;
          if (listingSnap.exists()) {
            listing = { id: listingSnap.id, ...listingSnap.data() };
          }
          results.push({ id: bookingDoc.id, ...data, listing });
        }

        setBookings(results);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading bookings', err);
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchBookings();
  }, [user]);

  // Load wallet balance and recent transactions
  useEffect(() => {
    const loadWallet = async () => {
      if (!user) {
        setWalletBalance(0);
        setWalletTx([]);
        setWalletLoading(false);
        return;
      }

      try {
        setWalletLoading(true);
        setWalletError('');

        // Wallet balance
        const walletRef = doc(db, 'wallets', user.uid);
        const walletSnap = await getDoc(walletRef);
        if (walletSnap.exists()) {
          const data = walletSnap.data();
          const balance = typeof data.balance === 'number' ? data.balance : 0;
          setWalletBalance(balance);
        } else {
          setWalletBalance(0);
        }

        // Recent transactions
        const txRef = collection(db, 'walletTransactions');
        const qTx = query(txRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
        const txSnap = await getDocs(qTx);
        const items = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWalletTx(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading wallet', err);
        setWalletError('Unable to load wallet information.');
        setWalletBalance(0);
        setWalletTx([]);
      } finally {
        setWalletLoading(false);
      }
    };

    loadWallet();
  }, [user]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const uref = doc(db, 'users', user.uid);
        const snap = await getDoc(uref);
        if (snap.exists()) {
          const data = snap.data();
          setBio(data.bio || '');
          setAvatarUrl(data.photoURL || user.photoURL || '');
          setDisplayName(data.displayName || user.displayName || '');
        } else {
          setBio('');
          setAvatarUrl(user?.photoURL || '');
          setDisplayName(user?.displayName || '');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading profile', err);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Live guest messages subscription
  useEffect(() => {
    if (!user) {
      setMessages([]);
      setLoadingMessages(false);
      return undefined;
    }

    try {
      setLoadingMessages(true);
      const messagesRef = collection(db, 'messages');
      const qMessages = query(
        messagesRef,
        where('guestId', '==', user.uid),
      );

      const unsubscribe = onSnapshot(
        qMessages,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(items);
          setLoadingMessages(false);
        },
        (err) => {
          // eslint-disable-next-line no-console
          console.error('Error loading guest messages', err);
          setMessages([]);
          setLoadingMessages(false);
        },
      );

      return () => unsubscribe();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error subscribing to guest messages', err);
      setMessages([]);
      setLoadingMessages(false);
      return undefined;
    }
  }, [user]);

  const now = new Date();

  const upcomingBookings = bookings.filter((booking) => {
    if (!booking.checkIn) return false;
    const d = booking.checkIn.toDate ? booking.checkIn.toDate() : booking.checkIn;
    return d >= now;
  });

  const pastBookings = bookings.filter((booking) => {
    if (!booking.checkIn) return false;
    const d = booking.checkIn.toDate ? booking.checkIn.toDate() : booking.checkIn;
    return d < now;
  });

  const guestConversations = useMemo(() => {
    const map = new Map();
    messages.forEach((msg) => {
      const listingId = msg.listingId || msg.listingID || 'unknown';
      const hostId = msg.hostId || msg.hostID || 'unknown';
      if (!listingId && !hostId) return;
      const key = `${listingId}::${hostId}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          listingId,
          hostId,
          listingTitle: msg.listingTitle || msg.listingId || 'Conversation',
          hostName: msg.hostName || msg.hostEmail || 'Host',
          hostAvatar: msg.hostPhotoURL || msg.hostAvatar || null,
        });
      }
    });
    return Array.from(map.values());
  }, [messages]);

  const activeConversation = useMemo(() => {
    if (!selectedConversation) return null;
    return guestConversations.find((c) => c.key === selectedConversation) || null;
  }, [guestConversations, selectedConversation]);

  const conversationMessages = useMemo(() => {
    if (!activeConversation) return [];
    return messages
      .filter(
        (m) =>
          (m.listingId === activeConversation.listingId || m.listingID === activeConversation.listingId) &&
          (m.hostId === activeConversation.hostId || m.hostID === activeConversation.hostId),
      )
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return aTime - bTime;
      });
  }, [messages, activeConversation]);

  const toggleFavoriteListing = async (listing) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const favRef = collection(db, 'favorites');
      const q = query(favRef, where('userId', '==', user.uid), where('listingId', '==', listing.id));
      const snap = await getDocs(q);

      if (!snap.empty) {
        // Unfavorite: delete all matching docs and update local state
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        setFavorites((prev) => prev.filter((f) => f.id !== listing.id));
      } else {
        // Favorite: create doc and add to local state if not present
        await addDoc(favRef, {
          userId: user.uid,
          listingId: listing.id,
          createdAt: serverTimestamp(),
        });
        setFavorites((prev) => {
          const exists = prev.some((f) => f.id === listing.id);
          if (exists) return prev;
          return [...prev, listing];
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error toggling favorite listing', err);
    }
  };

  const handleWishlistSubmit = async () => {
    if (!selectedBookingForWishlist || !wishlistText.trim() || !user) return;

    try {
      setSubmittingWishlist(true);
      const suggestionsRef = collection(db, 'hostWishlistSuggestions');
      await addDoc(suggestionsRef, {
        hostId: selectedBookingForWishlist.hostId,
        guestId: user.uid,
        listingId: selectedBookingForWishlist.listingId,
        bookingId: selectedBookingForWishlist.id,
        message: wishlistText.trim(),
        createdAt: serverTimestamp(),
      });

      setMessage('Wishlist suggestion sent to host.');
      setWishlistModalOpen(false);
      setSelectedBookingForWishlist(null);
      setWishlistText('');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error submitting wishlist suggestion', err);
      setMessage('Failed to send wishlist suggestion. Please try again.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSubmittingWishlist(false);
    }
  };

  const togglePreference = async (category) => {
    // Single-select: clicking a category makes it the only active one.
    // (We keep at least one selected; clicking again keeps it active.)
    const updated = [category];

    setWishlistPreferences(updated);

    if (user) {
      try {
        const prefRef = doc(db, 'wishlistPreferences', user.uid);
        await setDoc(prefRef, { categories: updated, tags: wishlistTags }, { merge: true });
      } catch (err) {
        console.error('Error saving preferences:', err);
      }
    }
  };

  const handleGuestSendMessage = async () => {
    if (!user || !selectedConversation || !replyText.trim()) return;
    const conv = guestConversations.find((c) => c.key === selectedConversation);
    if (!conv) return;

    try {
      setSending(true);
      await addDoc(collection(db, 'messages'), {
        listingId: conv.listingId,
        hostId: conv.hostId,
        guestId: user.uid,
        senderId: user.uid,
        senderRole: 'guest',
        text: replyText.trim(),
        createdAt: serverTimestamp(),
      });
      setReplyText('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error sending guest message', err);
    } finally {
      setSending(false);
    }
  };

  const toggleWishlistTag = async (categoryKey, tag) => {
    const currentForCategory = wishlistTags[categoryKey] || [];
    const updatedForCategory = currentForCategory.includes(tag)
      ? currentForCategory.filter((t) => t !== tag)
      : [...currentForCategory, tag];

    const updatedTags = {
      ...wishlistTags,
      [categoryKey]: updatedForCategory,
    };

    setWishlistTags(updatedTags);

    if (user) {
      try {
        const prefRef = doc(db, 'wishlistPreferences', user.uid);
        await setDoc(prefRef, { categories: wishlistPreferences, tags: updatedTags }, { merge: true });
      } catch (err) {
        console.error('Error saving wishlist tags:', err);
      }
    }
  };

  const handleRefundRequest = async () => {
    if (!selectedBookingForRefund || !refundReason.trim()) return;

    try {
      setSubmittingRefund(true);
      const refundRef = collection(db, 'refunds');
      await setDoc(doc(refundRef), {
        bookingId: selectedBookingForRefund.id,
        guestId: user.uid,
        hostId: selectedBookingForRefund.hostId,
        listingId: selectedBookingForRefund.listingId,
        reason: refundReason,
        status: 'pending',
        amount: selectedBookingForRefund.totalPrice,
        createdAt: serverTimestamp(),
      });

      // Update booking status to refund requested
      await updateDoc(doc(db, 'bookings', selectedBookingForRefund.id), {
        refundRequested: true,
        updatedAt: serverTimestamp(),
      });

      setMessage('Refund request submitted successfully.');
      setRefundModalOpen(false);
      setSelectedBookingForRefund(null);
      setRefundReason('');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Error submitting refund request:', err);
      setMessage('Failed to submit refund request. Please try again.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSubmittingRefund(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'bookings', label: 'Bookings', icon: '📅' },
    { id: 'payments', label: 'Payments history', icon: '💸' },
    { id: 'wallet', label: 'Wallet', icon: '💼' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'coupons', label: 'Coupons', icon: '🏷️' },
    { id: 'wishlist-prefs', label: 'Wishlist Preferences', icon: '🎯' },
    { id: 'wishlist', label: 'Favorites', icon: '❤️' },
  ];

  useEffect(() => {
    if (location.state && location.state.tab) {
      const desiredTab = location.state.tab;
      const validIds = new Set(['profile', 'bookings', 'payments', 'wallet', 'messages', 'coupons', 'wishlist-prefs', 'wishlist']);
      if (validIds.has(desiredTab)) {
        setTab(desiredTab);
      }
    }
  }, [location.state]);

  return (
    <PayPalScriptProvider options={{ 'client-id': paypalClientId, currency: 'PHP' }}>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <div className="pt-20 pb-12">
          <div className="max-w-6xl mx-auto px-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Account</h1>
            <p className="text-gray-600">Manage your bookings, wishlist, and profile</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
                <div className="mb-6 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 mb-3 flex items-center justify-center">
                    {avatarUrl ? (
                      // eslint-disable-next-line jsx-a11y/img-redundant-alt
                      <img src={avatarUrl} alt="profile avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-500 text-sm font-medium">
                        {user?.email ? user.email.charAt(0).toUpperCase() : 'G'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-center text-lg font-semibold text-gray-900">
                    {displayName || (user ? user.email.split('@')[0] : 'Guest')}
                  </h3>
                  <p className="text-center text-sm text-gray-600 break-all">{user?.email}</p>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <nav className="space-y-2">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition font-medium flex items-center gap-3 ${
                          tab === t.id
                            ? 'bg-green-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10">
                          {t.icon}
                        </span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                <button
                  onClick={() => navigate('/browse')}
                  className="w-full mt-6 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
                >
                  Browse Stays
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {tab === 'profile' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Profile</h2>
                  <p className="text-gray-600 mb-6">Manage your display name, bio and avatar.</p>

                  {profileLoading ? (
                    <p className="text-gray-600">Loading profile...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 flex flex-col items-center">
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 mb-4">
                          {avatarUrl ? (
                            // eslint-disable-next-line jsx-a11y/img-redundant-alt
                            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No avatar</div>
                          )}
                        </div>
                        <label className="inline-block px-4 py-2 bg-gray-100 rounded-md cursor-pointer text-sm text-gray-700">
                          Change Avatar
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files && e.target.files[0];
                              if (f) {
                                setAvatarFile(f);
                                setAvatarUrl(URL.createObjectURL(f));
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="md:col-span-2">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Display name</label>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">Bio</label>
                            <textarea
                              value={bio}
                              onChange={(e) => setBio(e.target.value)}
                              rows={4}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  setSaving(true);
                                  let photoURL = avatarUrl;
                                  if (avatarFile && user) {
                                    const sref = storageRef(storage, `avatars/${user.uid}/${Date.now()}_${avatarFile.name}`);
                                    await uploadBytes(sref, avatarFile);
                                    photoURL = await getDownloadURL(sref);
                                  }
                                  if (auth.currentUser) {
                                    await updateProfile(auth.currentUser, { displayName, photoURL });
                                  }
                                  if (user) {
                                    await setDoc(doc(db, 'users', user.uid), { displayName, bio, photoURL, updatedAt: serverTimestamp() }, { merge: true });
                                  }
                                  setMessage('Profile saved successfully.');
                                } catch (err) {
                                  // eslint-disable-next-line no-console
                                  console.error('Error saving profile', err);
                                  setMessage('Unable to save profile.');
                                } finally {
                                  setSaving(false);
                                  setTimeout(() => setMessage(''), 4000);
                                }
                              }}
                              disabled={saving}
                              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                            >
                              {saving ? 'Saving...' : 'Save Profile'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                // reset to saved values
                                if (user) {
                                  setDisplayName(user.displayName || '');
                                  setAvatarUrl(user.photoURL || '');
                                  setAvatarFile(null);
                                }
                                // try to reload bio from users doc
                                (async () => {
                                  if (!user) return;
                                  try {
                                    const ud = await getDoc(doc(db, 'users', user.uid));
                                    if (ud.exists()) {
                                      const data = ud.data();
                                      setBio(data.bio || '');
                                    } else {
                                      setBio('');
                                    }
                                  } catch (e) {
                                    // ignore
                                  }
                                })();
                              }}
                              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (!user?.email) return setMessage('No email available to send reset.');
                                try {
                                  await sendPasswordResetEmail(auth, user.email);
                                  setMessage('Password reset email sent.');
                                  setTimeout(() => setMessage(''), 4000);
                                } catch (err) {
                                  // eslint-disable-next-line no-console
                                  console.error('Error sending reset', err);
                                  setMessage('Unable to send password reset.');
                                  setTimeout(() => setMessage(''), 4000);
                                }
                              }}
                              className="ml-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                              Reset Password
                            </button>
                          </div>

                          {message && <div className="text-sm text-gray-700 mt-2">{message}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'coupons' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Available Coupons</h2>
                  <p className="text-gray-600 mb-4">
                    These coupon codes are offered by hosts. Enter a code during booking to apply its discount.
                  </p>

                  {couponError && (
                    <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                      {couponError}
                    </div>
                  )}

                  {loadingCoupons ? (
                    <p className="text-sm text-gray-600">Loading coupons...</p>
                  ) : coupons.length === 0 ? (
                    <p className="text-sm text-gray-500">No coupons are available right now. Check back later.</p>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Code</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Discount</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coupons.map((c) => (
                            <tr key={c.id} className="border-b border-gray-100">
                              <td className="px-4 py-2 font-mono text-sm">{c.code}</td>
                              <td className="px-4 py-2">{typeof c.discountPercent === 'number' ? `${c.discountPercent}%` : ''}</td>
                              <td className="px-4 py-2 text-gray-600">{c.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'wallet' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet</h2>
                  <p className="text-gray-600 mb-6">
                    Top up your wallet with PayPal and use it to pay for bookings.
                  </p>

                  {walletError && (
                    <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {walletError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="md:col-span-1">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current balance</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {walletLoading ? '—' : `₱${walletBalance.toFixed(2)}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Wallet is for in-app payments only.
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-gray-900 mb-3">Top up via PayPal</p>
                        <div className="flex items-center gap-3 mb-3">
                          <input
                            type="number"
                            min="100"
                            step="50"
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                            placeholder="Amount"
                          />
                          <span className="text-xs text-gray-500">Min ₱100, step ₱50</span>
                        </div>

                        <div className="max-w-xs">
                          <PayPalButtons
                            style={{ layout: 'horizontal', shape: 'rect' }}
                            disabled={topupProcessing || !topupAmount || Number(topupAmount) <= 0}
                            createOrder={(data, actions) => {
                              const valueNum = Number(topupAmount);
                              // eslint-disable-next-line no-restricted-globals
                              if (!topupAmount || Number.isNaN(valueNum) || valueNum <= 0) {
                                return Promise.reject(new Error('Invalid amount'));
                              }
                              setTopupProcessing(true);
                              setTopupMessage('');
                              return actions.order.create({
                                purchase_units: [
                                  {
                                    amount: {
                                      value: valueNum.toFixed(2),
                                      currency_code: 'PHP',
                                    },
                                    description: `Wallet top-up for ${user?.email || 'guest'}`,
                                  },
                                ],
                              });
                            }}
                            onApprove={async (data, actions) => {
                              try {
                                const details = await actions.order.capture();
                                const value = Number(
                                  details?.purchase_units?.[0]?.amount?.value || topupAmount || 0,
                                );
                                // eslint-disable-next-line no-restricted-globals
                                const amountNum = Number.isNaN(value) ? 0 : value;
                                if (!amountNum) {
                                  setTopupMessage('Payment captured but amount was invalid.');
                                  setTopupProcessing(false);
                                  return;
                                }

                                const walletRef = doc(db, 'wallets', user.uid);
                                const snap = await getDoc(walletRef);
                                let current = 0;
                                if (snap.exists()) {
                                  const data = snap.data();
                                  current = typeof data.balance === 'number' ? data.balance : 0;
                                }
                                const newBalance = current + amountNum;
                                await setDoc(
                                  walletRef,
                                  {
                                    balance: newBalance,
                                    currency: 'PHP',
                                    updatedAt: serverTimestamp(),
                                  },
                                  { merge: true },
                                );

                                await addDoc(collection(db, 'walletTransactions'), {
                                  userId: user.uid,
                                  type: 'topup',
                                  amount: amountNum,
                                  currency: 'PHP',
                                  paypalOrderId: data.orderID || null,
                                  bookingId: null,
                                  createdAt: serverTimestamp(),
                                });

                                setWalletBalance(newBalance);
                                setTopupMessage('Wallet top-up successful.');

                                // Refresh transactions list locally
                                setWalletTx((prev) => [
                                  {
                                    id: `local-${Date.now()}`,
                                    userId: user.uid,
                                    type: 'topup',
                                    amount: amountNum,
                                    currency: 'PHP',
                                    paypalOrderId: data.orderID || null,
                                    bookingId: null,
                                    createdAt: { toDate: () => new Date() },
                                  },
                                  ...prev,
                                ]);

                                setTopupAmount('');
                              } catch (err) {
                                // eslint-disable-next-line no-console
                                console.error('Error completing wallet top-up', err);
                                setTopupMessage('Unable to complete top-up. Please try again.');
                              } finally {
                                setTopupProcessing(false);
                              }
                            }}
                            onError={(err) => {
                              // eslint-disable-next-line no-console
                              console.error('PayPal wallet top-up error', err);
                              setTopupMessage('There was an error with PayPal. Please try again.');
                              setTopupProcessing(false);
                            }}
                            onCancel={() => {
                              setTopupProcessing(false);
                            }}
                          />
                        </div>

                        {topupMessage && (
                          <p className="mt-2 text-xs text-gray-700">{topupMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent wallet activity</h3>
                    {walletLoading ? (
                      <p className="text-gray-600 text-sm">Loading wallet activity...</p>
                    ) : walletTx.length === 0 ? (
                      <p className="text-gray-600 text-sm">No wallet transactions yet.</p>
                    ) : (
                      <div className="border-t border-gray-200 pt-3 space-y-2 max-h-72 overflow-y-auto">
                        {walletTx.map((tx) => {
                          const createdAt = tx.createdAt?.toDate ? tx.createdAt.toDate() : null;
                          const sign = tx.type === 'topup' || tx.type === 'refund' ? '+' : '-';
                          const color = sign === '+' ? 'text-green-700' : 'text-red-700';
                          const label =
                            tx.type === 'topup'
                              ? 'Wallet top-up'
                              : tx.type === 'spend'
                                ? 'Booking payment'
                                : tx.type === 'refund'
                                  ? 'Refund received'
                                  : 'Wallet activity';

                          return (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-b-0"
                            >
                              <div>
                                <p className="text-gray-900">{label}</p>
                                {createdAt && (
                                  <p className="text-xs text-gray-500">{createdAt.toLocaleString()}</p>
                                )}
                              </div>
                              <div className={`font-semibold ${color}`}>
                                {sign}₱{(tx.amount || 0).toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}



              {tab === 'messages' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Messages</h2>
                  <p className="text-gray-600 mb-6">
                    Chat with hosts about your bookings.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Conversations list */}
                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col h-80 md:h-[26rem] md:col-span-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversations</h3>
                      {loadingMessages ? (
                        <p className="text-sm text-gray-600">Loading messages...</p>
                      ) : guestConversations.length === 0 ? (
                        <p className="text-sm text-gray-600">You have no messages yet.</p>
                      ) : (
                        <div className="flex-1 overflow-y-auto space-y-2">
                          {guestConversations.map((conv) => (
                            <button
                              key={conv.key}
                              type="button"
                              onClick={() => setSelectedConversation(conv.key)}
                              className={`w-full text-left px-3 py-2 rounded-md border text-sm transition flex flex-col ${
                                selectedConversation === conv.key
                                  ? 'bg-green-50 border-green-400'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700 overflow-hidden">
                                  {conv.hostAvatar ? (
                                    <img
                                      src={conv.hostAvatar}
                                      alt={conv.hostName || 'Host avatar'}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span>
                                      {(conv.hostName || 'H').charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-gray-900 truncate">
                                    {conv.hostName || 'Host'}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Active conversation */}
                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col h-80 md:h-[26rem] md:col-span-3">
                      {!activeConversation ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                          Select a conversation to view messages.
                        </div>
                      ) : (
                        <>
                          <div className="mb-3 border-b border-gray-200 pb-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {activeConversation.listingTitle || 'Conversation'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {activeConversation.hostName ? `Host: ${activeConversation.hostName}` : 'Host'}
                            </p>
                          </div>
                          <div className="flex-1 overflow-y-auto mb-3 bg-gray-50 rounded-md p-2 space-y-2">
                            {conversationMessages.map((msg) => {
                              const isGuest = msg.senderId === user?.uid;
                              const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                                      isGuest
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white text-gray-900 border border-gray-200'
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                    {createdAt && (
                                      <p className="mt-1 text-[10px] opacity-75">
                                        {createdAt.toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2 mt-auto">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[2.5rem] max-h-24 resize-none"
                              placeholder="Type a message to the host"
                              rows={2}
                            />
                            <button
                              type="button"
                              onClick={handleGuestSendMessage}
                              disabled={sending || !replyText.trim()}
                              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                              {sending ? 'Sending...' : 'Send'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'bookings' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Bookings</h2>

                    {loadingBookings ? (
                      <p className="text-gray-600">Loading your bookings...</p>
                    ) : bookings.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-600 mb-4">You haven&apos;t booked any stays yet.</p>
                        <button
                          onClick={() => navigate('/browse')}
                          className="inline-block px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
                        >
                          Explore Stays
                        </button>
                      </div>
                    ) : (
                      <>
                        {upcomingBookings.length > 0 && (
                          <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Stays</h3>
                            <div className="space-y-3">
                              {upcomingBookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-lg p-5"
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <h4 className="font-semibold text-gray-900">
                                        {booking.listing?.title || 'Listing unavailable'}
                                      </h4>
                                      <p className="text-sm text-gray-600">
                                        {booking.listing?.location}
                                      </p>
                                    </div>
                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                      {booking.status}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-600">Check-in</p>
                                      <p className="font-medium text-gray-900">
                                        {booking.checkIn
                                          ? (booking.checkIn.toDate
                                              ? booking.checkIn.toDate().toLocaleDateString()
                                              : '')
                                          : 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Check-out</p>
                                      <p className="font-medium text-gray-900">
                                        {booking.checkOut
                                          ? (booking.checkOut.toDate
                                              ? booking.checkOut.toDate().toLocaleDateString()
                                              : '')
                                          : 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Guests</p>
                                      <p className="font-medium text-gray-900">{booking.guestCount || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Total Price</p>
                                      <p className="font-medium text-gray-900">
                                        ₱{booking.totalPrice?.toFixed(2) || '-'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBookingForWishlist(booking);
                                        setWishlistModalOpen(true);
                                      }}
                                      className="text-xs px-3 py-1 border border-green-300 rounded-full text-green-700 hover:bg-green-50"
                                    >
                                      Tell host what you want to see more of
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {pastBookings.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Stays</h3>
                            <div className="space-y-3">
                              {pastBookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="bg-gray-50 border border-gray-200 rounded-lg p-5 opacity-75"
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <h4 className="font-semibold text-gray-900">
                                        {booking.listing?.title || 'Listing unavailable'}
                                      </h4>
                                      <p className="text-sm text-gray-600">
                                        {booking.listing?.location}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <span className="inline-block px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                                        {booking.status}
                                      </span>
                                      {!booking.refundRequested && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedBookingForRefund(booking);
                                            setRefundModalOpen(true);
                                          }}
                                          className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700"
                                        >
                                          Request Refund
                                        </button>
                                      )}
                                      {booking.refundRequested && (
                                        <span className="text-xs text-orange-600 font-semibold">Refund Requested</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-600">Check-in</p>
                                      <p className="font-medium text-gray-900">
                                        {booking.checkIn
                                          ? (booking.checkIn.toDate
                                              ? booking.checkIn.toDate().toLocaleDateString()
                                              : '')
                                          : 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Check-out</p>
                                      <p className="font-medium text-gray-900">
                                        {booking.checkOut
                                          ? (booking.checkOut.toDate
                                              ? booking.checkOut.toDate().toLocaleDateString()
                                              : '')
                                          : 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Guests</p>
                                      <p className="font-medium text-gray-900">{booking.guestCount || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Total Price</p>
                                      <p className="font-medium text-gray-900">
                                        ₱{booking.totalPrice?.toFixed(2) || '-'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBookingForWishlist(booking);
                                        setWishlistModalOpen(true);
                                      }}
                                      className="text-xs px-3 py-1 border border-green-300 rounded-full text-green-700 hover:bg-green-50"
                                    >
                                      Tell host what you want to see more of
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {wishlistModalOpen && selectedBookingForWishlist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Wishlist for this booking</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Tell the host what you would like to see more of for
                      {' '}
                      <span className="font-semibold">
                        {selectedBookingForWishlist.listing?.title || 'this listing'}
                      </span>
                      .
                    </p>
                    <textarea
                      value={wishlistText}
                      onChange={(e) => setWishlistText(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm mb-4"
                      placeholder="e.g. More kid-friendly amenities, flexible check-in times, airport pickup, etc."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWishlistModalOpen(false);
                          setSelectedBookingForWishlist(null);
                          setWishlistText('');
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={submittingWishlist || !wishlistText.trim()}
                        onClick={handleWishlistSubmit}
                        className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {submittingWishlist ? 'Sending...' : 'Send to host'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'payments' && (
                <div className="space-y-6">
                  {/* Pending Payments Section */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Pending Payments</h2>
                    <p className="text-gray-600 mb-6">
                      Complete payment for your accepted bookings.
                    </p>

                    {loadingBookings ? (
                      <p className="text-gray-600">Loading your bookings...</p>
                    ) : (() => {
                      const pendingPayments = bookings.filter((b) => b.status === 'accepted' && !b.paid);
                      return pendingPayments.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-gray-600 mb-4">No pending payments.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingPayments.map((booking) => (
                            <div
                              key={booking.id}
                              className="border border-gray-200 rounded-lg p-6 bg-gray-50"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h4 className="font-semibold text-gray-900">
                                    {booking.listing?.title || 'Listing unavailable'}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {booking.listing?.location}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {booking.checkIn && booking.checkIn.toDate
                                      ? booking.checkIn.toDate().toLocaleDateString()
                                      : ''} – {booking.checkOut && booking.checkOut.toDate
                                      ? booking.checkOut.toDate().toLocaleDateString()
                                      : ''}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-gray-900">
                                    ₱{booking.totalPrice?.toFixed(2) || '0.00'}
                                  </p>
                                  <p className="text-sm text-gray-600">Total</p>
                                </div>
                              </div>

                              {paymentError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                  <p className="text-red-800 text-sm">{paymentError}</p>
                                </div>
                              )}

                              {paymentSuccess && (
                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                  <p className="text-green-800 text-sm">{paymentSuccess}</p>
                                </div>
                              )}

                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-blue-800 text-sm">
                                  <strong>Note:</strong> You already logged in with PayPal when requesting this booking. This payment button is for completing the final payment after host approval.
                                </p>
                              </div>

                              {paypalClientId ? (
                                <PayPalButtons
                                  createOrder={(data, actions) => {
                                    return actions.order.create({
                                      purchase_units: [
                                        {
                                          amount: {
                                            value: booking.totalPrice?.toFixed(2) || '0.00',
                                            currency_code: 'PHP',
                                          },
                                          description: `Payment for ${booking.listing?.title || 'Booking'}`,
                                        },
                                      ],
                                    });
                                  }}
                                  onApprove={async (data, actions) => {
                                    try {
                                      setProcessingPayment(true);
                                      setPaymentError('');
                                      const order = await actions.order.capture();

                                      // Update booking status to paid
                                      await updateDoc(doc(db, 'bookings', booking.id), {
                                        paid: true,
                                        paymentId: order.id,
                                        paymentDate: serverTimestamp(),
                                        status: 'confirmed', // Update status to confirmed after payment
                                      });

                                      // Send booking details email to guest
                                      try {
                                        const bookingDetails = {
                                          listingTitle: booking.listing?.title || 'N/A',
                                          location: booking.listing?.location || 'N/A',
                                          checkIn: booking.checkIn?.toDate ? booking.checkIn.toDate().toLocaleDateString() : 'N/A',
                                          checkOut: booking.checkOut?.toDate ? booking.checkOut.toDate().toLocaleDateString() : 'N/A',
                                          guestCount: booking.guestCount || 'N/A',
                                          totalPrice: booking.totalPrice ? `₱${booking.totalPrice.toFixed(2)}` : 'N/A',
                                        };
                                        await sendBookingDetails(user.email, user.displayName || user.email.split('@')[0], bookingDetails);
                                      } catch (emailError) {
                                        console.error('Failed to send booking details email:', emailError);
                                        // Don't fail the payment if email fails
                                      }

                                      setPaymentSuccess('Payment successful! Your booking is now confirmed.');
                                      setTimeout(() => setPaymentSuccess(''), 5000);

                                      // Refresh bookings
                                      const updatedBookings = bookings.map(b =>
                                        b.id === booking.id ? { ...b, paid: true, status: 'confirmed' } : b
                                      );
                                      setBookings(updatedBookings);
                                    } catch (error) {
                                      console.error('Payment error:', error);
                                      setPaymentError('Payment failed. Please try again.');
                                    } finally {
                                      setProcessingPayment(false);
                                    }
                                  }}
                                  onError={(error) => {
                                    console.error('PayPal error:', error);
                                    setPaymentError('Payment failed. Please try again.');
                                  }}
                                  disabled={processingPayment}
                                  style={{
                                    layout: 'vertical',
                                    color: 'blue',
                                    shape: 'rect',
                                    label: 'paypal',
                                  }}
                                />
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-red-600 text-sm">PayPal payment is not configured. Please contact support.</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Payment History Section */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment History</h2>
                    <p className="text-gray-600 mb-6">
                      View the payments you&apos;ve made for your stays.
                    </p>

                    {loadingBookings ? (
                      <p className="text-gray-600">Loading your payments...</p>
                    ) : (() => {
                      const paidBookings = bookings.filter((b) => b.paid || (b.status === 'confirmed' && typeof b.totalPrice === 'number'));
                      const totalPaid = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
                      return paidBookings.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-gray-600 mb-4">You haven&apos;t completed any payments yet.</p>
                          <button
                            type="button"
                            onClick={() => navigate('/browse')}
                            className="inline-block px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
                          >
                            Explore Stays
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Total paid</p>
                              <p className="text-2xl font-bold text-gray-900">
                                ₱{totalPaid.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Completed payments</p>
                              <p className="text-lg font-semibold text-gray-900">{paidBookings.length}</p>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 pt-4 space-y-3 max-h-[420px] overflow-y-auto">
                            {paidBookings
                              .slice()
                              .sort((a, b) => {
                                const aDate = a.paymentDate?.toDate ? a.paymentDate.toDate() : (a.createdAt?.toDate ? a.createdAt.toDate() : null);
                                const bDate = b.paymentDate?.toDate ? b.paymentDate.toDate() : (b.createdAt?.toDate ? b.createdAt.toDate() : null);
                                if (!aDate && !bDate) return 0;
                                if (!aDate) return 1;
                                if (!bDate) return -1;
                                return bDate - aDate;
                              })
                              .map((booking) => (
                                <div
                                  key={booking.id}
                                  className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-b-0"
                                >
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      {booking.listing?.title || 'Listing unavailable'}
                                    </p>
                                    <p className="text-xs text-gray-600 mb-1">
                                      {booking.checkIn && booking.checkIn.toDate
                                        ? booking.checkIn.toDate().toLocaleDateString()
                                        : ''}
                                      {' '}
                                      –
                                      {' '}
                                      {booking.checkOut && booking.checkOut.toDate
                                        ? booking.checkOut.toDate().toLocaleDateString()
                                        : ''}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {booking.paymentDate && booking.paymentDate.toDate
                                        ? `Paid on ${booking.paymentDate.toDate().toLocaleString()}`
                                        : booking.createdAt && booking.createdAt.toDate
                                          ? `Paid on ${booking.createdAt.toDate().toLocaleString()}`
                                          : ''}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-gray-900">
                                      {typeof booking.totalPrice === 'number'
                                        ? `₱${booking.totalPrice.toFixed(2)}`
                                        : '—'}
                                    </p>
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                      Paid
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {tab === 'wishlist' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Favorites</h2>

                  {favorites.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-600 mb-4">You haven&apos;t saved any favorites yet.</p>
                      <button
                        onClick={() => navigate('/browse')}
                        className="inline-block px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
                      >
                        Browse Stays
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {favorites.map((listing) => {
                        const imageSrc =
                          listing.coverImage ||
                          (listing.images && listing.images.length > 0 ? listing.images[0] : null) ||
                          (listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls[0] : null) ||
                          null;

                        return (
                          <div
                            key={listing.id}
                            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer flex flex-col"
                            onClick={() => navigate(`/listing/${listing.id}`)}
                          >
                            <div className="relative h-40 bg-gray-200">
                              {imageSrc && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedImage(imageSrc);
                                  }}
                                  className="block w-full h-full text-left"
                                >
                                  <img
                                    src={imageSrc}
                                    alt={listing.title}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteListing(listing);
                                }}
                                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-red-500 shadow-sm hover:bg-white"
                              >
                                <span className="text-lg">❤️</span>
                              </button>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                                {listing.category}
                              </p>
                              <h4 className="font-semibold text-gray-900 mb-1 truncate">
                                {listing.title}
                              </h4>
                              <p className="text-sm text-gray-600 truncate mb-3">
                                {listing.location}
                              </p>
                              {listing.rate && (
                                <p className="mt-auto text-sm font-semibold text-gray-900">
                                  ₱{listing.rate} / night
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === 'wishlist-prefs' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Wishlist Preferences</h2>
                  <p className="text-gray-600 mb-8">Select the types of listings you're interested in. We'll recommend stays that match your preferences.</p>

                  {loadingPreferences ? (
                    <div className="text-center py-12">
                      <p className="text-gray-600">Loading preferences...</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Choose your interests</h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {availableCategories.map((category) => {
                            const selected = activeWishlistCategoryKey === category.key;
                            return (
                              <button
                                key={category.key}
                                type="button"
                                onClick={() => togglePreference(category.key)}
                                className={`px-3 py-1.5 text-xs rounded-full border transition flex items-center gap-2 whitespace-nowrap ${
                                  selected
                                    ? 'bg-green-100 border-green-500 text-green-800'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span>{category.emoji}</span>
                                <span className="font-medium">{category.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Single tag card that changes with the active category */}
                        <div className="mt-4 space-y-4">
                          <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50">
                                {activeWishlistCategory.emoji}
                              </span>
                              <span>{activeWishlistCategory.label} tags</span>
                            </p>
                            {wishlistSuggestionOptions[activeWishlistCategory.key] && (
                              <div className="flex flex-wrap gap-2">
                                {wishlistSuggestionOptions[activeWishlistCategory.key].map((tag) => {
                                  const active = (wishlistTags[activeWishlistCategory.key] || []).includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => toggleWishlistTag(activeWishlistCategory.key, tag)}
                                      className={`px-2.5 py-1 rounded-full text-xs border transition whitespace-nowrap ${
                                        active
                                          ? 'bg-green-100 border-green-500 text-green-800'
                                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                      }`}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {wishlistPreferences.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recommended for you</h3>
                          {recommendations.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg">
                              <p className="text-gray-600">No listings found matching your preferences. Check back soon!</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {recommendations.slice(0, 9).map((listing) => (
                                <div
                                  key={listing.id}
                                  onClick={() => navigate(`/listing/${listing.id}`)}
                                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                                >
                                  <div className="h-40 bg-gray-300 relative">
                                    {listing.images && listing.images.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedImage(listing.images[0]);
                                        }}
                                        className="block w-full h-full text-left"
                                      >
                                        <img
                                          src={listing.images[0]}
                                          alt={listing.title}
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    ) : listing.coverImage ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedImage(listing.coverImage);
                                        }}
                                        className="block w-full h-full text-left"
                                      >
                                        <img
                                          src={listing.coverImage}
                                          alt={listing.title}
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    ) : null}
                                    {listing.discount > 0 && (
                                      <div className="absolute top-3 left-3 bg-red-600 text-white px-2 py-1 rounded text-sm font-bold">
                                        {listing.discount}% OFF
                                      </div>
                                    )}
                                    {typeof listing.matchScore === 'number' && listing.matchScore > 0 && (
                                      <div className="absolute top-3 right-3 bg-green-600/90 text-white px-2 py-1 rounded-full text-[10px] font-semibold shadow">
                                        {listing.matchScore === 1
                                          ? '1 wishlist match'
                                          : `${listing.matchScore} wishlist matches`}
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-4">
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                                      {listing.category}
                                    </p>
                                    <h4 className="font-semibold text-gray-900 mb-1 truncate">
                                      {listing.title}
                                    </h4>
                                    <p className="text-sm text-gray-600 truncate mb-3">
                                      {listing.location}
                                    </p>
                                    {listing.rate && (
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900">
                                          ₱{listing.rate}
                                        </p>
                                        {listing.discount > 0 && (
                                          <p className="text-sm text-red-600 font-semibold">
                                            ₱{Math.round(listing.rate * (1 - listing.discount / 100))}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Refund Request Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Request Refund</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for your refund request for {selectedBookingForRefund?.listing?.title}.
            </p>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Enter your reason here..."
              rows={4}
              className="w-full border border-gray-300 rounded-md p-2 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRefundModalOpen(false);
                  setSelectedBookingForRefund(null);
                  setRefundReason('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundRequest}
                disabled={submittingRefund || !refundReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {submittingRefund ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] mx-4 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedImage(null)}
              className="absolute top-3 right-3 px-3 py-1 text-xs font-semibold rounded-full bg-white text-gray-900 shadow"
            >
              Back to browsing
            </button>
            <img
              src={expandedImage}
              alt="Expanded preview"
              className="max-h-[80vh] w-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  </PayPalScriptProvider>
);
}
