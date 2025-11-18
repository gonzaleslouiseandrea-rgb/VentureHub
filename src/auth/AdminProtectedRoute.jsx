import { useAuth } from './AuthContext.jsx';
import { Navigate } from 'react-router-dom';

export default function AdminProtectedRoute({ children }) {
  const { user, initializing } = useAuth();

  // Wait for Firebase auth to finish initializing so we don't
  // redirect while the user state is still being determined.
  if (initializing) {
    return null;
  }

  // For now, allow any signed-in user to access admin pages.
  // If you want to restrict this later, add a stricter check here
  // (e.g., specific email or a role field in Firestore/custom claims).
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
