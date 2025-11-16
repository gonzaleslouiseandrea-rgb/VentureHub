import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', path: '/host/dashboard' },
  { label: 'Listings', path: '/host/listings' },
  { label: 'Bookings', path: '/host/bookings' },
  { label: 'Messages', path: '/host/messages' },
  { label: 'Calendar', path: '/host/calendar' },
  { label: 'Account', path: '/host/account' },
];

export default function HostHeader() {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-bold text-2xl text-green-700 hover:text-green-800 transition">
          VentureHub
        </Link>

        <nav className="flex gap-8 items-center ml-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`font-medium transition ${
                  isActive
                    ? 'text-green-700 border-b-2 border-green-700'
                    : 'text-gray-700 hover:text-green-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
