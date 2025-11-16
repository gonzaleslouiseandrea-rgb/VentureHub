import React, { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import ListingCard from '../components/ListingCard.jsx';
import useFavorites from '../hooks/useFavorites.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AirbnbClone() {
  const { favorites, toggleFavorite } = useFavorites();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const listingsRef = collection(db, 'listings');
        const q = query(listingsRef, where('status', '==', 'published'));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setListings(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading listings for Airbnb page', err);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  const filteredListings = listings.filter((l) => {
    if (selectedFilter === 'all') return true;
    return l.category === selectedFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div>
        {/* Hero Section */}
        <section className="relative text-white overflow-hidden h-1/2 flex items-center">
          <video
            autoPlay
            muted
            loop
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
            <h1 className="text-5xl font-bold mb-4">Find a place to stay</h1>
            <p className="text-xl opacity-90 mb-8">Discover unique homes and experiences all over the world</p>

            {/* Smart Filter */}
            <div className="flex justify-center space-x-4 mt-8">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-white text-green-700'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedFilter('home')}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  selectedFilter === 'home'
                    ? 'bg-white text-green-700'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setSelectedFilter('experience')}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  selectedFilter === 'experience'
                    ? 'bg-white text-green-700'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                Experience
              </button>
              <button
                onClick={() => setSelectedFilter('service')}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  selectedFilter === 'service'
                    ? 'bg-white text-green-700'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                Service
              </button>
            </div>
          </div>
        </section>

        {/* Listings Section */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {selectedFilter === 'all' ? 'All Listings' : selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1) + 's'}
          </h2>
          <p className="text-gray-600 mb-8">
            {selectedFilter === 'all'
              ? 'Explore our collection of handpicked properties'
              : `Discover amazing ${selectedFilter}s in your area`}
          </p>
          {loading ? (
            <p className="text-gray-600">Loading listings...</p>
          ) : filteredListings.length === 0 ? (
            <p className="text-gray-600">
              {selectedFilter === 'all'
                ? 'No listings are published yet. Check back soon.'
                : `No ${selectedFilter} listings are published yet. Check back soon.`}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={{
                    id: l.id,
                    title: l.title,
                    location: l.location,
                    price: l.rate || 0,
                    rating: 'N/A',
                    image: l.coverImage,
                  }}
                  showFavorite
                  isFavorite={favorites.has(l.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
