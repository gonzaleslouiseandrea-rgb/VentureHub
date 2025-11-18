import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const from = location.state && location.state.from;

  const resolveDestination = async (user) => {
    if (from) {
      return from;
    }

    // If the user has a host profile, treat them as host; otherwise send to guest dashboard
    try {
      const hostRef = doc(db, 'hosts', user.uid);
      const hostSnap = await getDoc(hostRef);
      if (hostSnap.exists()) {
        return '/host/dashboard';
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error checking host profile during login', e);
    }
    return '/browse';
  };

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'venturehubEmailVerified' && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          setSuccess(`Email ${payload.email || ''} verified successfully. Please sign in.`);
          localStorage.removeItem('venturehubEmailVerified');
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse verification payload', err);
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    try {
      const stored = localStorage.getItem('venturehubEmailVerified');
      if (stored) {
        const payload = JSON.parse(stored);
        setSuccess(`Email ${payload.email || ''} verified successfully. Please sign in.`);
        localStorage.removeItem('venturehubEmailVerified');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse stored verification payload', err);
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleGoogle = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      if (!cred.user) {
        throw new Error('Google sign-in failed.');
      }
      const userDocSnap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDocSnap.exists()) {
        setError('User record not found. Please register first.');
        return;
      }

      const userData = userDocSnap.data();
      if (!userData.verified) {
        setError('Please verify your email with the OTP code sent to your inbox before logging in.');
        return;
      }

      const dest = await resolveDestination(cred.user);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDocSnap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDocSnap.exists()) {
        setError('User record not found. Please register first.');
        return;
      }

      const userData = userDocSnap.data();
      if (!userData.verified) {
        setError('Please verify your email with the OTP code sent to your inbox before logging in.');
        return;
      }

      const dest = await resolveDestination(cred.user);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-screen flex items-center justify-center overflow-hidden bg-gray-900"
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Login</h1>
          <p className="text-gray-600 text-sm mb-6">
            Access your VentureHub account to manage bookings, favorites, and more.
          </p>

          {/* Alerts */}
          <div className="space-y-3 mb-6">
            {location.state && location.state.message && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">
                {location.state.message}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="you@example.com"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center text-gray-600 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <RouterLink to="/register" className="text-green-600 font-semibold hover:text-green-700">
              Register here
            </RouterLink>
          </p>
        </div>
      </div>
    </div>
  );
}
