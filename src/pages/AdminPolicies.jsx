import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function AdminPoliciesPage() {
  const [cancellationRules, setCancellationRules] = useState('');
  const [regulations, setRegulations] = useState('');
  const [complianceOverview, setComplianceOverview] = useState('');
  const [subscriptionInclusions, setSubscriptionInclusions] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const ref = doc(db, 'adminSettings', 'policies');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setCancellationRules(data.cancellationRules || 'Guests can cancel up to 24 hours before check-in for a full refund.\nHosts must approve cancellations within 48 hours.\nService fees are non-refundable in case of no-show.');
          setRegulations(data.regulations || 'All listings must comply with local laws and regulations.\nHosts are responsible for accurate listing information.\nPlatform reserves the right to remove listings that violate policies.');
          setComplianceOverview(data.complianceOverview || 'Use these policies together with your admin reports to support compliance audits, including booking data, host verifications, and policy adherence.');
          setSubscriptionInclusions(data.subscriptionInclusions || 'Host subscription plans may include: listing slots, featured placement, reduced platform fees, and access to premium support.\nUse one bullet per line to describe what is included for subscribed hosts.');
        } else {
          setCancellationRules('Guests can cancel up to 24 hours before check-in for a full refund.\nHosts must approve cancellations within 48 hours.\nService fees are non-refundable in case of no-show.');
          setRegulations('All listings must comply with local laws and regulations.\nHosts are responsible for accurate listing information.\nPlatform reserves the right to remove listings that violate policies.');
          setComplianceOverview('Use these policies together with your admin reports to support compliance audits, including booking data, host verifications, and policy adherence.');
          setSubscriptionInclusions('Host subscription plans may include: listing slots, featured placement, reduced platform fees, and access to premium support.\nUse one bullet per line to describe what is included for subscribed hosts.');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading admin policies', err);
        setMessage('Failed to load policies. Using defaults.');
        setTimeout(() => setMessage(''), 4000);
      } finally {
        setLoading(false);
      }
    };

    loadPolicies();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      const ref = doc(db, 'adminSettings', 'policies');
      await setDoc(
        ref,
        {
          cancellationRules,
          regulations,
          complianceOverview,
          subscriptionInclusions,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setMessage('Policies saved successfully.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error saving admin policies', err);
      setMessage('Failed to save policies. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const handlePrintPolicies = () => {
    const generatedAt = new Date().toLocaleString();

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>Policies & Compliance</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #f9fafb; color: #111827; }
      .vh-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .vh-brand { font-size: 18px; font-weight: 700; color: #16a34a; }
      .vh-meta { font-size: 11px; color: #6b7280; text-align: right; }
      h1 { font-size: 20px; margin: 4px 0 2px 0; }
      h2 { font-size: 16px; margin-top: 16px; margin-bottom: 4px; }
      p, li { font-size: 13px; color: #4b5563; }
      ul { font-size: 13px; color: #4b5563; padding-left: 18px; }
      li { margin-bottom: 2px; }
      hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0 16px 0; }
      @media print { body { background: #ffffff; } }
    </style>
  </head>
  <body>
    <div class="vh-header">
      <div class="vh-brand">VentureHub Admin</div>
      <div class="vh-meta">
        <div>Policies & Compliance</div>
        <div>Generated: ${generatedAt}</div>
      </div>
    </div>
    <h1>Policies & Compliance</h1>
    <p>Platform rules, regulations, and compliance information for hosts and guests.</p>
    <hr />
    <h2>Cancellation Rules</h2>
    <ul>
      ${cancellationRules
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<li>${line}</li>`)
        .join('')}
    </ul>
    <h2>Rules & Regulations</h2>
    <ul>
      ${regulations
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<li>${line}</li>`)
        .join('')}
    </ul>
    <h2>Compliance Overview</h2>
    <p>
      ${complianceOverview}
    </p>
    <h2>Subscription Plan Inclusions</h2>
    <ul>
      ${subscriptionInclusions
        .split('\\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<li>${line}</li>`)
        .join('')}
    </ul>
  </body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-green-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Policies & Compliance</h1>
            <p className="text-gray-600">Platform rules, regulations, and compliance reports.</p>
          </div>
          <div className="flex items-center gap-3">
            {message && (
              <span className="text-xs text-gray-700 bg-white/80 border border-gray-200 rounded-full px-3 py-1">
                {message}
              </span>
            )}
            <button
              type="button"
              onClick={handlePrintPolicies}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Cancellation Rules</h2>
              {loading && <span className="text-xs text-gray-500">Loading…</span>}
            </div>
            <p className="text-xs text-gray-500 mb-2">
              One rule per line. These are shown to hosts and guests when they view cancellation policies.
            </p>
            <textarea
              value={cancellationRules}
              onChange={(e) => setCancellationRules(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Rules & Regulations</h2>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              General platform rules. Use a new line for each bullet point.
            </p>
            <textarea
              value={regulations}
              onChange={(e) => setRegulations(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Compliance Overview</h2>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              High-level explanation used in printed reports and compliance exports.
            </p>
            <textarea
              value={complianceOverview}
              onChange={(e) => setComplianceOverview(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Subscription Plan Inclusions</h2>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Describe what subscribed hosts receive (e.g. listing slots, featured placement). One inclusion per line.
            </p>
            <textarea
              value={subscriptionInclusions}
              onChange={(e) => setSubscriptionInclusions(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Policies'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
