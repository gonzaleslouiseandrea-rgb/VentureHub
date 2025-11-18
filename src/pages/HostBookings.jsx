import { useEffect, useState } from 'react';
import { Box, Button, Chip, Grid, Paper, Typography, Snackbar, Alert } from '@mui/material';
import { collection, doc, getDoc, getDocs, query, updateDoc, where, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { sendBookingDetails } from '../utils/emailService.js';

export default function HostBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [wishlistByBooking, setWishlistByBooking] = useState({});

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) {
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(bookingsRef, where('hostId', '==', user.uid));
        const snap = await getDocs(q);
        const results = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          let listing = null;
          if (data.listingId) {
            const listingRef = doc(db, 'listings', data.listingId);
            const listingSnap = await getDoc(listingRef);
            if (listingSnap.exists()) {
              listing = { id: listingSnap.id, ...listingSnap.data() };
            }
          }
          results.push({ id: docSnap.id, ...data, listing });
        }

        setBookings(results);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading host bookings', err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  useEffect(() => {
    const fetchWishlistSuggestions = async () => {
      if (!user) {
        setWishlistByBooking({});
        return;
      }

      try {
        const suggestionsRef = collection(db, 'hostWishlistSuggestions');
        const qSuggestions = query(suggestionsRef, where('hostId', '==', user.uid));
        const snap = await getDocs(qSuggestions);
        const map = {};
        snap.forEach((d) => {
          const data = d.data();
          const bookingId = data.bookingId;
          if (!bookingId) return;
          if (!map[bookingId]) map[bookingId] = [];
          map[bookingId].push({ id: d.id, ...data });
        });
        setWishlistByBooking(map);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading wishlist suggestions for host', err);
        setWishlistByBooking({});
      }
    };

    fetchWishlistSuggestions();
  }, [user]);

  const awardHostPoints = async (hostId, points, reason, metadata = {}) => {
    if (!hostId || !points) return;
    try {
      const hostRef = doc(db, 'hosts', hostId);
      const hostSnap = await getDoc(hostRef);

      let lifetime = 0;
      let available = 0;
      if (hostSnap.exists()) {
        const data = hostSnap.data();
        lifetime = (data.points && typeof data.points.lifetime === 'number') ? data.points.lifetime : 0;
        available = (data.points && typeof data.points.available === 'number') ? data.points.available : 0;
      }

      const newLifetime = lifetime + points;
      const newAvailable = available + points;

      await setDoc(
        hostRef,
        {
          points: {
            lifetime: newLifetime,
            available: newAvailable,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const eventsRef = collection(db, 'hostPointsEvents');
      await addDoc(eventsRef, {
        hostId,
        points,
        reason,
        metadata,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to award host points', err);
    }
  };

  const getEffectivePlatformFeePercent = async (hostId, basePercent = 15) => {
    try {
      const discountsRef = collection(db, 'hostFeeDiscounts');
      const q = query(discountsRef, where('hostId', '==', hostId));
      const snap = await getDocs(q);
      if (snap.empty) return basePercent;

      const now = new Date();
      let maxDiscount = 0;
      snap.forEach((d) => {
        const data = d.data();
        const start = data.validFrom?.toDate ? data.validFrom.toDate() : null;
        const end = data.validUntil?.toDate ? data.validUntil.toDate() : null;
        if (!start || !end) return;
        if (now >= start && now <= end) {
          const pct = typeof data.discountPercent === 'number' ? data.discountPercent : 0;
          if (pct > maxDiscount) maxDiscount = pct;
        }
      });

      const effective = basePercent - maxDiscount;
      return effective > 0 ? effective : 0;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to compute platform fee percent', err);
      return basePercent;
    }
  };

  const handleUpdateStatus = async (bookingId, status) => {
    try {
      setUpdatingId(bookingId);
      const bookingRef = doc(db, 'bookings', bookingId);

      // If accepting booking, compute fee, update earnings, and award points
      if (status === 'accepted') {
        const bookingDoc = bookings.find((b) => b.id === bookingId);
        if (bookingDoc) {
          const totalPrice = typeof bookingDoc.totalPrice === 'number' ? bookingDoc.totalPrice : 0;
          const platformFeePercent = 0;
          const platformFeeAmount = 0;
          const hostNetAmount = totalPrice;

          await updateDoc(bookingRef, {
            status,
            platformFeePercent,
            platformFeeAmount,
            hostNetAmount,
          });

          const hostEarningsRef = doc(db, 'hostEarnings', bookingDoc.hostId);
          const hostEarningsSnap = await getDoc(hostEarningsRef);
          let hostEarnings = 0;
          if (hostEarningsSnap.exists()) {
            hostEarnings = hostEarningsSnap.data().totalEarnings || 0;
          }
          await setDoc(
            hostEarningsRef,
            {
              totalEarnings: hostEarnings + hostNetAmount,
              currency: 'PHP',
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );

          // Award host points for this accepted booking
          await awardHostPoints(bookingDoc.hostId, 50, 'completed_booking', {
            bookingId,
            listingId: bookingDoc.listingId || null,
            totalPrice,
            platformFeePercent,
            platformFeeAmount,
            hostNetAmount,
          });

          // Send booking confirmation email to guest
          try {
            if (bookingDoc.guestId) {
              const guestRef = doc(db, 'users', bookingDoc.guestId);
              const guestSnap = await getDoc(guestRef);

              if (guestSnap.exists()) {
                const guestData = guestSnap.data();
                const guestEmail = guestData.email;
                const guestName = guestData.name || guestEmail?.split('@')[0] || 'Guest';

                if (guestEmail) {
                  const bookingDetails = {
                    listingTitle: bookingDoc.listing?.title || 'N/A',
                    location: bookingDoc.listing?.location || 'N/A',
                    checkIn: bookingDoc.checkIn?.toDate
                      ? bookingDoc.checkIn.toDate().toLocaleDateString()
                      : 'N/A',
                    checkOut: bookingDoc.checkOut?.toDate
                      ? bookingDoc.checkOut.toDate().toLocaleDateString()
                      : 'N/A',
                    guestCount: bookingDoc.guestCount || 'N/A',
                    totalPrice: totalPrice ? `₱${totalPrice.toFixed(2)}` : 'N/A',
                  };

                  await sendBookingDetails(guestEmail, guestName, bookingDetails);
                }
              }
            }
          } catch (emailErr) {
            // eslint-disable-next-line no-console
            console.error('Failed to send booking confirmation email to guest:', emailErr);
            // Do not interrupt booking acceptance if email fails
          }
        } else {
          // Fallback if booking not in local state: at least update status
          await updateDoc(bookingRef, { status });
        }
      } else {
        // Non-accepted statuses only update status field
        await updateDoc(bookingRef, { status });
      }

      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));

      // Show snackbar notification
      setSnackbar({
        open: true,
        message: `Booking ${status} successfully.`,
        severity: status === 'accepted' ? 'success' : 'info',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update booking status', err);
      setSnackbar({
        open: true,
        message: 'Failed to update booking status. Please try again.',
        severity: 'error',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Bookings
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Booking requests for your listings.
      </Typography>

      {loading ? (
        <Typography variant="body2">Loading bookings...</Typography>
      ) : bookings.length === 0 ? (
        <Typography variant="body2">You have no booking requests yet.</Typography>
      ) : (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {bookings.map((booking) => {
            const isAccepted = booking.status === 'accepted';
            const isDeclined = booking.status === 'declined';

const loadGuestWishlistSuggestions = async () => {
  try {
    const wishlistSuggestionsRef = collection(db, 'hostWishlistSuggestions');
    const q = query(wishlistSuggestionsRef, where('hostId', '==', hostId));
    const snap = await getDocs(q);
    const wishlistByBooking = {};
    snap.forEach((d) => {
      const data = d.data();
      const bookingId = data.bookingId;
      if (!wishlistByBooking[bookingId]) wishlistByBooking[bookingId] = [];
      wishlistByBooking[bookingId].push({ id: d.id, message: data.message });
    });
    return wishlistByBooking;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to load guest wishlist suggestions', err);
    return {};
  }
};

return (
  <>
    <Typography variant="h4" gutterBottom>
      Bookings
    </Typography>
    <Typography variant="subtitle1" gutterBottom>
      Booking requests for your listings.
    </Typography>

    {loading ? (
      <Typography variant="body2">Loading bookings...</Typography>
    ) : bookings.length === 0 ? (
      <Typography variant="body2">You have no booking requests yet.</Typography>
    ) : (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {bookings.map((booking) => {
          const isAccepted = booking.status === 'accepted';
          const isDeclined = booking.status === 'declined';

          let statusColor = 'default';
          if (isAccepted) statusColor = 'success';
          else if (isDeclined) statusColor = 'error';
          else statusColor = 'warning';

          return (
            <Grid size={{ xs: 12 }} key={booking.id}>
              <Paper
                sx={{
                  p: 2,
                  borderLeft: isAccepted ? '4px solid #2e7d32' : isDeclined ? '4px solid #c62828' : '4px solid #ed6c02',
                  bgcolor: isAccepted ? 'rgba(46,125,50,0.04)' : isDeclined ? 'rgba(198,40,40,0.03)' : 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Chip
                    size="small"
                    color={statusColor}
                    label={
                      isAccepted
                        ? 'Accepted booking'
                        : isDeclined
                          ? 'Declined booking'
                          : (booking.status || 'Pending request')
                    }
                  />
                </Box>
                {booking.listing ? (
                  <>
                    <Typography variant="h6" noWrap>
                      {booking.listing.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {booking.listing.location}
                    </Typography>

                    {booking.listing.category === 'service' && (
                      <>
                        {booking.listing.serviceCategory && (
                          <Typography variant="body2" color="text.secondary">
                            Service: {booking.listing.serviceCategory}
                          </Typography>
                        )}
                        {booking.listing.serviceArea && (
                          <Typography variant="body2" color="text.secondary">
                            Area: {booking.listing.serviceArea}
                          </Typography>
                        )}
                        {booking.listing.serviceDuration && (
                          <Typography variant="body2" color="text.secondary">
                            Duration: {booking.listing.serviceDuration}
                          </Typography>
                        )}
                        {booking.listing.serviceTimeSlots && (
                          <Typography variant="body2" color="text.secondary">
                            Time slots: {booking.listing.serviceTimeSlots}
                          </Typography>
                        )}
                      </>
                    )}

                    {booking.checkIn && booking.checkOut && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        Dates: {booking.checkIn.toDate ? booking.checkIn.toDate().toLocaleDateString() : ''}
                        {' '}–{' '}
                        {booking.checkOut.toDate ? booking.checkOut.toDate().toLocaleDateString() : ''}
                      </Typography>
                    )}
                    {booking.guestCount && (
                      <Typography variant="body2">
                        Guests: {booking.guestCount}
                      </Typography>
                    )}
                    {typeof booking.totalPrice === 'number' && (
                      <Typography variant="body2">
                        Total: ₱{booking.totalPrice.toFixed(2)}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Listing no longer available.
                  </Typography>
                )}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    disabled={updatingId === booking.id || booking.status === 'accepted'}
                    onClick={() => handleUpdateStatus(booking.id, 'accepted')}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={updatingId === booking.id || booking.status === 'declined'}
                    onClick={() => handleUpdateStatus(booking.id, 'declined')}
                  >
                    Decline
                  </Button>
                </Box>
              </Paper>
            </Grid>
            );
          })}
        </Grid>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
