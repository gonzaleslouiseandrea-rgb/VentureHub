import React from 'react';

export default function SearchBar() {
  return (
    <form className="flex" onSubmit={(e) => e.preventDefault()}>
      <input
        className="flex-1 max-w-2xl px-5 py-2 bg-white border border-gray-300 rounded-full placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900"
        placeholder="Anywhere · Any week · Add guests"
      />
    </form>
  );
}
