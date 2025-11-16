import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);
  const [hostProfile, setHostProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [listingLimit, setListingLimit] = useState('');
  const [provider, setProvider] = useState('');

  useEffect(() => {
    const loadHost = async () => {
      if (!user) {
        setHostProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const ref = doc(db, 'hosts', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setHostProfile(snap.data());
        } else {
          setHostProfile(null);
        }
      } catch (err) {
        setError(err.message || 'Failed to load host profile');
        setHostProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadHost();
  }, [user]);

  useEffect(() => {
    if (!hostProfile) {
      setName('');
      setPhone('');
      setSubscriptionPlan('');
      setSubscriptionPrice('');
      setListingLimit('');
      setProvider('');
      return;
    }

    setName(hostProfile.name || '');
    setPhone(hostProfile.phone || '');
    setSubscriptionPlan(hostProfile.subscriptionPlan || '');
    setSubscriptionPrice(
      hostProfile.subscriptionPrice !== undefined && hostProfile.subscriptionPrice !== null
        ? String(hostProfile.subscriptionPrice)
        : '',
    );
    setListingLimit(
      hostProfile.listingLimit !== undefined && hostProfile.listingLimit !== null
        ? String(hostProfile.listingLimit)
        : '',
    );
    setProvider(hostProfile.provider || '');
  }, [hostProfile]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const listingLimitLabel = () => {
    if (!hostProfile) return '—';
    if (hostProfile.listingLimit === null || hostProfile.listingLimit === undefined) {
      return 'Unlimited listings';
    }
    return `${hostProfile.listingLimit} published listings`;
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const ref = doc(db, 'hosts', user.uid);
      const payload = {
        name: name.trim() || null,
        phone: phone.trim() || null,
        subscriptionPlan: subscriptionPlan.trim() || null,
        provider: provider.trim() || null,
      };

      if (subscriptionPrice !== '') {
        const priceNum = Number(subscriptionPrice);
        // eslint-disable-next-line no-restricted-globals
        payload.subscriptionPrice = !Number.isNaN(priceNum) ? priceNum : hostProfile?.subscriptionPrice || null;
      }

      if (listingLimit !== '') {
        const limitNum = Number(listingLimit);
        // eslint-disable-next-line no-restricted-globals
        payload.listingLimit = !Number.isNaN(limitNum) ? limitNum : hostProfile?.listingLimit ?? null;
      }

      await updateDoc(ref, payload);
      setHostProfile((prev) => (prev ? { ...prev, ...payload } : payload));
      setSaveMessage('Host profile updated.');
    } catch (e) {
      setSaveMessage('Failed to save host profile. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  const tierConfig = [
    { id: 'bronze', label: 'Bronze', min: 0, max: 499 },
    { id: 'silver', label: 'Silver', min: 500, max: 1499 },
    { id: 'gold', label: 'Gold', min: 1500, max: 3499 },
    { id: 'platinum', label: 'Platinum', min: 3500, max: 6999 },
    { id: 'diamond', label: 'Diamond', min: 7000, max: Infinity },
  ];

  const computeTierFromPoints = (pts) => {
    const total = typeof pts === 'number' ? pts : 0;
    const found = tierConfig.find((t) => total >= t.min && total <= t.max) || tierConfig[0];
    return found.id;
  };

  const pointsData = hostProfile?.points || {};
  const lifetimePoints = typeof pointsData.lifetime === 'number' ? pointsData.lifetime : 0;
  const availablePoints = typeof pointsData.available === 'number' ? pointsData.available : 0;
  const tierId = pointsData.tier || computeTierFromPoints(lifetimePoints);
  const tierMeta = tierConfig.find((t) => t.id === tierId) || tierConfig[0];
  const nextTier = tierConfig.find((t) => t.min > tierMeta.min) || null;
  const progressToNext = nextTier
    ? Math.min(100, Math.max(0, ((lifetimePoints - tierMeta.min) / (nextTier.min - tierMeta.min)) * 100))
    : 100;

  const updateHostPoints = async (hostId, deltaAvailable) => {
    const hostRef = doc(db, 'hosts', hostId);
    const snap = await getDoc(hostRef);
    let lifetime = 0;
    let available = 0;
    if (snap.exists()) {
      const data = snap.data();
      lifetime = data.points?.lifetime ?? 0;
      available = data.points?.available ?? 0;
    }

    const newAvailable = Math.max(0, available + deltaAvailable);
    await updateDoc(hostRef, {
      points: {
        lifetime,
        available: newAvailable,
        tier: computeTierFromPoints(lifetime),
      },
      updatedAt: serverTimestamp(),
    });
    return newAvailable;
  };

  const handleRedeemFeeDiscount = async (cost, discountPercent, durationDays) => {
    if (!user || redeeming) return;
    if (availablePoints < cost) {
      setRedeemMessage('Not enough points to redeem this discount.');
      return;
    }
    try {
      setRedeeming(true);
      setRedeemMessage('');

      const now = new Date();
      const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const discountsRef = collection(db, 'hostFeeDiscounts');
      await addDoc(discountsRef, {
        hostId: user.uid,
        discountPercent,
        validFrom: serverTimestamp(),
        validUntil: end,
        createdAt: serverTimestamp(),
        type: 'fee-discount',
        cost,
      });

      const newAvailable = await updateHostPoints(user.uid, -cost);
      setRedeemMessage(`Redeemed ${cost} pts for ${discountPercent}% fee discount. Remaining: ${newAvailable} pts.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error redeeming fee discount', err);
      setRedeemMessage('Unable to redeem discount right now. Please try again later.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleRedeemFreeListing = async () => {
    if (!user || redeeming) return;
    const cost = 200;
    if (availablePoints < cost) {
      setRedeemMessage('Not enough points to redeem a free listing.');
      return;
    }
    try {
      setRedeeming(true);
      setRedeemMessage('');

      const creditsRef = collection(db, 'hostFreeListings');
      await addDoc(creditsRef, {
        hostId: user.uid,
        remainingListings: 1,
        createdAt: serverTimestamp(),
        type: 'one-time-free-listing',
        cost,
      });

      const newAvailable = await updateHostPoints(user.uid, -cost);
      setRedeemMessage(`Redeemed ${cost} pts for one free listing. Remaining: ${newAvailable} pts.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error redeeming free listing', err);
      setRedeemMessage('Unable to redeem free listing right now. Please try again later.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleRedeemPromotion = async (cost, promoType, durationDays) => {
    if (!user || redeeming) return;
    if (availablePoints < cost) {
      setRedeemMessage('Not enough points to redeem this promotion.');
      return;
    }
    try {
      setRedeeming(true);
      setRedeemMessage('');

      const now = new Date();
      const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const promosRef = collection(db, 'hostPromotions');
      await addDoc(promosRef, {
        hostId: user.uid,
        type: promoType,
        validFrom: serverTimestamp(),
        validUntil: end,
        createdAt: serverTimestamp(),
        cost,
      });

      const newAvailable = await updateHostPoints(user.uid, -cost);
      setRedeemMessage(`Redeemed ${cost} pts for a promotion. Remaining: ${newAvailable} pts.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error redeeming promotion', err);
      setRedeemMessage('Unable to redeem promotion right now. Please try again later.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Typography variant="h4" gutterBottom>
            Host Account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your host profile, plan, and tools
          </Typography>
        </div>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !user && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You need to be signed in as a host to view your host account.
          </Alert>
        )}

        {!loading && user && !hostProfile && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No host subscription profile found yet. Complete host registration to unlock host tools.
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
              <div className="mb-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 mb-3 flex items-center justify-center">
                  <span className="text-gray-500 text-sm font-medium">
                    {user?.email ? user.email.charAt(0).toUpperCase() : 'H'}
                  </span>
                </div>
                <h3 className="text-center text-lg font-semibold text-gray-900">
                  {hostProfile?.name || (user ? user.email.split('@')[0] : 'Host')}
                </h3>
                <p className="text-center text-sm text-gray-600 break-all">{user?.email}</p>
                {hostProfile && (
                  <div className="mt-2 text-xs text-gray-600 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                      {hostProfile.subscriptionPlan || 'No plan selected'}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <nav className="space-y-2">
                  {[0, 1, 2, 3, 4].map((idx) => {
                    const labels = ['Profile', 'Bookings', 'Coupons', 'Points & Rewards', 'Rules & policies'];
                    return (
                      <button
                        key={labels[idx]}
                        type="button"
                        onClick={() => handleTabChange(null, idx)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition font-medium flex items-center justify-between ${
                          tab === idx
                            ? 'bg-green-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{labels[idx]}</span>
                        {tab === idx && <span className="text-xs">●</span>}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <button
                type="button"
                onClick={() => navigate('/host/listings')}
                className="w-full mt-6 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
              >
                Go to Listings
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            {tab === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Host profile</h2>
                <p className="text-gray-600 mb-6">
                  View and edit the details of your host subscription and profile.
                </p>

                {loading ? (
                  <p className="text-gray-600">Loading profile...</p>
                ) : hostProfile ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</p>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />

                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                      <p className="text-gray-900 mb-3">{hostProfile.email || user?.email || '—'}</p>

                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subscription plan</p>
                      <input
                        type="text"
                        value={subscriptionPlan}
                        onChange={(e) => setSubscriptionPlan(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subscription price (₱)</p>
                      <input
                        type="number"
                        min="0"
                        value={subscriptionPrice}
                        onChange={(e) => setSubscriptionPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />
                      {subscriptionPlan && subscriptionPrice && (
                        <Chip
                          size="small"
                          label={`₱${subscriptionPrice} / ${
                            subscriptionPlan.toLowerCase().includes('annual') ? 'year' : 'month'
                          }`}
                          color="success"
                          variant="outlined"
                          sx={{ mb: 2 }}
                        />
                      )}

                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Listing limit</p>
                      <input
                        type="number"
                        min="0"
                        value={listingLimit}
                        onChange={(e) => setListingLimit(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />
                      <p className="text-xs text-gray-500 mb-3">
                        {listingLimit === '' ? listingLimitLabel() : `${listingLimit} published listings`}
                      </p>

                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Provider</p>
                      <input
                        type="text"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    You don't have a host profile yet. Use the Host Registration flow to create one.
                  </p>
                )}

                <Divider sx={{ my: 4 }} />
                {saveMessage && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {saveMessage}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button variant="contained" color="primary" disabled={saving} onClick={handleSaveProfile}>
                    {saving ? 'Saving...' : 'Save profile'}
                  </Button>
                  <Button variant="contained" onClick={() => navigate('/host/listings')}>
                    Manage Listings
                  </Button>
                  <Button variant="outlined" onClick={() => navigate('/host/bookings')}>
                    View Host Bookings
                  </Button>
                </Box>
              </div>
            )}

            {tab === 1 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Bookings overview</h2>
                <p className="text-gray-600 mb-4">
                  Manage and review bookings for your listings from the host bookings dashboard.
                </p>
                <Button variant="contained" onClick={() => navigate('/host/bookings')}>
                  Open Host Bookings
                </Button>
              </div>
            )}

            {tab === 2 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Coupons</h2>
                <p className="text-gray-600 mb-4">
                  Coupons are managed per listing using promo codes and discounts. Edit a listing to set promo
                  details that guests can use during booking.
                </p>
                <Button variant="contained" onClick={() => navigate('/host/listings')}>
                  Go to My Listings
                </Button>
              </div>
            )}

            {tab === 3 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Points & rewards</h2>
                  <p className="text-gray-600 mb-4">
                    Track your hosting points, tier, and redeem rewards like fee discounts and promotional
                    upgrades.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase flex items-center justify-between">
                        <span>Current tier</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                          {tierMeta.label}
                        </span>
                      </p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        {lifetimePoints.toLocaleString()} pts
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Available:{' '}
                        <span className="font-semibold text-gray-800">
                          {availablePoints.toLocaleString()} pts
                        </span>
                      </p>
                      {nextTier ? (
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>Progress to {nextTier.label}</span>
                            <span>{Math.max(0, nextTier.min - lifetimePoints)} pts to go</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500 transition-all"
                              style={{ width: `${progressToNext}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-[11px] text-gray-500">You&apos;re at the highest tier.</p>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 space-y-2">
                      <p className="font-semibold text-gray-900">How you earn points</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>+20 pts for each completed booking.</li>
                        <li>+100 pts signup bonus when you create your host account.</li>
                        <li>Future: ratings, fast responses, and high completion rates.</li>
                      </ul>
                      <Divider sx={{ my: 1 }} />
                      <p className="font-semibold text-gray-900">Tier ranges</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Bronze: 0–499 pts</li>
                        <li>Silver: 500–1,499 pts</li>
                        <li>Gold: 1,500–3,499 pts</li>
                        <li>Platinum: 3,500–6,999 pts</li>
                        <li>Diamond: 7,000+ pts</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Divider />

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Redeem your points</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Use available points to redeem fee discounts or boost visibility for your listings.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Platform fee discounts</p>
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 500}
                          onClick={() => handleRedeemFeeDiscount(500, 5, 30)}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 500 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>500 pts → 5% fee discount (30 days)</span>
                            <span className="text-xs text-gray-500">{availablePoints}/500</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 1000}
                          onClick={() => handleRedeemFeeDiscount(1000, 10, 30)}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 1000 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>1,000 pts → 10% fee discount (30 days)</span>
                            <span className="text-xs text-gray-500">{availablePoints}/1000</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 2000}
                          onClick={() => handleRedeemFeeDiscount(2000, 20, 30)}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 2000 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>2,000 pts → 20% fee discount (30 days)</span>
                            <span className="text-xs text-gray-500">{availablePoints}/2000</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Promotion upgrades</p>
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 200}
                          onClick={handleRedeemFreeListing}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 200 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>200 pts → One-time free listing</span>
                            <span className="text-xs text-gray-500">{availablePoints}/200</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 300}
                          onClick={() => handleRedeemPromotion(300, 'featured', 7)}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 300 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>300 pts → Featured listing (7 days)</span>
                            <span className="text-xs text-gray-500">{availablePoints}/300</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 800}
                          onClick={() => handleRedeemPromotion(800, 'homepage', 7)}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 800 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>800 pts → Homepage spotlight (7 days)</span>
                            <span className="text-xs text-gray-500">{availablePoints}/800</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={redeeming || availablePoints < 1200}
                          onClick={() => handleRedeemPromotion(1200, 'seasonal', 14)}
                          className={`w-full px-3 py-2 rounded-md border text-left transition ${
                            availablePoints < 1200 || redeeming
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>1,200 pts → Seasonal promo placement (14 days)</span>
                            <span className="text-xs text-gray-500">{availablePoints}/1200</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {redeemMessage && (
                    <p className="mt-4 text-xs text-gray-700">{redeemMessage}</p>
                  )}
                </div>
              </div>
            )}

            {tab === 4 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Rules, policies & terms</h2>
                  <p className="text-gray-600 mb-4">
                    Review the key rules for hosting on VentureHub and the terms that apply to your use of the
                    platform. This section is for your reference only and does not change your legal obligations.
                  </p>
                </div>

                <div className="space-y-4 text-sm text-gray-700">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Hosting rules & policies</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Provide accurate and up-to-date information about your listings, pricing, and availability.</li>
                      <li>Respond to guest inquiries and booking requests in a timely and respectful manner.</li>
                      <li>Ensure that your space is clean, safe, and compliant with local laws and regulations.</li>
                      <li>Honor confirmed bookings unless there are exceptional circumstances beyond your control.</li>
                      <li>Communicate house rules clearly to guests and enforce them consistently and fairly.</li>
                    </ul>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Terms & conditions</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>By hosting on VentureHub, you agree to our platform terms and privacy policy.</li>
                      <li>You are responsible for complying with all applicable laws, taxes, and permits for your listings.</li>
                      <li>Platform fees and payout schedules may change; we will notify you of material updates.</li>
                      <li>Abusive behavior, discrimination, or fraud may result in suspension or removal from the platform.</li>
                      <li>If anything in these terms conflicts with local law, the local law will prevail to the extent required.</li>
                    </ul>
                  </div>

                  <p className="text-xs text-gray-500">
                    This summary is for convenience only. For full legal details, please refer to the official VentureHub
                    terms published on our website or provided by the platform operator.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
