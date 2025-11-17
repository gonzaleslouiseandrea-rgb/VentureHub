import { useEffect, useState } from 'react';
import { Box, Paper, Typography, RadioGroup, FormControlLabel, Radio, Button, Alert, CircularProgress } from '@mui/material';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '../auth/AuthContext.jsx';
import { db } from '../firebase.js';

const PLAN_META = {
  basic: { key: 'basic', label: 'Basic Monthly', description: 'Up to 3 listings, billed monthly.', price: 299, listingLimit: 3 },
  pro: { key: 'pro', label: 'Pro Monthly', description: 'Up to 8 listings, billed monthly.', price: 599, listingLimit: 8 },
  annual: { key: 'annual', label: 'Annual Unlimited', description: 'Unlimited listings, billed annually.', price: 1299, listingLimit: null },
};

export default function HostPlanPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('basic');

  useEffect(() => {
    const loadHost = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const hostRef = doc(db, 'hosts', user.uid);
        const snap = await getDoc(hostRef);
        if (snap.exists()) {
          const data = snap.data();
          setCurrentPlan({
            subscriptionPlan: data.subscriptionPlan || null,
            subscriptionPrice: data.subscriptionPrice || null,
            listingLimit: data.listingLimit ?? null,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading host plan', err);
        setError('Unable to load your current plan.');
      } finally {
        setLoading(false);
      }
    };

    loadHost();
  }, [user]);

  const handlePlanChange = (event) => {
    setSelectedPlan(event.target.value);
    setError('');
    setSuccess('');
  };

  const applyPlanToHost = async (planKey) => {
    if (!user) return;
    const meta = PLAN_META[planKey];
    if (!meta) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const hostsRef = collection(db, 'hosts');
      await setDoc(doc(hostsRef, user.uid), {
        subscriptionPlan: meta.label,
        subscriptionPrice: meta.price,
        listingLimit: meta.listingLimit,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setCurrentPlan({
        subscriptionPlan: meta.label,
        subscriptionPrice: meta.price,
        listingLimit: meta.listingLimit,
      });
      setSuccess('Your host plan has been updated.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating host plan', err);
      setError('Unable to update your plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderListingLimit = (limit) => {
    if (limit === null || limit === undefined) return 'Unlimited listings';
    if (typeof limit === 'number') return `${limit} active listings`;
    return 'Listings limit not set';
  };

  if (!user) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="info">You must be logged in as a host to manage your plan.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 3, width: '100%', maxWidth: 640 }}>
        <Typography variant="h5" gutterBottom>
          Host Plan & Subscription
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Upgrade or change your hosting plan. Plans control how many active listings you can publish.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {error && (
              <Box sx={{ mb: 2 }}>
                <Alert severity="error">{error}</Alert>
              </Box>
            )}
            {success && (
              <Box sx={{ mb: 2 }}>
                <Alert severity="success">{success}</Alert>
              </Box>
            )}

            {currentPlan && (
              <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Current plan
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentPlan.subscriptionPlan || 'Not set'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#4b5563' }}>
                  {typeof currentPlan.subscriptionPrice === 'number'
                    ? `₱${currentPlan.subscriptionPrice} / billing period`
                    : 'No billing amount recorded'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                  {renderListingLimit(currentPlan.listingLimit)}
                </Typography>
              </Box>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Available plans
              </Typography>
              <RadioGroup name="plan" value={selectedPlan} onChange={handlePlanChange}>
                {Object.values(PLAN_META).map((meta) => (
                  <FormControlLabel
                    key={meta.key}
                    value={meta.key}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {meta.label} – ₱{meta.price}
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ ml: 0.5, color: '#6b7280' }}
                          >
                            {meta.key === 'annual' ? ' / year' : ' / month'}
                          </Typography>
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                          {meta.description} ({renderListingLimit(meta.listingLimit)})
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Confirm your upgrade via PayPal. Your host plan will be updated after the subscription is approved.
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
                    const rawPlanId = planIds[selectedPlan];
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
                    await applyPlanToHost(selectedPlan);
                  }}
                  onError={(err) => {
                    // eslint-disable-next-line no-console
                    console.error(err);
                    // eslint-disable-next-line no-alert
                    alert('There was an error processing your PayPal subscription. Please try again.');
                  }}
                  disabled={saving}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setError('');
                  setSuccess('');
                }}
              >
                Clear message
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
