export default function AdminPoliciesPage() {
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
      p { font-size: 13px; margin-top: 0; color: #4b5563; }
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
      <li>Guests can cancel up to 24 hours before check-in for a full refund.</li>
      <li>Hosts must approve cancellations within 48 hours.</li>
      <li>Service fees are non-refundable in case of no-show.</li>
    </ul>
    <h2>Rules & Regulations</h2>
    <ul>
      <li>All listings must comply with local laws and regulations.</li>
      <li>Hosts are responsible for accurate listing information.</li>
      <li>Platform reserves the right to remove listings that violate policies.</li>
    </ul>
    <h2>Compliance Overview</h2>
    <p>
      Use these policies together with your admin reports to support compliance audits, including booking data,
      host verifications, and policy adherence.
    </p>
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
          <button
            type="button"
            onClick={handlePrintPolicies}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-green-100 rounded-lg p-6 shadow-sm">
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
