import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Button,
  TextField,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase.js';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { sendVerificationOTP } from '../utils/emailService.js';

export default function VerifyOTP() {
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToLogin = () => {
    try {
      localStorage.setItem(
        'venturehubEmailVerified',
        JSON.stringify({ email: verifiedEmail, timestamp: Date.now() }),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to store verification payload', error);
    }

    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }

    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const email = location.state?.email;
    if (!email) {
      setStatus('failed');
      setMessage('No email provided for verification.');
      return;
    }
    setVerifiedEmail(email);
    setStatus('input');
  }, [location.state]);

  const handleOtpSubmit = async () => {
    if (!otp || otp.length !== 6) {
      setMessage('Please enter a valid 6-digit OTP.');
      return;
    }

    setStatus('verifying');
    setMessage('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', verifiedEmail), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setStatus('failed');
        setMessage('User not found. Please register again.');
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.verified === true) {
        setStatus('success');
        setMessage('Your email has already been verified. Redirecting to login...');
        setTimeout(() => {
          redirectToLogin();
        }, 2000);
        return;
      }

      if (userData.verificationOTP !== otp) {
        setStatus('failed');
        setMessage('Invalid OTP. Please check and try again.');
        return;
      }

      if (userData.verificationOTPExpiry) {
        const expiryDate = new Date(userData.verificationOTPExpiry);
        if (expiryDate < new Date()) {
          setStatus('failed');
          setMessage('OTP has expired. Please request a new one.');
          return;
        }
      }

      await updateDoc(userDoc.ref, {
        verified: true,
        verificationOTP: null,
        verificationOTPExpiry: null,
        verifiedAt: new Date().toISOString(),
      });

      setStatus('success');
      setMessage('Your email has been successfully verified! Redirecting to login...');

      setTimeout(() => {
        redirectToLogin();
      }, 2000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('OTP verification error:', error);
      setStatus('failed');
      setMessage('An error occurred during verification. Please try again or contact support.');
    }
  };

  const handleResendOtp = async () => {
    if (!verifiedEmail) {
      setMessage('No email available to resend OTP. Please register again.');
      return;
    }

    setResendLoading(true);
    setMessage('');
    setInfoMessage('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', verifiedEmail), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage('User not found. Please register again.');
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

      await updateDoc(userDoc.ref, {
        verificationOTP: newOtp,
        verificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      await sendVerificationOTP(verifiedEmail, userData.name || verifiedEmail, newOtp);

      setInfoMessage('A new OTP has been sent to your email. Please check your inbox.');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Resend OTP error:', error);
      setMessage('Failed to resend OTP. Please try again in a moment.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#f7f5ecff',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        px: 2,
      }}
    >
      <Paper
        elevation={5}
        sx={{
          p: 5,
          borderRadius: 5,
          width: { xs: '90%', sm: '400px' },
        }}
      >
        {status === 'verifying' && (
          <>
            <CircularProgress color="success" />
            <Typography mt={2} color="text.secondary">
              Verifying...
            </Typography>
          </>
        )}

        {status === 'input' && (
          <>
            <Typography variant="h5" fontWeight="bold" color="#87ab69" mb={2}>
              Verify Your Email
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={3}>
              Enter the 6-digit OTP sent to {verifiedEmail}
            </Typography>
            <TextField
              label="OTP"
              variant="outlined"
              fullWidth
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6 }}
              sx={{ mb: 2 }}
            />
            {message && (
              <Typography color="error" mb={2}>
                {message}
              </Typography>
            )}
            {infoMessage && (
              <Typography color="text.secondary" mb={2}>
                {infoMessage}
              </Typography>
            )}
            <Button
              variant="contained"
              fullWidth
              sx={{
                mt: 2,
                bgcolor: '#87ab69',
                color: '#FFFDD0',
                py: 1.2,
                '&:hover': { bgcolor: '#76965d' },
              }}
              onClick={handleOtpSubmit}
            >
              Verify OTP
            </Button>
            <Button
              variant="outlined"
              fullWidth
              sx={{
                mt: 2,
                borderColor: '#87ab69',
                color: '#87ab69',
                '&:hover': { borderColor: '#76965d' },
              }}
              disabled={resendLoading}
              onClick={handleResendOtp}
            >
              {resendLoading ? 'Resending OTP...' : 'Resend OTP'}
            </Button>
          </>
        )}

        {status === 'success' && (
          <>
            <Typography variant="h5" fontWeight="bold" color="#87ab69" mb={2}>
              Verification Complete!
            </Typography>
            <Typography variant="h6" color="#5f7d45" mb={2}>
              Your email has been verified
            </Typography>
            <Typography mt={2} color="text.secondary" mb={3}>
              {message || 'You are now registered with VentureHub! Redirecting to login page...'}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{
                mt: 2,
                bgcolor: '#87ab69',
                color: '#FFFDD0',
                py: 1.2,
                '&:hover': { bgcolor: '#76965d' },
              }}
              onClick={redirectToLogin}
            >
              Go to Login Now
            </Button>
          </>
        )}

        {status === 'failed' && (
          <>
            <Typography variant="h5" fontWeight="bold" color="error">
              Verification Failed
            </Typography>
            <Typography mt={2} color="text.secondary">
              {message || 'Invalid or expired OTP.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                sx={{
                  borderColor: '#87ab69',
                  color: '#87ab69',
                  '&:hover': { borderColor: '#76965d', bgcolor: '#f0f0f0' },
                }}
                onClick={() => navigate('/register')}
              >
                Back to Register
              </Button>
              <Button
                variant="contained"
                sx={{
                  bgcolor: '#87ab69',
                  color: '#FFFDD0',
                  '&:hover': { bgcolor: '#76965d' },
                }}
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
