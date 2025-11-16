import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where as whereFilter } from 'firebase/firestore';
import { db } from '../firebase.js';
import Header from '../components/Header.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const [where, setWhere] = useState('');
  const [start, setStart] = useState('');
  const [who, setWho] = useState('');
  const [featuredListings, setFeaturedListings] = useState([]);
  const [experienceListings, setExperienceListings] = useState([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const listingsRef = collection(db, 'listings');
        const q = query(listingsRef, whereFilter('status', '==', 'published'), limit(6));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFeaturedListings(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading featured listings', err);
        setFeaturedListings([]);
      }
    };

    const fetchExperiences = async () => {
      try {
        const listingsRef = collection(db, 'listings');
        const q = query(
          listingsRef,
          whereFilter('status', '==', 'published'),
          whereFilter('category', '==', 'experience'),
          limit(3),
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setExperienceListings(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading experience listings', err);
        setExperienceListings([]);
      }
    };

    fetchFeatured();
    fetchExperiences();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (where) params.set('where', where);
    if (start) params.set('checkIn', start);
    if (who) params.set('guests', who);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-green-50 flex flex-col">
      <Header />

      {/* Hero section */}
      <div
        className="relative pt-20 pb-16 bg-gradient-to-b from-green-700/90 to-green-800/90"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Slow stays and local experiences, curated for you.
            </h1>
            <p className="text-lg text-white/90 mb-8 leading-relaxed">
              VentureHub connects you with character-filled homes, unique activities, and trusted
              local hosts across the Philippines.
            </p>
          </div>

          {/* Hero search */}
          <div className="mt-6 bg-white/95 backdrop-blur rounded-2xl shadow-lg p-5 max-w-4xl">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Plan your next trip
            </p>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
              />
              <input
                type="text"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Where to?"
                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
              />
              <input
                type="number"
                min="1"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="Guests"
                className="w-24 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-8 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-full hover:bg-green-800 transition border border-green-700 flex-shrink-0 md:flex-grow"
              >
                Search a Hub
              </button>
              <button
                onClick={() => navigate('/host-register')}
                className="px-5 py-2.5 bg-white/10 text-sm font-semibold rounded-full text-white border border-white/40 hover:bg-white/20 transition flex-shrink-0"
              >
                Become a host
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Featured stays */}
      <div className="bg-green-50 py-14 border-b border-green-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Featured stays</h2>
              <p className="text-gray-600 mt-1">Handpicked homes and spaces from VentureHub hosts.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/browse')}
              className="hidden md:inline-flex text-sm font-medium text-green-700 hover:text-green-900"
            >
              View all
              <span className="ml-1">→</span>
            </button>
          </div>

          {featuredListings.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No listings are published yet. Check back soon as hosts start adding their spaces.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/listing/${listing.id}`)}
                  className="bg-white rounded-2xl border border-green-100 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
                >
                  <div className="h-48 bg-gray-200 relative">
                    {listing.coverImage && (
                      <img
                        src={listing.coverImage}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wide text-green-700 mb-1">
                      {listing.category || 'Stay'}
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                      {listing.title || 'Untitled listing'}
                    </h3>
                    <p className="text-sm text-gray-600 truncate mb-3">{listing.location || 'Location to be announced'}</p>
                    {listing.rate && (
                      <p className="text-sm font-semibold text-gray-900">
                        ₱{listing.rate}
                        <span className="text-xs text-gray-500"> / night</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unique experiences (real listings) */}
      <div className="bg-green-50 py-14 border-b border-green-100">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Unique experiences</h2>
          <p className="text-gray-600 mb-8">Book activities hosted by locals around the Philippines.</p>

          {experienceListings.length === 0 ? (
            <p className="text-sm text-gray-600">
              Experiences will appear here once hosts start publishing them.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {experienceListings.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/listing/${listing.id}`)}
                  className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden cursor-pointer hover:shadow-md transition"
                >
                  <div className="h-40 bg-gray-200">
                    {listing.coverImage && (
                      <img
                        src={listing.coverImage}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wide text-green-700 mb-1">Experience</p>
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">{listing.title}</h3>
                    <p className="text-sm text-gray-600 mb-2 truncate">{listing.location}</p>
                    {listing.rate && (
                      <p className="text-sm font-semibold text-gray-900">
                        ₱{listing.rate}
                        <span className="text-xs text-gray-500"> per guest</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Why choose VentureHub */}
      <div className="bg-green-50 py-14 border-b border-green-100">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Why choose VentureHub?</h2>
          <p className="text-gray-600 mb-10">
            Experience the difference of a platform built for local hosts and mindful travelers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Secure bookings</h3>
              <p className="text-sm text-gray-600">Your safety and security are at the center of every stay.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Verified hosts</h3>
              <p className="text-sm text-gray-600">Hosts complete verification steps so you can book with confidence.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Helpful support</h3>
              <p className="text-sm text-gray-600">Messages and notifications keep you in sync with your host before and during your stay.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Local insight</h3>
              <p className="text-sm text-gray-600">Discover neighborhoods, small businesses, and experiences curated by locals.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Real stories strip */}
      <div className="bg-white py-10 border-t border-b border-green-100">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Real stories from travelers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-700">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="mb-3">
                “Our host helped us plan a weekend away from the city. The space looked exactly like
                the photos and the local tips were spot on.”
              </p>
              <p className="text-xs text-gray-500">Amie • Weekend stay outside Manila</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="mb-3">
                “Booking through VentureHub made it easy to coordinate with our host. Check‑in was
                smooth and the neighborhood recommendations were super helpful.”
              </p>
              <p className="text-xs text-gray-500">Luis • Workation in Cebu</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="mb-3">
                “We tried a small group cooking experience and it ended up being the highlight of
                our trip. It felt like visiting family.”
              </p>
              <p className="text-xs text-gray-500">Mara • Food & culture experience</p>
            </div>
          </div>
        </div>
      </div>

      {/* Host CTA band */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white py-14">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="uppercase text-xs tracking-[0.2em] text-white/70 mb-2">For hosts</p>
            <h2 className="text-3xl font-bold mb-3">Earn extra income as a VentureHub host.</h2>
            <p className="text-sm md:text-base text-white/90 mb-5">
              List a spare room, a vacation home, or an experience you love sharing. Our tools help
              you manage bookings, calendars, and guest communication in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/host-register')}
                className="px-6 py-2.5 bg-white text-green-800 text-sm font-semibold rounded-full hover:bg-green-50 transition"
              >
                Get started as a host
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & footer */}
      <div className="bg-[#21312a] text-gray-200 pt-10 pb-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-2">Your trust, our priority</h3>
              <p className="text-sm text-gray-300">
                Were committed to helping guests and hosts connect safely through clear profiles,
                messaging, and transparent reviews.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Guests</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>Browse homes, experiences, and services</li>
                <li>Secure booking and payment flows</li>
                <li>Support from hosts through in-app messaging</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Hosts</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>Multi-step listing setup with map and pricing</li>
                <li>Dashboard for bookings, calendar, and messages</li>
                <li>Flexible plans as your hosting grows</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} VentureHub. All rights reserved.
            </p>
            <p className="text-xs text-gray-500">
              Built to connect guests with curated homes, experiences, and services around the world.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
