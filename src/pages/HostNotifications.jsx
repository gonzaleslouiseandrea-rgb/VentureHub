import { useEffect, useState } from 'react';
import { Alert, Box, Chip, Grid, Paper, Snackbar, Typography } from '@mui/material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostNotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }

      try {
        const notifications = [];

        // Booking-related notifications for this host
        const bookingsRef = collection(db, 'bookings');
        const qb = query(bookingsRef, where('hostId', '==', user.uid));
        const bookingsSnap = await getDocs(qb);
        bookingsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          notifications.push({
            id: `booking-${docSnap.id}`,
            type: 'booking',
            status: data.status,
            createdAt: data.createdAt,
            totalPrice: data.totalPrice,
            listingTitle: data.listingTitle || '',
          });
        });

        // Refund-related notifications for this host
        const refundsRef = collection(db, 'refunds');
        const qr = query(refundsRef, where('hostId', '==', user.uid));
        const refundsSnap = await getDocs(qr);
        refundsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          notifications.push({
            id: `refund-${docSnap.id}`,
            type: 'refund',
            status: data.status,
            createdAt: data.createdAt,
            amount: data.amount,
            listingTitle: data.listingTitle || '',
          });
        });

        notifications.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });

        setItems(notifications);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading host notifications', err);
        setItems([]);
        setSnackbar({ open: true, message: 'Failed to load notifications.', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user]);

  const renderChip = (item) => {
    if (item.type === 'booking') {
      if (item.status === 'accepted') return <Chip label="Booking accepted" color="success" size="small" />;
      if (item.status === 'declined') return <Chip label="Booking declined" color="error" size="small" variant="outlined" />;
      return <Chip label={`Booking ${item.status || 'pending'}`} color="warning" size="small" />;
    }
    if (item.type === 'refund') {
      if (item.status === 'approved') return <Chip label="Refund approved" color="success" size="small" />;
      if (item.status === 'rejected') return <Chip label="Refund rejected" color="error" size="small" variant="outlined" />;
      return <Chip label="Refund requested" color="info" size="small" />;
    }
    return null;
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Notifications
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        See updates about your bookings and refund requests.
      </Typography>

      {loading ? (
        <Typography variant="body2">Loading notifications...</Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2">You have no notifications yet.</Typography>
      ) : (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {items.map((item) => {
            const createdAt = item.createdAt?.toDate ? item.createdAt.toDate() : null;
            const titlePrefix = item.type === 'booking' ? 'Booking' : 'Refund';
            return (
              <Grid size={{ xs: 12 }} key={item.id}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {renderChip(item)}
                    </Typography>
                    {createdAt && (
                      <Typography variant="caption" color="text.secondary">
                        {createdAt.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body1">
                    {titlePrefix} update {item.listingTitle ? `for ${item.listingTitle}` : ''}
                  </Typography>
                  {item.type === 'booking' && typeof item.totalPrice === 'number' && (
                    <Typography variant="body2" color="text.secondary">
                      Total: ₱{item.totalPrice.toFixed(2)}
                    </Typography>
                  )}
                  {item.type === 'refund' && typeof item.amount === 'number' && (
                    <Typography variant="body2" color="text.secondary">
                      Amount: ₱{item.amount.toFixed(2)}
                    </Typography>
                  )}
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
