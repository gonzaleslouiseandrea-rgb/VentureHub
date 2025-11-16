# TODO: Fix Guest Booking Issue

- [x] Investigate why guests can't book listings
  - [x] Check if VITE_PAYPAL_CLIENT_ID is set in environment
  - [x] Verify Firebase rules allow booking creation
  - [x] Test booking flow in browser
  - [x] Fix booking status and paid field in ListingDetail.jsx onApprove
  - [x] Ensure consistent booking flow between initial booking and host acceptance
- [x] Change button text from "Book with PayPal" to "Request to Book"
- [x] Update success message to indicate booking request sent to host
- [x] Limit guest count to what the host has set for the listing
- [x] Improve promo code visibility by adding a dedicated section above the description
