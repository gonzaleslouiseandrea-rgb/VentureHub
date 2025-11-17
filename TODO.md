# TODO: Implement Admin Side

## Steps to Complete

- [ ] Create AdminLayout.jsx: Layout component for admin pages, similar to HostLayout.jsx.
- [ ] Create AdminDashboard.jsx: Overview page with key metrics (total hosts, bookings, earnings, subscriptions).
- [ ] Create AdminAnalytics.jsx: Analytics for reviews (best/lowest), bookings list, charts.
- [ ] Create AdminReports.jsx: Page for generating and downloading reports (bookings, earnings, compliance).
- [ ] Create AdminPayments.jsx: Manage payment methods, confirm/review payments.
- [ ] Create AdminPolicies.jsx: Display policy & compliance rules, regulations, reports.
- [ ] Update App.jsx: Add /admin/* routes with admin protection.
- [ ] Implement admin role check: Use Firebase custom claims or simple email check for admin access.
- [ ] Add Firebase queries: For hosts, bookings, reviews, payments collections.
- [ ] Test admin access and data loading.

## Followup Steps

- [ ] Integrate payment provider if needed (e.g., Stripe for confirm/review).
- [ ] Add export functionality for reports (CSV/PDF).
- [ ] Handle edge cases: No data, loading states, errors.
- [ ] Verify admin-only access.
