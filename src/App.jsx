import { Routes, Route, Navigate } from 'react-router-dom';
import HostLayout from './layouts/HostLayout.jsx';
import LandingPage from './pages/Landing.jsx';
import RegisterPage from './pages/Register.jsx';
import LoginPage from './pages/Login.jsx';
import HostRegisterPage from './pages/HostRegister.jsx';
import VerifyEmailPage from './auth/VerifyEmail.jsx';
import VerifyOTPPage from './auth/VerifyOTP.jsx';
import BrowsePage from './pages/Browse.jsx';
import ListingDetailPage from './pages/ListingDetail.jsx';
import GuestAccountPage from './pages/GuestAccount.jsx';
import HostDashboardPage from './pages/Dashboard.jsx';
import HostListingsPage from './pages/Listings.jsx';
import HostMessagesPage from './pages/Messages.jsx';
import HostCalendarPage from './pages/Calendar.jsx';
import HostAccountPage from './pages/Account.jsx';
import HostBookingsPage from './pages/HostBookings.jsx';
import HostRefundsPage from './pages/HostRefunds.jsx';
import HostNotificationsPage from './pages/HostNotifications.jsx';
import HostCouponsPage from './pages/HostCoupons.jsx';
import HostPlanPage from './pages/HostPlan.jsx';
import ChatRoomPage from './pages/ChatRoom.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="/host/register" element={<HostRegisterPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/listing/:id" element={<ListingDetailPage />} />
        <Route path="/guest/account" element={<GuestAccountPage />} />
        <Route path="/chat/:listingId/:guestId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />

        <Route
          path="/host"
          element={(
            <ProtectedRoute>
              <HostLayout />
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="/host/dashboard" replace />} />
          <Route path="dashboard" element={<HostDashboardPage />} />
          <Route path="listings" element={<HostListingsPage />} />
          <Route path="bookings" element={<HostBookingsPage />} />
          <Route path="coupons" element={<HostCouponsPage />} />
          <Route path="refunds" element={<HostRefundsPage />} />
          <Route path="plan" element={<HostPlanPage />} />
          <Route path="notifications" element={<HostNotificationsPage />} />
          <Route path="messages" element={<HostMessagesPage />} />
          <Route path="calendar" element={<HostCalendarPage />} />
          <Route path="account" element={<HostAccountPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App
