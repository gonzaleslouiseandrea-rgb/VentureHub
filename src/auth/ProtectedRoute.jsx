import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, message: 'Please login to access your host dashboard.' }}
      />
    );
  }

  if (!user.emailVerified) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, message: 'Please verify your email address before accessing the host dashboard.' }}
      />
    );
  }

  return children;
}
