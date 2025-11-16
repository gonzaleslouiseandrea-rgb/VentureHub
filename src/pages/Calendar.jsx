import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostCalendarPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) {
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(bookingsRef, where('hostId', '==', user.uid), where('status', '==', 'accepted'));
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
        console.error('Error loading calendar bookings', err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  const bookedDates = useMemo(() => {
    const days = new Set();
    bookings.forEach((b) => {
      if (!b.checkIn || !b.checkOut) return;
      const start = b.checkIn.toDate ? b.checkIn.toDate() : null;
      const end = b.checkOut.toDate ? b.checkOut.toDate() : null;
      if (!start || !end) return;

      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cur <= last) {
        const key = cur.toISOString().slice(0, 10);
        days.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return days;
  }, [bookings]);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [currentMonth]);

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m - 1, 1);
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m + 1, 1);
    });
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Host Calendar
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Accepted bookings for your listings.
      </Typography>

      {loading ? (
        <Typography variant="body2">Loading your schedule...</Typography>
      ) : (
        <>
          <Box sx={{ mt: 2, mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1.5,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={goToPrevMonth}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 999,
                    px: 1.5,
                    py: 0.25,
                    fontSize: 12,
                    cursor: 'pointer',
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: '#f5f5f5' },
                  }}
                >
                  Prev
                </Box>
                <Typography variant="h6">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Typography>
                <Box
                  component="button"
                  type="button"
                  onClick={goToNextMonth}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 999,
                    px: 1.5,
                    py: 0.25,
                    fontSize: 12,
                    cursor: 'pointer',
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: '#f5f5f5' },
                  }}
                >
                  Next
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 0.5,
                      bgcolor: 'success.light',
                      border: '1px solid #a5d6a7',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Booked
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 0.5,
                      bgcolor: 'background.paper',
                      border: '1px solid #e0e0e0',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Available
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Weekday headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                mb: 1,
                gap: 0.5,
              }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <Box key={d} sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', fontWeight: 600, color: 'text.secondary' }}
                  >
                    {d}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Month days grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 0.5,
              }}
            >
              {monthDays.map((day, idx) => {
                if (!day) {
                  return <Box key={`empty-${idx}`} />;
                }
                const key = day.toISOString().slice(0, 10);
                const isBooked = bookedDates.has(key);
                return (
                  <Box
                    key={key}
                    sx={{
                      height: 52,
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      bgcolor: isBooked ? 'success.light' : 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: isBooked ? 600 : 400 }}>
                      {day.getDate()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {bookings.length === 0 ? (
            <Typography variant="body2">You have no accepted bookings yet.</Typography>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {bookings.map((booking) => (
                <Grid size={{ xs: 12 }} key={booking.id}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Booking ID: {booking.id}
                    </Typography>
                    {booking.listing ? (
                      <>
                        <Typography variant="h6" noWrap>
                          {booking.listing.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {booking.listing.location}
                        </Typography>
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
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Listing no longer available.
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </>
  );
}
