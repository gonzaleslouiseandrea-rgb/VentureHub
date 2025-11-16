import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  Divider,
  Stack,
  Stepper,
  Step,
  StepLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
} from '@mui/material';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { sendVerificationOTP } from '../utils/emailService.js';
import { PayPalButtons } from '@paypal/react-paypal-js';

export default function HostRegisterPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [requirements, setRequirements] = useState({
    terms: false,
    safety: false,
    accuracy: false,
  });
  const [plan, setPlan] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleUser, setGoogleUser] = useState(null);

  const handleGoogle = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);

      setGoogleUser(cred.user);

      setForm((prev) => ({
        ...prev,
        name: cred.user.displayName || prev.name,
        email: cred.user.email || prev.email,
        phone: cred.user.phoneNumber || prev.phone,
      }));

      const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

      await setDoc(doc(db, 'users', cred.user.uid), {
        name: cred.user.displayName || '',
        email: cred.user.email,
        phone: cred.user.phoneNumber || '',
        role: 'host',
        createdAt: serverTimestamp(),
        verified: false,
        verificationOTP,
        verificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        provider: 'google',
      });

      try {
        await sendVerificationOTP(cred.user.email, cred.user.displayName || cred.user.email, verificationOTP);
        setSuccess('Signed in with Google. Please complete the steps and PayPal subscription to finish host registration. A verification OTP has been sent to your email.');
      } catch (emailError) {
        // eslint-disable-next-line no-console
        console.error('Email sending error (Google host registration):', emailError);
        setSuccess('Google sign-in succeeded, but there was an issue sending the verification email. Please contact support.');
      }
      setActiveStep(1);
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRequirementsChange = (event) => {
    const { name, checked } = event.target;
    setRequirements((prev) => ({ ...prev, [name]: checked }));
  };

  const handleNext = () => {
    setError('');
    setSuccess('');
    if (activeStep === 0) {
      if (!form.name || !form.email || (!googleUser && !form.password)) {
        setError('Please fill in name, email, and password.');
        return;
      }
    }
    if (activeStep === 1) {
      if (!requirements.terms || !requirements.safety || !requirements.accuracy) {
        setError('Please confirm all hosting requirements to continue.');
        return;
      }
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setSuccess('');
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCreateAccount = async () => {
    setError('');
    setSuccess('');

    setLoading(true);
    try {
      let userForHost = googleUser;

      if (!userForHost) {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await updateProfile(cred.user, {
          displayName: form.name,
        });
        userForHost = cred.user;
      }

      const planMeta = {
        basic: { label: 'Basic Monthly', price: 299, listingLimit: 3 },
        pro: { label: 'Pro Monthly', price: 599, listingLimit: 8 },
        annual: { label: 'Annual Unlimited', price: 1299, listingLimit: null },
      }[plan];

      const hostsRef = collection(db, 'hosts');
      await setDoc(doc(hostsRef, userForHost.uid), {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        subscriptionPlan: planMeta.label,
        subscriptionPrice: planMeta.price,
        listingLimit: planMeta.listingLimit,
        provider: googleUser ? 'google' : 'password',
        points: {
          lifetime: 100,
          available: 100,
          tier: 'bronze',
        },
      });

      try {
        const eventsRef = collection(db, 'hostPointsEvents');
        await addDoc(eventsRef, {
          hostId: userForHost.uid,
          points: 100,
          reason: 'signup_bonus',
          metadata: {},
          createdAt: serverTimestamp(),
        });
      } catch (eventErr) {
        // eslint-disable-next-line no-console
        console.error('Failed to log signup bonus points event', eventErr);
      }

      const email = form.email || userForHost.email;
      const fullName = form.name || userForHost.displayName || '';
      const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

      await setDoc(doc(db, 'users', userForHost.uid), {
        name: fullName,
        email,
        phone: form.phone || userForHost.phoneNumber || '',
        role: 'host',
        createdAt: serverTimestamp(),
        verified: false,
        verificationOTP,
        verificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        provider: googleUser ? 'google' : 'password',
      }, { merge: true });

      try {
        await sendVerificationOTP(email, fullName, verificationOTP);
      } catch (emailError) {
        // eslint-disable-next-line no-console
        console.error('Email sending error (host registration):', emailError);
      }

      setSuccess('Host registration successful. Please verify your email before logging in to the host dashboard.');
      setActiveStep(3);
      setForm((prev) => ({
        ...prev,
        password: '',
      }));
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 520 }}>
        <Typography variant="h5" gutterBottom>
          Host Registration
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Create your VentureHub host account in a few steps. Guests use a separate registration flow.
        </Typography>

        <Stack spacing={2} sx={{ mb: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>

        <Button
          fullWidth
          variant="outlined"
          sx={{ mb: 2 }}
          onClick={handleGoogle}
          disabled={loading}
        >
          Continue with Google (host)
        </Button>

        <Divider sx={{ mb: 2 }}>or continue with email</Divider>

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          <Step><StepLabel>Account</StepLabel></Step>
          <Step><StepLabel>Requirements</StepLabel></Step>
          <Step><StepLabel>Plan</StepLabel></Step>
          <Step><StepLabel>Confirm</StepLabel></Step>
        </Stepper>

        {activeStep === 0 && (
          <Box component="form" noValidate autoComplete="off">
            <TextField
              fullWidth
              margin="normal"
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Phone Number (optional)"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Hosting requirements
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              To host on VentureHub, you agree to the following:
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={(
                  <Checkbox
                    name="terms"
                    checked={requirements.terms}
                    onChange={handleRequirementsChange}
                  />
                )}
                label="I will comply with local laws and VentureHub terms of service."
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    name="safety"
                    checked={requirements.safety}
                    onChange={handleRequirementsChange}
                  />
                )}
                label="I will maintain a safe, clean, and accurate hosting environment."
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    name="accuracy"
                    checked={requirements.accuracy}
                    onChange={handleRequirementsChange}
                  />
                )}
                label="I will provide accurate listing details, pricing, and availability."
              />
            </FormGroup>
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Choose your subscription
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Plans define how many active listings you can maintain on VentureHub.
            </Typography>
            <RadioGroup
              name="plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <FormControlLabel
                value="basic"
                control={<Radio />}
                label="Basic Monthly – ₱299 / month (up to 3 listings)"
              />
              <FormControlLabel
                value="pro"
                control={<Radio />}
                label="Pro Monthly – ₱599 / month (up to 8 listings)"
              />
              <FormControlLabel
                value="annual"
                control={<Radio />}
                label="Annual Unlimited – ₱1,299 / year (unlimited listings)"
              />
            </RadioGroup>
          </Box>
        )}

        {activeStep === 3 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Review your host account
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Name:</strong> {form.name || '—'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Email:</strong> {form.email || '—'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Plan:</strong>{' '}
              {plan === 'basic' && 'Basic Monthly – ₱299 / month (up to 3 listings)'}
              {plan === 'pro' && 'Pro Monthly – ₱599 / month (up to 8 listings)'}
              {plan === 'annual' && 'Annual Unlimited – ₱1,299 / year (unlimited listings)'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Complete your PayPal subscription below. Your host account will be created after the
              subscription is approved.
            </Typography>

            <Box sx={{ maxWidth: 380 }}>
              <PayPalButtons
                style={{ layout: 'horizontal', shape: 'pill' }}
                createSubscription={(data, actions) => {
                  const planIds = {
                    basic: import.meta.env.VITE_PAYPAL_PLAN_BASIC,
                    pro: import.meta.env.VITE_PAYPAL_PLAN_PRO,
                    annual: import.meta.env.VITE_PAYPAL_PLAN_ANNUAL,
                  };
                  const rawPlanId = planIds[plan];
                  const planId = typeof rawPlanId === 'string' ? rawPlanId.trim() : rawPlanId;
                  if (!planId) {
                    // eslint-disable-next-line no-alert
                    alert('PayPal plan ID is not configured for this subscription.');
                    return Promise.reject(new Error('Missing PayPal plan ID'));
                  }
                  return actions.subscription.create({
                    plan_id: planId,
                  });
                }}
                onApprove={async () => {
                  await handleCreateAccount();
                }}
                onError={(err) => {
                  // eslint-disable-next-line no-console
                  console.error(err);
                  // eslint-disable-next-line no-alert
                  alert('There was an error processing your PayPal subscription. Please try again.');
                }}
              />
            </Box>
          </Box>
        )}

        {/* Navigation buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
          >
            Back
          </Button>
          {activeStep < 2 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </Button>
          )}
          {activeStep === 2 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
            >
              Continue
            </Button>
          )}
          {/* Step 3 uses PayPal buttons to trigger account creation, so no extra primary button here */}
        </Box>
      </Paper>
    </Box>
  );
}
