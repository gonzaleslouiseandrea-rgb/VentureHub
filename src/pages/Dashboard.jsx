import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hostProfile, setHostProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentListings, setRecentListings] = useState([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [listingCategoryFilter, setListingCategoryFilter] = useState('all');
  const [listingPage, setListingPage] = useState(1);
  const LISTINGS_PAGE_SIZE = 6;

  useEffect(() => {
    const fetchHostProfile = async () => {
      if (!user) {
        setHostProfile(null);
        setLoadingProfile(false);
        return;
      }

      try {
        const ref = doc(db, 'hosts', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setHostProfile(snap.data());
        } else {
          setHostProfile(null);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading host profile', err);
        setHostProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchHostProfile();
  }, [user]);

  useEffect(() => {
    const fetchStatsAndListings = async () => {
      if (!user) {
        setStats({ total: 0, published: 0, drafts: 0 });
        setRecentListings([]);
        setLoadingStats(false);
        return;
      }

      try {
        const listingsRef = collection(db, 'listings');
        const qListings = query(listingsRef, where('hostId', '==', user.uid));
        const snap = await getDocs(qListings);

        let total = 0;
        let published = 0;
        let drafts = 0;
        const items = [];
        snap.forEach((docSnap) => {
          total += 1;
          const data = { id: docSnap.id, ...docSnap.data() };
          items.push(data);
          if (data.status === 'published') published += 1;
          if (data.status === 'draft') drafts += 1;
        });

        setStats({ total, published, drafts });
        setRecentListings(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading listing stats', err);
        setStats({ total: 0, published: 0, drafts: 0 });
        setRecentListings([]);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStatsAndListings();
  }, [user]);

  // Reset pagination when listings or filter change
  useEffect(() => {
    setListingPage(1);
  }, [listingCategoryFilter, recentListings.length]);

  useEffect(() => {
    const fetchEarnings = async () => {
      if (!user) {
        setTotalEarnings(0);
        setLoadingEarnings(false);
        return;
      }

      try {
        // Fetch from hostEarnings collection instead of calculating from bookings
        const hostEarningsRef = doc(db, 'hostEarnings', user.uid);
        const hostEarningsSnap = await getDoc(hostEarningsRef);
        if (hostEarningsSnap.exists()) {
          const data = hostEarningsSnap.data();
          setTotalEarnings(data.totalEarnings || 0);
        } else {
          setTotalEarnings(0);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading earnings', err);
        setTotalEarnings(0);
      } finally {
        setLoadingEarnings(false);
      }
    };

    fetchEarnings();
  }, [user]);

  const recomputeStatsFromListings = (listings) => {
    let total = 0;
    let published = 0;
    let drafts = 0;
    listings.forEach((l) => {
      total += 1;
      if (l.status === 'published') published += 1;
      if (l.status === 'draft') drafts += 1;
    });
    setStats({ total, published, drafts });
  };

  const handleUnpublish = async (listing) => {
    if (listing.status !== 'published') return;
    try {
      const ref = doc(db, 'listings', listing.id);
      await updateDoc(ref, {
        status: 'draft',
      });
      setRecentListings((prev) => {
        const updated = prev.map((l) => (l.id === listing.id ? { ...l, status: 'draft' } : l));
        recomputeStatsFromListings(updated);
        return updated;
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to unpublish listing from dashboard', err);
    }
  };

  const handleDelete = async (listing) => {
    try {
      const ref = doc(db, 'listings', listing.id);
      await deleteDoc(ref);
      setRecentListings((prev) => {
        const updated = prev.filter((l) => l.id !== listing.id);
        recomputeStatsFromListings(updated);
        return updated;
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete listing from dashboard', err);
    }
  };

  const listingLimitLabel = () => {
    if (!hostProfile) return '—';
    if (hostProfile.listingLimit === null || hostProfile.listingLimit === undefined) {
      return 'Unlimited listings';
    }
    return `${hostProfile.listingLimit} listings`;
  };

  const filteredListings = recentListings.filter((listing) => {
    if (listingCategoryFilter === 'all') return true;
    if (!listing.category) return false;
    return listing.category === listingCategoryFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / LISTINGS_PAGE_SIZE) || 1);
  const currentPage = Math.min(listingPage, totalPages);
  const startIndex = (currentPage - 1) * LISTINGS_PAGE_SIZE;
  const pageListings = filteredListings.slice(startIndex, startIndex + LISTINGS_PAGE_SIZE);


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Host Dashboard</h1>
            <p className="text-gray-600">Overview of your hosting activity and earnings.</p>
          </div>
          <Link
            to="/host/listings"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-green-700 transition"
          >
            Create a new listing
          </Link>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total listings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loadingStats ? '—' : stats.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Published</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loadingStats ? '—' : stats.published}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Drafts</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{loadingStats ? '—' : stats.drafts}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total earnings</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {loadingEarnings ? '—' : `₱${totalEarnings.toLocaleString()}`}
            </p>
            <p className="mt-1 text-xs text-gray-500">Based on accepted and confirmed bookings</p>
          </div>
        </div>
        {/* Subscription plan */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription plan</h2>
          {loadingProfile && <p className="text-sm text-gray-600">Loading plan details...</p>}
          {!loadingProfile && !hostProfile && (
            <p className="text-sm text-gray-600">
              No host profile found. Complete host registration to see your plan details.
            </p>
          )}
          {!loadingProfile && hostProfile && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Plan</p>
                <p className="text-sm text-gray-900">{hostProfile.subscriptionPlan || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Price</p>
                <p className="text-sm text-gray-900">
                  {hostProfile.subscriptionPrice !== undefined
                    ? `₱${hostProfile.subscriptionPrice}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Listing limit</p>
                <p className="text-sm text-gray-900">{listingLimitLabel()}</p>
              </div>
            </div>
          )}
        </div>


        {/* My listings */}
        {recentListings.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">My listings</h2>
              <Link
                to="/host/listings"
                className="text-sm text-green-700 hover:text-green-800 font-medium"
              >
                Manage listings
              </Link>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              A quick view of your listings. Use the filter to switch between listing types, or go to the Listings tab to edit and create more.
            </p>

            {/* Category filter chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'all', label: 'All' },
                { key: 'home', label: 'Homes' },
                { key: 'experience', label: 'Experiences' },
                { key: 'service', label: 'Services' },
              ].map((opt) => {
                const selected = listingCategoryFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setListingCategoryFilter(opt.key)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition whitespace-nowrap ${
                      selected
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {pageListings.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">No listings in this category yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageListings.map((listing) => {
                const imageSrc =
                  listing.coverImage ||
                  (listing.images && listing.images.length > 0 ? listing.images[0] : null) ||
                  (listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls[0] : null) ||
                  'https://via.placeholder.com/320x200?text=No+Image';
                return (
                  <div
                    key={listing.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-32 bg-gray-200 rounded-lg overflow-hidden mb-3">
                        <img
                          src={imageSrc}
                          alt={listing.title || 'Listing image'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {listing.title || 'Untitled listing'}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {listing.location || 'No location set'}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-gray-700">
                          {listing.category
                            ? listing.category.charAt(0).toUpperCase() + listing.category.slice(1)
                            : '—'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            listing.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {listing.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    {listing.rate != null && (
                      <p className="mt-2 text-xs text-gray-700">
                        <span className="font-semibold">₱{listing.rate}</span> / night
                      </p>
                    )}
                    <div className="mt-3 flex gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => navigate(`/host/listings?edit=${listing.id}`)}
                        className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      {listing.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleUnpublish(listing)}
                          className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(listing)}
                        className="px-3 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}

            {/* Pagination controls */}
            {filteredListings.length > LISTINGS_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={() => setListingPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-md border ${
                    currentPage === 1
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages} • {filteredListings.length} listing
                  {filteredListings.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setListingPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-md border ${
                    currentPage === totalPages
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-600">
            You don't have any listings yet. Start by creating your first listing.
          </div>
        )}
      </div>
    </div>
  );
}
