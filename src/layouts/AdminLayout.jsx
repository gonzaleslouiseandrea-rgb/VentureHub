import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Analytics', path: '/admin/analytics' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Payments', path: '/admin/payments' },
    { label: 'Policies', path: '/admin/policies' },
  ];

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) {
        setNotifications([]);
        return;
      }

      try {
        setLoadingNotifications(true);
        const items = [];

        // Fetch all bookings for admin notifications
        const bookingsRef = collection(db, 'bookings');
        const qb = query(bookingsRef);
        const bookingsSnap = await getDocs(qb);
        bookingsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: `booking-${docSnap.id}`,
            type: 'booking',
            status: data.status,
            createdAt: data.createdAt,
            totalPrice: data.totalPrice,
            listingTitle: data.listingTitle || '',
          });
        });

        // Fetch all refunds
        const refundsRef = collection(db, 'refunds');
        const qr = query(refundsRef);
        const refundsSnap = await getDocs(qr);
        refundsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: `refund-${docSnap.id}`,
            type: 'refund',
            status: data.status,
            createdAt: data.createdAt,
            amount: data.amount,
            listingTitle: data.listingTitle || '',
          });
        });

        items.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return bDate - aDate;
        });

        setNotifications(items);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading admin notifications', err);
        setNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [user]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <CssBaseline />
      <AppBar position="fixed" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ mr: 4 }}>
            VentureHub Admin
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
            {navItems.map((item) => {
              const selected = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  color={selected ? 'inherit' : 'inherit'}
                  sx={{
                    textTransform: 'none',
                    fontWeight: selected ? 600 : 400,
                    opacity: selected ? 1 : 0.8,
                    borderBottom: selected ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                    borderRadius: 0,
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
              <IconButton
                color="inherit"
                onClick={() => setShowNotifications((prev) => !prev)}
                sx={{ ml: 1, borderRadius: '999px', border: '1px solid rgba(209,213,219,0.8)', bgcolor: showNotifications ? 'rgba(229,231,235,0.4)' : 'transparent' }}
                aria-label="Admin notifications"
              >
                <span role="img" aria-hidden="true" style={{ fontSize: 20 }}>
                  🔔
                </span>
                {notifications.length > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 34,
                      bgcolor: '#16a34a',
                      color: '#fff',
                      borderRadius: '999px',
                      px: 0.5,
                      minWidth: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {notifications.length}
                  </Box>
                )}
              </IconButton>
              {showNotifications && (
                <Paper
                  elevation={8}
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 40,
                    width: 320,
                    bgcolor: '#ffffff',
                    color: '#111827',
                    borderRadius: 3,
                    overflow: 'hidden',
                    zIndex: 1300,
                    border: '1px solid rgba(229,231,235,1)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.5,
                      borderBottom: '1px solid rgba(229,231,235,1)',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Notifications Center
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: '#16a34a',
                        borderRadius: 999,
                        px: 1,
                        py: 0.25,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {notifications.length}
                    </Box>
                  </Box>
                  <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                    {loadingNotifications ? (
                      <Box sx={{ px: 2, py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                          Loading notifications...
                        </Typography>
                      </Box>
                    ) : notifications.length === 0 ? (
                      <Box sx={{ px: 2, py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                          You have no notifications yet.
                        </Typography>
                      </Box>
                    ) : (
                      notifications.map((item) => {
                        const createdAt = item.createdAt?.toDate ? item.createdAt.toDate() : null;
                        const isBooking = item.type === 'booking';
                        const titlePrefix = isBooking ? 'Booking' : 'Refund';
                        return (
                          <Box
                            key={item.id}
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderBottom: '1px solid rgba(229,231,235,1)',
                              '&:last-of-type': { borderBottom: 'none' },
                              '&:hover': { bgcolor: '#f9fafb' },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {titlePrefix}
                                {item.status ? ` ${item.status}` : ''}
                              </Typography>
                              {createdAt && (
                                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                  {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#6b7280' }}>
                              {item.listingTitle ? `For ${item.listingTitle}` : ''}
                            </Typography>
                            {isBooking && typeof item.totalPrice === 'number' && (
                              <Typography variant="caption" sx={{ mt: 0.5, color: '#6b7280' }}>
                                Total ₱{item.totalPrice.toFixed(2)}
                              </Typography>
                            )}
                            {!isBooking && typeof item.amount === 'number' && (
                              <Typography variant="caption" sx={{ mt: 0.5, color: '#6b7280' }}>
                                Amount ₱{item.amount.toFixed(2)}
                              </Typography>
                            )}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                  <Button
                    component={Link}
                    to="/admin/notifications"
                    sx={{
                      width: '100%',
                      borderRadius: 0,
                      borderTop: '1px solid rgba(229,231,235,1)',
                      color: '#16a34a',
                      fontWeight: 500,
                      '&:hover': { bgcolor: '#f9fafb' },
                    }}
                  >
                    View all notifications
                  </Button>
                </Paper>
              )}

              <IconButton
                color="inherit"
                component={Link}
                to="/admin/account"
                sx={{ ml: 1 }}
                aria-label="Admin account settings"
              >
                <span role="img" aria-hidden="true">
                  ⚙️
                </span>
              </IconButton>
              <Button
                color="inherit"
                size="small"
                sx={{ ml: 1, textTransform: 'none', borderRadius: 999, border: '1px solid rgba(209,213,219,0.8)', px: 1.5, py: 0.25 }}
                onClick={async () => {
                  try {
                    await logout();
                    window.location.href = '/';
                  } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Error during admin logout', err);
                  }
                }}
              >
                Log out
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, mt: 8, py: 3 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
