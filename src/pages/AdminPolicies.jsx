export default function AdminPoliciesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Policies & Compliance</h1>
            <p className="text-gray-600">Platform rules, regulations, and compliance reports.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cancellation Rules</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Guests can cancel up to 24 hours before check-in for a full refund.</li>
              <li>Hosts must approve cancellations within 48 hours.</li>
              <li>Service fees are non-refundable in case of no-show.</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rules & Regulations</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>All listings must comply with local laws and regulations.</li>
              <li>Hosts are responsible for accurate listing information.</li>
              <li>Platform reserves the right to remove listings that violate policies.</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Reports</h2>
            <p className="text-sm text-gray-600 mb-4">
              Generate reports for compliance audits, including booking data, host verifications, and policy adherence.
            </p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Generate Compliance Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
