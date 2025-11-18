import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostCouponsPage() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    discountPercent: '',
    minAmount: '',
    description: '',
    category: 'all',
    validFrom: '',
    validUntil: '',
  });
  const [saving, setSaving] = useState(false);
  const [validDates, setValidDates] = useState([null, null]);

  const formatDisplayDate = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  let validRangeDisplay = '';
  if (validDates[0] && validDates[1]) {
    validRangeDisplay = `${formatDisplayDate(validDates[0])}  ${formatDisplayDate(validDates[1])}`;
  } else if (validDates[0]) {
    validRangeDisplay = `${formatDisplayDate(validDates[0])} `;
  }

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setCoupons([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const couponsRef = collection(db, 'coupons');
        const q = query(couponsRef, where('hostId', '==', user.uid));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCoupons(items);
      } catch (err) {
        setError(err.message || 'Failed to load coupons');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, code: result }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleValidRangeChange = (dates) => {
    const [start, end] = dates;
    setValidDates([start, end]);

    const format = (d) => (d instanceof Date && !Number.isNaN(d.getTime())
      ? d.toISOString().slice(0, 10)
      : '');

    const startStr = format(start);
    const endStr = format(end);

    setForm((prev) => ({
      ...prev,
      validFrom: startStr,
      validUntil: endStr,
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!form.code.trim() || !form.discountPercent || !form.minAmount) {
      setError('Enter a code, discount percent, and minimum amount');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const couponsRef = collection(db, 'coupons');
      const discountPercent = Number(form.discountPercent) || 0;
      const minAmount = Number(form.minAmount) || 0;
      const category = form.category || 'all';

      const validFrom = form.validFrom ? new Date(form.validFrom) : null;
      const validUntil = form.validUntil ? new Date(form.validUntil) : null;

      const payload = {
        hostId: user.uid,
        code: form.code.trim().toUpperCase(),
        discountPercent,
        minAmount,
        description: form.description.trim() || '',
        category,
        active: true,
        createdAt: serverTimestamp(),
        ...(validFrom && { validFrom }),
        ...(validUntil && { validUntil }),
      };
      const ref = await addDoc(couponsRef, payload);
      setCoupons((prev) => [...prev, { id: ref.id, ...payload }]);
      setForm({
        code: '',
        discountPercent: '',
        minAmount: '',
        description: '',
        category: 'all',
        validFrom: '',
        validUntil: '',
      });
      setValidDates([null, null]);
    } catch (err) {
      setError(err.message || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    try {
      const ref = doc(db, 'coupons', coupon.id);
      await updateDoc(ref, { active: !coupon.active });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c)));
    } catch (err) {
      setError(err.message || 'Failed to update coupon');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Coupons</h2>
      <p className="text-sm text-gray-600 mb-4">
        Create and manage coupon codes that guests can apply during booking.
      </p>

      {error && (
        <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={handleGenerateCode}
              className="px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Generate
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
          <input
            type="number"
            name="discountPercent"
            value={form.discountPercent}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Minimum amount</label>
          <input
            type="number"
            name="minAmount"
            value={form.minAmount}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <input
            type="text"
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All listings</option>
            <option value="home">Homes</option>
            <option value="experience">Experiences</option>
            <option value="service">Services</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Valid date range (optional)</label>
          <DatePicker
            selected={validDates[0]}
            onChange={handleValidRangeChange}
            startDate={validDates[0]}
            endDate={validDates[1]}
            selectsRange
            monthsShown={1}
            minDate={new Date()}
            dateFormat="MMM dd, yyyy"
            placeholderText="Select date range"
            value={validRangeDisplay}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            calendarClassName="!text-xs"
            renderCustomHeader={(headerProps) => (
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  type="button"
                  onClick={headerProps.decreaseMonth}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                >
                  Prev
                </button>
                <span className="text-sm font-semibold text-gray-800">
                  {headerProps.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={headerProps.increaseMonth}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            )}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Add coupon'}
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Your coupons</h3>
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
        </div>
        {coupons.length === 0 && !loading ? (
          <div className="px-4 py-4 text-sm text-gray-500">No coupons yet. Create your first coupon above.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Discount</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Min amount</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Category</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Valid dates</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono">{c.code}</td>
                  <td className="px-4 py-2">{typeof c.discountPercent === 'number' ? `${c.discountPercent}%` : ''}</td>
                  <td className="px-4 py-2">
                    {typeof c.minAmount === 'number' ? `₱${c.minAmount.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{c.description}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {c.category === 'home' && 'Homes'}
                    {c.category === 'experience' && 'Experiences'}
                    {c.category === 'service' && 'Services'}
                    {!c.category || c.category === 'all' ? 'All listings' : null}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {(() => {
                      const from = c.validFrom?.toDate ? c.validFrom.toDate() : null;
                      const until = c.validUntil?.toDate ? c.validUntil.toDate() : null;
                      if (!from && !until) return '—';
                      const format = (d) => d.toLocaleDateString();
                      if (from && until) return `${format(from)} – ${format(until)}`;
                      if (from) return `From ${format(from)}`;
                      return `Until ${format(until)}`;
                    })()}
                  </td>
                  <td className="px-4 py-2">
                    {c.active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded-full hover:bg-gray-50"
                    >
                      {c.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
