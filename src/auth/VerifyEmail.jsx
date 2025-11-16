import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Button,
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

export default function VerifyEmail() {
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToLogin = useCallback(() => {
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
  }, [navigate, verifiedEmail]);

  useEffect(() => {
    const verifyUserEmail = async () => {
      const queryParams = new URLSearchParams(location.search);
      const email = queryParams.get('email');
      const token = queryParams.get('token');

      if (!email || !token) {
        setStatus('failed');
        setMessage('Invalid verification link. Missing email or token.');
        return;
      }

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setStatus('failed');
          setMessage('User not found. Please register again.');
          return;
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (userData.verified === true) {
          setVerifiedEmail(email);
          setStatus('success');
          setMessage('Your email has already been verified. Redirecting to login...');
          setTimeout(() => {
            redirectToLogin();
          }, 2000);
          return;
        }

        if (userData.verificationToken !== token) {
          setStatus('failed');
          setMessage('Invalid verification token. The link may have expired or been used.');
          return;
        }

        if (userData.verificationTokenExpiry) {
          const expiryDate = new Date(userData.verificationTokenExpiry);
          if (expiryDate < new Date()) {
            setStatus('failed');
            setMessage('Verification link has expired. Please request a new verification email.');
            return;
          }
        }

        await updateDoc(userDoc.ref, {
          verified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
          verifiedAt: new Date().toISOString(),
        });

        setVerifiedEmail(email);
        setStatus('success');
        setMessage('Your email has been successfully verified! Redirecting to login...');

        setTimeout(() => {
          redirectToLogin();
        }, 2000);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Verification error:', error);
        setStatus('failed');
        setMessage('An error occurred during verification. Please try again or contact support.');
      }
    };

    verifyUserEmail();
  }, [location.search, redirectToLogin]);

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
              Verifying your email...
            </Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <Typography variant="h5" fontWeight="bold" color="#87ab69" mb={2}>
              Registration Complete!
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
              {message || 'Invalid or expired verification link.'}
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
