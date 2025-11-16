import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Grid, Paper, Snackbar, Typography } from '@mui/material';
import { collection, getDocs, query, updateDoc, where, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostRefundsPage() {
  const { user } = useAuth();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchRefunds = async () => {
      if (!user) {
        setRefunds([]);
        setLoading(false);
        return;
      }

      try {
        const ref = collection(db, 'refunds');
        const q = query(ref, where('hostId', '==', user.uid));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });
        setRefunds(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading refunds', err);
        setRefunds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRefunds();
  }, [user]);

  const handleUpdateStatus = async (refundId, status) => {
    try {
      setUpdatingId(refundId);
      const refundRef = doc(db, 'refunds', refundId);
      await updateDoc(refundRef, { status });

      // If approving refund, update wallet, earnings, and booking status
      if (status === 'approved') {
        const refundDoc = refunds.find((r) => r.id === refundId);
        if (refundDoc) {
          // Add refund amount to guest's wallet
          const guestWalletRef = doc(db, 'wallets', refundDoc.guestId);
          const guestWalletSnap = await getDoc(guestWalletRef);
          let guestBalance = 0;
          if (guestWalletSnap.exists()) {
            guestBalance = guestWalletSnap.data().balance || 0;
          }
          await setDoc(guestWalletRef, {
            balance: guestBalance + refundDoc.amount,
            currency: 'PHP',
            updatedAt: serverTimestamp(),
          }, { merge: true });

          // Subtract from host's earnings (assuming earnings are tracked separately)
          const hostEarningsRef = doc(db, 'hostEarnings', refundDoc.hostId);
          const hostEarningsSnap = await getDoc(hostEarningsRef);
          let hostEarnings = 0;
          if (hostEarningsSnap.exists()) {
            hostEarnings = hostEarningsSnap.data().totalEarnings || 0;
          }
          await setDoc(
            hostEarningsRef,
            {
              totalEarnings: Math.max(0, hostEarnings - refundDoc.amount),
              currency: 'PHP',
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );

          // Add wallet transaction for guest
          await addDoc(collection(db, 'walletTransactions'), {
            userId: refundDoc.guestId,
            type: 'refund',
            amount: refundDoc.amount,
            currency: 'PHP',
            bookingId: refundDoc.bookingId,
            createdAt: serverTimestamp(),
          });

          // Mark the original booking as refunded so it no longer appears as an active accepted booking
          if (refundDoc.bookingId) {
            const bookingRef = doc(db, 'bookings', refundDoc.bookingId);
            await updateDoc(bookingRef, {
              status: 'refunded',
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      setRefunds((prev) => prev.map((r) => (r.id === refundId ? { ...r, status } : r)));
      setSnackbar({ open: true, message: `Refund ${status}.`, severity: status === 'approved' ? 'success' : 'info' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update refund status', err);
      setSnackbar({ open: true, message: 'Failed to update refund. Please try again.', severity: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatusChip = (status) => {
    if (status === 'approved') return <Chip label="Approved" color="success" size="small" />;
    if (status === 'rejected') return <Chip label="Rejected" color="error" size="small" variant="outlined" />;
    return <Chip label={status || 'Pending'} color="warning" size="small" />;
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Refund requests
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Review and respond to refund requests from your guests.
      </Typography>

      {loading ? (
        <Typography variant="body2">Loading refund requests...</Typography>
      ) : refunds.length === 0 ? (
        <Typography variant="body2">You have no refund requests at the moment.</Typography>
      ) : (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {refunds.map((refund) => {
            const createdAt = refund.createdAt?.toDate ? refund.createdAt.toDate() : null;
            return (
              <Grid size={{ xs: 12 }} key={refund.id}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Status: {renderStatusChip(refund.status)}
                    </Typography>
                    {createdAt && (
                      <Typography variant="caption" color="text.secondary">
                        Requested {createdAt.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  {refund.listingTitle && (
                    <Typography variant="h6" noWrap>
                      {refund.listingTitle}
                    </Typography>
                  )}
                  {refund.bookingId && (
                    <Typography variant="body2" color="text.secondary">
                      Booking ID: {refund.bookingId}
                    </Typography>
                  )}
                  {typeof refund.amount === 'number' && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Amount: ₱{refund.amount.toFixed(2)}
                    </Typography>
                  )}
                  {refund.reason && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Reason: {refund.reason}
                    </Typography>
                  )}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={updatingId === refund.id || refund.status === 'approved'}
                      onClick={() => handleUpdateStatus(refund.id, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={updatingId === refund.id || refund.status === 'rejected'}
                      onClick={() => handleUpdateStatus(refund.id, 'rejected')}
                    >
                      Reject
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
