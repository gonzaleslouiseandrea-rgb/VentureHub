import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../airbnb.css';
import SearchIcon from '@mui/icons-material/Search';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { Snackbar, Alert } from '@mui/material';
import Header from '../components/Header.jsx';
import ListingCard from '../components/ListingCard.jsx';
import useFavorites from '../hooks/useFavorites.js';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const categories = [
  { key: 'all', label: 'All' },
  { key: 'home', label: 'Homes' },
  { key: 'experience', label: 'Experiences' },
  { key: 'service', label: 'Services' },
  { key: 'wishlist', label: 'My Wishlist' },
];

export default function BrowsePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavorites();
  const { user } = useAuth();

  const [activeCategory, setActiveCategory] = useState('all');
  const [userWishlistCategories, setUserWishlistCategories] = useState([]);
  
  // Parse query params and initialize state
  const initialWhere = searchParams.get('where') || '';
  const [search, setSearch] = useState(initialWhere);
  
  const checkInParam = searchParams.get('checkIn');
  const checkOutParam = searchParams.get('checkOut');
  const [checkIn, setCheckIn] = useState(checkInParam ? new Date(checkInParam) : null);
  const [checkOut, setCheckOut] = useState(checkOutParam ? new Date(checkOutParam) : null);
  const [dateError, setDateError] = useState('');
  
  const guestsParam = searchParams.get('guests');
  const [guests, setGuests] = useState(guestsParam || '');

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState({});
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

  const getDateRangeText = () => {
    if (!checkIn && !checkOut) return 'Check-in & Check-out';
    if (checkIn && !checkOut) return `${checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → Select check-out`;
    if (checkIn && checkOut) {
      return `${checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Check-in & Check-out';
  };

  useEffect(() => {
    const fetchUserWishlist = async () => {
      if (user) {
        try {
          const wishlistRef = doc(db, 'wishlistPreferences', user.uid);
          const wishlistSnap = await getDoc(wishlistRef);
          if (wishlistSnap.exists()) {
            const data = wishlistSnap.data();
            setUserWishlistCategories(data.categories || []);
          } else {
            setUserWishlistCategories([]);
          }
        } catch (err) {
          console.error('Error fetching wishlist preferences', err);
          setUserWishlistCategories([]);
        }
      } else {
        setUserWishlistCategories([]);
      }
    };

    fetchUserWishlist();
  }, [user]);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        let q = collection(db, 'listings');
        if (activeCategory === 'wishlist') {
          if (userWishlistCategories.length > 0) {
            q = query(q, where('category', 'in', userWishlistCategories));
          } else {
            // If no wishlist categories, show no listings
            setListings([]);
            setLoading(false);
            return;
          }
        } else if (activeCategory !== 'all') {
          q = query(q, where('category', '==', activeCategory));
        }
        const snapshot = await getDocs(q);
        let items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        if (search) {
          const lower = search.toLowerCase();
          items = items.filter(
            (item) =>
              (item.title && item.title.toLowerCase().includes(lower)) ||
              (item.location && item.location.toLowerCase().includes(lower)),
          );
        }
        if (guests) {
          const requestedGuests = Number(guests);
          if (!Number.isNaN(requestedGuests) && requestedGuests > 0) {
            items = items.filter((item) => {
              if (item.maxGuests === null || item.maxGuests === undefined) return true;
              return Number(item.maxGuests) >= requestedGuests;
            });
          }
        }
        const published = items.filter((item) => item.status === 'published');
        setListings(published);

        // Load ratings per listing
        try {
          const reviewsRef = collection(db, 'reviews');
          const ratingEntries = await Promise.all(
            published.map(async (item) => {
              const rq = query(reviewsRef, where('listingId', '==', item.id));
              const rsnap = await getDocs(rq);
              if (rsnap.empty) return [item.id, { avg: null, count: 0 }];
              let sum = 0;
              let count = 0;
              rsnap.forEach((r) => {
                const data = r.data();
                if (typeof data.rating === 'number') {
                  sum += data.rating;
                  count += 1;
                }
              });
              if (count === 0) return [item.id, { avg: null, count: 0 }];
              return [item.id, { avg: sum / count, count }];
            }),
          );
          const map = {};
          ratingEntries.forEach(([id, value]) => {
            map[id] = value;
          });
          setRatings(map);
        } catch (ratingErr) {
          // eslint-disable-next-line no-console
          console.error('Error loading listing ratings', ratingErr);
          setRatings({});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [activeCategory, search, guests]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Explore stays, experiences, and services</h1>
            <p className="text-gray-600">Filter by category or search by location and title.</p>
          </div>

          {/* Filter panel: smart category filter only */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-4 py-2 rounded-full font-medium transition ${
                    activeCategory === cat.key
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>


          {/* Listings grid */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {activeCategory === 'wishlist' && userWishlistCategories.length === 0
                  ? user
                    ? 'You have not set any wishlist preferences yet. Go to your account to set them.'
                    : 'Log in and set your wishlist preferences to see personalized listings.'
                  : 'No listings found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <div key={listing.id} className="relative">
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate(`/listing/${listing.id}`)}
                  >
                    <ListingCard
                      listing={{
                        id: listing.id,
                        title: listing.title,
                        location: listing.location,
                        price: listing.rate || 0,
                        rating: ratings[listing.id]?.avg?.toFixed(1) || 'N/A',
                        image: listing.coverImage,
                      }}
                      showFavorite={false}
                    />
                  </div>
                  {/* Favorite button overlay */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(listing.id);
                      }}
                      className="p-2 rounded-full bg-white/90 shadow"
                      aria-label="toggle favorite"
                    >
                      {favorites.has(listing.id) ? (
                        <FavoriteIcon color="error" />
                      ) : (
                        <FavoriteBorderIcon />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={(e, reason) => {
          if (reason === 'clickaway') return;
          setSnack((s) => ({ ...s, open: false }));
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
