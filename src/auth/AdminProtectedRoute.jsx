import { useAuth } from './AuthContext.jsx';
import { Navigate } from 'react-router-dom';

export default function AdminProtectedRoute({ children }) {
  const { user } = useAuth();

  // Simple admin check: assume admin if email is admin@venturehub.com (or use custom claims)
  if (!user || user.email !== 'admin@venturehub.com') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
