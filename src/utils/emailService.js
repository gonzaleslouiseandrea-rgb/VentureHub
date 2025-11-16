// Utility for sending emails via mailto (opens user's email client with pre-filled content).

export async function sendVerificationOTP(email, fullName, otpCode) {
  const subject = 'Verify Your Email - VentureHub';
  const body = `
Dear ${fullName || email},

Your OTP code for email verification is: ${otpCode}

Please enter this code to complete your registration.

Best regards,
VentureHub Team
  `.trim();

  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoLink;
}

export async function sendBookingDetails(email, fullName, bookingDetails) {
  const subject = 'Booking Confirmation - VentureHub';

  const body = `
Dear ${fullName || email},

Congratulations! Your booking has been confirmed and payment has been successfully processed.

Booking Details:
- Listing: ${bookingDetails.listingTitle || 'N/A'}
- Location: ${bookingDetails.location || 'N/A'}
- Check-in: ${bookingDetails.checkIn || 'N/A'}
- Check-out: ${bookingDetails.checkOut || 'N/A'}
- Number of Guests: ${bookingDetails.guestCount || 'N/A'}
- Total Price: ${bookingDetails.totalPrice || 'N/A'}

Thank you for choosing VentureHub. We hope you have a wonderful stay!

If you have any questions, please contact our support team.

Best regards,
VentureHub Team
  `.trim();

  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoLink;
}

export async function sendRefundNotification(email, fullName, bookingDetails) {
  const subject = 'Refund Request Accepted - VentureHub';

  const body = `
Dear ${fullName || email},

Your refund request has been accepted by the host.

Booking Details:
- Listing: ${bookingDetails.listingTitle || 'N/A'}
- Location: ${bookingDetails.location || 'N/A'}
- Check-in: ${bookingDetails.checkIn || 'N/A'}
- Check-out: ${bookingDetails.checkOut || 'N/A'}
- Total Price: ${bookingDetails.totalPrice || 'N/A'}

The refund will be processed according to our refund policy. Please allow 3-5 business days for the refund to appear in your account.

If you have any questions, please contact our support team.

Best regards,
VentureHub Team
  `.trim();

  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoLink;
}
