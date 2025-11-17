import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Typography,
} from '@mui/material';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
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
  const [upgradePlanKey, setUpgradePlanKey] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [pointsEvents, setPointsEvents] = useState([]);
  const [pointsEventsLoading, setPointsEventsLoading] = useState(false);

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
    const loadPointsEvents = async () => {
      if (!user) {
        setPointsEvents([]);
        return;
      }

      try {
        setPointsEventsLoading(true);
        const eventsRef = collection(db, 'hostPointsEvents');
        const q = query(eventsRef, where('hostId', '==', user.uid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPointsEvents(items);
      } catch {
        setPointsEvents([]);
      } finally {
        setPointsEventsLoading(false);
      }
    };

    loadPointsEvents();
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

  // One-time signup bonus for hosts created before points were introduced
  useEffect(() => {
    const grantSignupBonusIfNeeded = async () => {
      if (!user || !hostProfile) return;
      const hasPoints = hostProfile.points && (typeof hostProfile.points.lifetime === 'number');
      const signupBonusGranted = hostProfile.signupPointsGranted === true;
      if (hasPoints || signupBonusGranted) return;

      try {
        const hostRef = doc(db, 'hosts', user.uid);
        const bonus = 100;
        const updatedPoints = {
          lifetime: bonus,
          available: bonus,
          tier: computeTierFromPoints(bonus),
        };

        await updateDoc(hostRef, {
          points: updatedPoints,
          signupPointsGranted: true,
          updatedAt: serverTimestamp(),
        });

        const eventsRef = collection(db, 'hostPointsEvents');
        await addDoc(eventsRef, {
          hostId: user.uid,
          points: bonus,
          reason: 'signup_bonus',
          metadata: {},
          createdAt: serverTimestamp(),
        });

        setHostProfile((prev) => (prev ? { ...prev, points: updatedPoints, signupPointsGranted: true } : prev));
        setPointsEvents((prev) => [{
          id: `local-signup-${Date.now()}`,
          hostId: user.uid,
          points: bonus,
          reason: 'signup_bonus',
          metadata: {},
          createdAt: { toDate: () => new Date() },
        }, ...prev]);
      } catch {
        // silently ignore if we can't grant bonus
      }
    };

    grantSignupBonusIfNeeded();
  }, [user, hostProfile]);

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

  const planConfig = {
    basic: { label: 'Basic Monthly – ₱299 / month (up to 3 listings)', price: 299, listingLimit: 3 },
    pro: { label: 'Pro Monthly – ₱599 / month (up to 8 listings)', price: 599, listingLimit: 8 },
    annual: { label: 'Annual Unlimited – ₱1,299 / year (unlimited listings)', price: 1299, listingLimit: null },
  };

  const detectCurrentPlanKey = () => {
    const planText = (hostProfile?.subscriptionPlan || '').toLowerCase();
    if (planText.includes('annual')) return 'annual';
    if (planText.includes('pro')) return 'pro';
    if (planText.includes('basic')) return 'basic';
    return null;
  };

  const currentPlanKey = detectCurrentPlanKey();

  const availableUpgradeOptions = () => {
    if (!currentPlanKey) return ['basic', 'pro', 'annual'];
    if (currentPlanKey === 'basic') return ['pro', 'annual'];
    if (currentPlanKey === 'pro') return ['annual'];
    return [];
  };

  const handleUpgradeApplied = async (planKey) => {
    if (!user || !planConfig[planKey]) return;
    try {
      setUpgrading(true);
      setUpgradeMessage('');

      const meta = planConfig[planKey];
      const ref = doc(db, 'hosts', user.uid);
      await updateDoc(ref, {
        subscriptionPlan: meta.label,
        subscriptionPrice: meta.price,
        listingLimit: meta.listingLimit,
        updatedAt: serverTimestamp(),
      });

      setHostProfile((prev) => (prev ? {
        ...prev,
        subscriptionPlan: meta.label,
        subscriptionPrice: meta.price,
        listingLimit: meta.listingLimit,
      } : prev));

      setSubscriptionPlan(meta.label);
      setSubscriptionPrice(String(meta.price));
      setListingLimit(meta.listingLimit === null || meta.listingLimit === undefined ? '' : String(meta.listingLimit));
      setUpgradeMessage('Your subscription plan has been updated.');
      setUpgradePlanKey('');
    } catch (err) {
      setUpgradeMessage('Failed to update your subscription plan. Please contact support if this continues.');
    } finally {
      setUpgrading(false);
      setTimeout(() => setUpgradeMessage(''), 5000);
    }
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
  const pointsToNextTier = nextTier ? Math.max(0, nextTier.min - lifetimePoints) : 0;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pointsThisWeek = pointsEvents.reduce((sum, ev) => {
    const pts = typeof ev.points === 'number' ? ev.points : 0;
    const createdAt = ev.createdAt?.toDate ? ev.createdAt.toDate() : null;
    if (!createdAt) return sum;
    return createdAt >= weekAgo ? sum + pts : sum;
  }, 0);

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
      <div className="w-full px-6 py-8">
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

                <Divider sx={{ my: 4 }} />

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Upgrade plan</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Move to a higher subscription plan to increase your listing limits. Changes are applied after your PayPal subscription is approved.
                  </p>

                  {!hostProfile && (
                    <p className="text-sm text-gray-600 mb-2">
                      You need a host subscription profile before you can upgrade your plan.
                    </p>
                  )}

                  {hostProfile && availableUpgradeOptions().length === 0 && (
                    <p className="text-sm text-gray-600 mb-2">
                      You are already on the highest available plan.
                    </p>
                  )}

                  {hostProfile && availableUpgradeOptions().length > 0 && (
                    <div className="space-y-3 max-w-md">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Current plan</p>
                        <p className="text-sm text-gray-900">{hostProfile.subscriptionPlan || '—'}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Choose an upgrade</p>
                        <div className="space-y-2">
                          {availableUpgradeOptions().map((key) => {
                            const meta = planConfig[key];
                            const checked = upgradePlanKey === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={upgrading}
                                onClick={() => setUpgradePlanKey(key)}
                                className={`w-full text-left px-3 py-2 border rounded-md text-sm transition ${
                                  checked
                                    ? 'border-green-600 bg-green-50 text-green-800'
                                    : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                                }`}
                              >
                                <span className="font-semibold block">{meta.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {upgradePlanKey && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Confirm with PayPal</p>
                          <div className="max-w-xs">
                            <PayPalButtons
                              style={{ layout: 'horizontal', shape: 'pill' }}
                              disabled={upgrading}
                              createSubscription={(data, actions) => {
                                const planIds = {
                                  basic: import.meta.env.VITE_PAYPAL_PLAN_BASIC,
                                  pro: import.meta.env.VITE_PAYPAL_PLAN_PRO,
                                  annual: import.meta.env.VITE_PAYPAL_PLAN_ANNUAL,
                                };
                                const rawPlanId = planIds[upgradePlanKey];
                                const planId = typeof rawPlanId === 'string' ? rawPlanId.trim() : rawPlanId;
                                if (!planId) {
                                  // eslint-disable-next-line no-alert
                                  alert('PayPal plan ID is not configured for this subscription.');
                                  return Promise.reject(new Error('Missing PayPal plan ID'));
                                }
                                return actions.subscription.create({
                                  plan_id: planId,
                                });
                              }}
                              onApprove={async () => {
                                await handleUpgradeApplied(upgradePlanKey);
                              }}
                              onError={() => {
                                // eslint-disable-next-line no-alert
                                alert('There was an error processing your PayPal subscription. Please try again.');
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {upgradeMessage && (
                        <p className="mt-2 text-xs text-gray-700">{upgradeMessage}</p>
                      )}
                    </div>
                  )}
                </div>
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
              <div className="space-y-6">
                {/* Hero card */}
                <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-500 rounded-2xl shadow-lg text-white p-6 md:p-8">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-semibold">
                        {hostProfile?.name
                          ? hostProfile.name.charAt(0).toUpperCase()
                          : user?.email
                          ? user.email.charAt(0).toUpperCase()
                          : 'H'}
                      </div>
                      <div className="flex flex-col gap-3 text-sm w-full">
                        <p className="text-xs text-emerald-100">
                          Tier: <span className="font-semibold capitalize">{tierMeta.label}</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-white/10 rounded-xl p-3 flex flex-col justify-between">
                            <p className="text-emerald-100 text-xs mb-1">Available points</p>
                            <p className="text-2xl font-bold">{availablePoints.toLocaleString()}</p>
                            <p className="text-[11px] text-emerald-100 mt-1">Use these points to unlock rewards</p>
                          </div>
                          <div className="bg-white/10 rounded-xl p-3 flex flex-col justify-between">
                            <p className="text-emerald-100 text-xs mb-1">Lifetime points</p>
                            <p className="text-2xl font-bold">{lifetimePoints.toLocaleString()}</p>
                            <p className="text-[11px] text-emerald-100 mt-1">
                              {nextTier
                                ? `${pointsToNextTier.toLocaleString()} pts to ${nextTier.label}`
                                : 'You are at the highest tier'}
                            </p>
                          </div>
                          <div className="bg-white/10 rounded-xl p-3 flex flex-col justify-between">
                            <p className="text-emerald-100 text-xs mb-1">This week</p>
                            <p className="text-2xl font-bold">
                              {pointsThisWeek >= 0 ? '+' : ''}
                              {pointsThisWeek.toLocaleString()} pts
                            </p>
                            <p className="text-[11px] text-emerald-100 mt-1">Points earned in the last 7 days</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-100 max-w-md">
                      Earn points from accepted bookings and other host actions, then redeem them for discounts, free
                      listings, and promotions below.
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-emerald-100">Progress to next tier</span>
                      <span className="text-emerald-100 font-medium">{Math.round(progressToNext)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${progressToNext}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rewards + Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Rewards column */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl shadow-md text-white p-5 flex flex-col justify-between min-h-[160px]">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase tracking-wide">Fee discount reward</p>
                        <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
                          {availablePoints >= 150 ? 'Unlocked' : 'Locking soon'}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-3xl font-extrabold leading-none mb-1">10% fee discount</p>
                          <p className="text-xs text-emerald-50 max-w-[180px]">
                            Apply a temporary discount on platform fees for your future bookings.
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-emerald-50 mb-1">150 pts</p>
                          <button
                            type="button"
                            disabled={availablePoints < 150 || redeeming}
                            onClick={() => handleRedeemFeeDiscount(150, 10, 30)}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-full shadow-sm transition ${
                              availablePoints >= 150 && !redeeming
                                ? 'bg-white text-emerald-600 hover:bg-emerald-50'
                                : 'bg-white/30 text-emerald-100 cursor-not-allowed'
                            }`}
                          >
                            {availablePoints >= 150 ? 'Redeem now' : 'Not enough points'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900">Other rewards</h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">Free listing credit</p>
                            <p className="text-gray-500">Publish one listing without platform fee</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500 mb-1">200 pts</p>
                            <button
                              type="button"
                              disabled={availablePoints < 200 || redeeming}
                              onClick={handleRedeemFreeListing}
                              className={`px-3 py-1 rounded-full border text-[11px] font-medium transition ${
                                availablePoints >= 200 && !redeeming
                                  ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Redeem
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                          <div>
                            <p className="font-medium text-gray-800">Listing promotion</p>
                            <p className="text-gray-500">Boost listing visibility for 7 days</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500 mb-1">120 pts</p>
                            <button
                              type="button"
                              disabled={availablePoints < 120 || redeeming}
                              onClick={() => handleRedeemPromotion(120, 'boost-7-days', 7)}
                              className={`px-3 py-1 rounded-full border text-[11px] font-medium transition ${
                                availablePoints >= 120 && !redeeming
                                  ? 'border-indigo-500 text-indigo-600 hover:bg-indigo-50'
                                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Redeem
                            </button>
                          </div>
                        </div>
                      </div>

                      {redeemMessage && (
                        <p className="mt-2 text-[11px] text-gray-600">{redeemMessage}</p>
                      )}
                    </div>
                  </div>

                  {/* Activity column */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">Points activity</h3>
                        <span className="text-[11px] text-gray-500">
                          Showing recent events
                        </span>
                      </div>

                      {pointsEventsLoading ? (
                        <p className="text-xs text-gray-500">Loading points history...</p>
                      ) : pointsEvents.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          No points events yet. You’ll earn points from accepted bookings and other host actions.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {pointsEvents.map((ev) => {
                            const createdAt = ev.createdAt?.toDate ? ev.createdAt.toDate() : null;
                            const pts = typeof ev.points === 'number' ? ev.points : 0;
                            return (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between rounded-xl px-3 py-2 bg-gray-50 border border-gray-100"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                                    {pts >= 0 ? '+' : '-'}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-900">
                                      {ev.reason || 'Points activity'}
                                    </p>
                                    {createdAt && (
                                      <p className="text-[11px] text-gray-500">
                                        {createdAt.toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right text-xs">
                                  <p className="font-semibold text-gray-900">
                                    {pts >= 0 ? '+' : ''}
                                    {pts.toLocaleString()} pts
                                  </p>
                                  {typeof ev.metadata?.bookingId === 'string' && (
                                    <p className="text-[11px] text-gray-500">Booking: {ev.metadata.bookingId}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
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
