import React from 'react';
import { Link } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';

export default function ListingCard({ listing, showFavorite = false, isFavorite = false, onToggleFavorite }) {
  return (
    <article className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
      <Link to={`/listing/${listing.id}`} className="block relative group">
        <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
          <img
            src={listing.image || 'https://via.placeholder.com/320x200?text=Photo'}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {(listing.discount || listing.promo) && (
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {listing.discount && (
                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {listing.discount}% OFF
                </div>
              )}
              {listing.promo && (
                <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {listing.promo}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>
          <p className="text-sm text-gray-600 truncate">{listing.location}</p>
          <div className="mt-3 flex justify-between items-center">
            <div className="flex flex-col">
              {listing.discount && (
                <span className="text-xs text-gray-500 line-through">${listing.price}</span>
              )}
              <span className="font-bold text-gray-900">
                ${listing.discount ? Math.round(listing.price * (1 - listing.discount / 100)) : listing.price}
              </span>
            </div>
            <span className="text-sm text-gray-600">{listing.rating} ★</span>
          </div>
        </div>
      </Link>
      {showFavorite && (
        <div className="absolute top-3 right-3">
          <IconButton
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggleFavorite) onToggleFavorite(listing.id);
            }}
          >
            {isFavorite ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
          </IconButton>
        </div>
      )}
    </article>
  );
}
