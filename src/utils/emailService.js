import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID_OTP = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_OTP;
const TEMPLATE_ID_BOOKING = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_BOOKING;
const TEMPLATE_ID_REFUND = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_REFUND;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

function ensureEmailJsConfig(templateId) {
  if (!SERVICE_ID || !PUBLIC_KEY || !templateId) {
    throw new Error('EmailJS is not fully configured. Please check your VITE_EMAILJS_* env variables.');
  }
}

// Send verification OTP via EmailJS
export async function sendVerificationOTP(email, fullName, otpCode) {
  ensureEmailJsConfig(TEMPLATE_ID_OTP);

  const templateParams = {
    // Recipient
    to_email: email,
    // Template-specific fields
    user_name: fullName || email,
    otp: otpCode,
    expiry_minutes: 10,
    support_email: 'support@venturehub.com',
  };

  await emailjs.send(SERVICE_ID, TEMPLATE_ID_OTP, templateParams, {
    publicKey: PUBLIC_KEY,
  });
}

// Send booking confirmation email via EmailJS
export async function sendBookingDetails(email, fullName, bookingDetails) {
  ensureEmailJsConfig(TEMPLATE_ID_BOOKING);

  const templateParams = {
    to_email: email,
    to_name: fullName || email,
    listing_title: bookingDetails.listingTitle || 'N/A',
    location: bookingDetails.location || 'N/A',
    check_in: bookingDetails.checkIn || 'N/A',
    check_out: bookingDetails.checkOut || 'N/A',
    guest_count: bookingDetails.guestCount || 'N/A',
    total_price: bookingDetails.totalPrice || 'N/A',
  };

  await emailjs.send(SERVICE_ID, TEMPLATE_ID_BOOKING, templateParams, {
    publicKey: PUBLIC_KEY,
  });
}

// Send refund notification email via EmailJS
export async function sendRefundNotification(email, fullName, bookingDetails) {
  ensureEmailJsConfig(TEMPLATE_ID_REFUND);

  const templateParams = {
    to_email: email,
    to_name: fullName || email,
    listing_title: bookingDetails.listingTitle || 'N/A',
    location: bookingDetails.location || 'N/A',
    check_in: bookingDetails.checkIn || 'N/A',
    check_out: bookingDetails.checkOut || 'N/A',
    total_price: bookingDetails.totalPrice || 'N/A',
  };

  await emailjs.send(SERVICE_ID, TEMPLATE_ID_REFUND, templateParams, {
    publicKey: PUBLIC_KEY,
  });
}
