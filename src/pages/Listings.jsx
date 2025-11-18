import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useLocation } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Category-specific quick-pick options
const LODGING_AMENITIES = [
  'Free WiFi',
  'Air conditioning / Heating',
  'Private bathroom',
  'Fresh linens and towels',
  'Complimentary toiletries',
  'Kitchen or kitchenette access',
  'Refrigerator & basic cooking tools',
  'Television / Smart TV',
  'Workspace or desk area',
  'On-site parking / street parking',
  '24/7 security or gated entrance',
  'Laundry facilities (shared or in-unit)',
  'Outdoor seating area / balcony',
  'Essentials: soap, shampoo, toilet paper',
  'Drinking water or electric kettle',
];

const LODGING_RULES = [
  'Check-in and check-out times must be followed',
  'No smoking inside the property',
  'No parties or loud gatherings',
  'Keep noise to a minimum after 10 PM',
  'Pets allowed only if the listing states so',
  'Guests must report any damages immediately',
  'Only registered guests may stay overnight',
  'Maintain cleanliness throughout your stay',
  'Follow building or community guidelines',
  'Lost keys may incur an additional fee',
];

const SERVICE_AMENITIES = [
  'Professional service provider',
  'Necessary tools or equipment (service-specific)',
  'Safety-checked materials and supplies',
  'Transparent pricing before booking',
  'Customer support for concerns',
  'Optional add-ons (if applicable)',
  'Satisfaction guarantee',
  'Service report or summary (when applicable)',
];

const SERVICE_RULES = [
  'Client must provide accurate location details',
  'Service time may vary depending on conditions',
  'Extra fees may apply for additional tasks not listed',
  'Pets or obstacles should be secured before service',
  'Client should ensure safe working space',
  'Cancellations must follow the provider’s policy',
  'Service provider has the right to refuse unsafe tasks',
  'Any damages must be reported immediately',
  'No harassment, discrimination, or abusive behavior',
];

const EXPERIENCE_AMENITIES = [
  'Experienced guide or instructor',
  'Safety equipment (helmets, life vests, etc., if needed)',
  'Materials or supplies for the activity',
  'Introductory orientation or briefing',
  'Snacks or refreshments (if included)',
  'Photos or souvenirs (depending on listing)',
  'Transportation (if stated in listing)',
  'Group or private session options',
  'Printed or digital itinerary',
];

const EXPERIENCE_RULES = [
  'Arrive at least 10–15 minutes before start time',
  'Late arrivals may lose their slot',
  'Follow all safety instructions and briefing',
  'Wear appropriate clothing or gear',
  'Guests must disclose any medical conditions (for safety activities)',
  'Children must be supervised by adults',
  'No reckless behavior during the activity',
  'Cancellations depend on weather or safety conditions',
  'Respect local customs, environment, and wildlife',
  'Bring valid ID for check-in if required',
];

const SERVICE_CATEGORIES = [
  'Beauty services',
  'Cleaning services',
  'Repair & maintenance',
  'Event services',
  'Transport & delivery',
  'Coaching & tutoring',
  'Health & wellness',
  'Photography & media',
  'Business services',
];

const SERVICE_AREAS = [
  'Within 5km of host location',
  'Within 10km of host location',
  'Within 20km of host location',
  'Metro area only',
  'On-site at guest location',
  'Online / remote only',
];

const SERVICE_DURATIONS = [
  '30 minutes',
  '1 hour',
  '1.5 hours',
  '2 hours',
  '3 hours',
  'Half day',
  'Full day',
];

const SERVICE_AVAILABILITY_DAYS = [
  'Weekdays (Mon–Fri)',
  'Weekends (Sat–Sun)',
  'Monday to Saturday',
  'Every day',
];

const SERVICE_AVAILABILITY_RANGES = [
  'Morning (8am–12pm)',
  'Afternoon (12pm–5pm)',
  'Evening (5pm–9pm)',
  'Full day (8am–6pm)',
];

function LocationMarker({ markerPosition, setMarkerPosition }) {
  useMapEvents({
    click(e) {
      setMarkerPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (!markerPosition) return null;
  return <Marker position={markerPosition} />;
}

async function awardHostListingPoints(hostId, points, reason, metadata = {}) {
  if (!hostId || !points) return;
  try {
    const hostRef = doc(db, 'hosts', hostId);
    const hostSnap = await getDoc(hostRef);

    let lifetime = 0;
    let available = 0;
    if (hostSnap.exists()) {
      const data = hostSnap.data();
      lifetime = (data.points && typeof data.points.lifetime === 'number') ? data.points.lifetime : 0;
      available = (data.points && typeof data.points.available === 'number') ? data.points.available : 0;
    }

    const newLifetime = lifetime + points;
    const newAvailable = available + points;

    await setDoc(
      hostRef,
      {
        points: {
          lifetime: newLifetime,
          available: newAvailable,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    const eventsRef = collection(db, 'hostPointsEvents');
    await addDoc(eventsRef, {
      hostId,
      points,
      reason,
      metadata,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to award listing points', err);
  }
}

export default function HostListingsPage() {
  const { user } = useAuth();
  const locationHook = useLocation();

  const [form, setForm] = useState({
    title: '',
    category: 'home',
    rate: '',
    discount: '',
    promo: '',
    coverImage: '',
    images: [],
    location: '',
    description: '',
    amenities: '',
    rules: '',
    maxGuests: '',
    availabilityStart: '',
    availabilityEnd: '',
    availabilityRange: '',
    serviceCategory: '',
    serviceArea: '',
    serviceDuration: '',
    serviceTimeSlots: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hostProfile, setHostProfile] = useState(null);
  const [publishedCount, setPublishedCount] = useState(0);
  const [loadingHost, setLoadingHost] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [markerPosition, setMarkerPosition] = useState([14.5995, 120.9842]);
  const [hostListings, setHostListings] = useState([]);
  const [editingListingId, setEditingListingId] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [availabilityDates, setAvailabilityDates] = useState([null, null]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [freeListingCredits, setFreeListingCredits] = useState(0);

  useEffect(() => {
    const loadHostAndListings = async () => {
      if (!user) {
        setHostProfile(null);
        setPublishedCount(0);
        setLoadingHost(false);
        return;
      }

      try {
        const hostRef = doc(db, 'hosts', user.uid);
        const hostSnap = await getDoc(hostRef);
        if (hostSnap.exists()) {
          setHostProfile(hostSnap.data());
        } else {
          setHostProfile(null);
        }

        const listingsRef = collection(db, 'listings');
        const q = query(listingsRef, where('hostId', '==', user.uid));
        const snap = await getDocs(q);

        let published = 0;
        const items = [];
        snap.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };
          items.push(data);
          if (data.status === 'published') published += 1;
        });

        setPublishedCount(published);
        setHostListings(items);

        // Load any free listing credits
        const creditsRef = collection(db, 'hostFreeListings');
        const qCredits = query(creditsRef, where('hostId', '==', user.uid));
        const creditsSnap = await getDocs(qCredits);
        let credits = 0;
        creditsSnap.forEach((d) => {
          const data = d.data();
          const remaining = typeof data.remainingListings === 'number' ? data.remainingListings : 0;
          if (remaining > 0) {
            credits += remaining;
          }
        });
        setFreeListingCredits(credits);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading host or listings', err);
        setHostProfile(null);
        setPublishedCount(0);
      } finally {
        setLoadingHost(false);
      }
    };

    loadHostAndListings();
  }, [user]);

  // If we arrived from the dashboard with /host/listings?edit=LISTING_ID,
  // automatically load that listing into edit mode once listings are available.
  useEffect(() => {
    const params = new URLSearchParams(locationHook.search);
    const editId = params.get('edit');
    if (!editId || hostListings.length === 0) return;
    const target = hostListings.find((l) => l.id === editId);
    if (target) {
      startEditing(target);
    }
  }, [locationHook.search, hostListings]);

  const isAtListingLimit = () => {
    if (!hostProfile) return false;
    if (hostProfile.listingLimit === null || hostProfile.listingLimit === undefined) {
      return false;
    }
    return publishedCount >= hostProfile.listingLimit;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickAdd = (field, value) => {
    setForm((prev) => {
      const current = prev[field] || '';
      const parts = current
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      let nextParts;
      if (parts.includes(value)) {
        nextParts = parts.filter((p) => p !== value);
      } else {
        nextParts = [...parts, value];
      }

      const next = nextParts.join(nextParts.length ? ', ' : '');
      return { ...prev, [field]: next };
    });
  };

  const handleSingleSelect = (field, value) => {
    setForm((prev) => {
      const current = (prev[field] || '').trim();
      // Clicking the same value again will clear the selection
      if (current === value) {
        return { ...prev, [field]: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const getAmenityOptionsForCategory = () => {
    if (form.category === 'experience') return EXPERIENCE_AMENITIES;
    if (form.category === 'service') return SERVICE_AMENITIES;
    return LODGING_AMENITIES;
  };

  const getRuleOptionsForCategory = () => {
    if (form.category === 'experience') return EXPERIENCE_RULES;
    if (form.category === 'service') return SERVICE_RULES;
    return LODGING_RULES;
  };

  const handleAvailabilityRangeChange = (dates) => {
    const [start, end] = dates;
    setAvailabilityDates([start, end]);

    const format = (d) => (d instanceof Date && !Number.isNaN(d.getTime())
      ? d.toISOString().slice(0, 10)
      : '');

    const startStr = format(start);
    const endStr = format(end);

    let display = '';
    if (startStr && endStr) display = `${startStr} to ${endStr}`;
    else if (startStr) display = `${startStr} to `;

    setForm((prev) => ({
      ...prev,
      availabilityStart: startStr,
      availabilityEnd: endStr,
      availabilityRange: display,
    }));


  };

  const handleImagesChange = (event) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;
    const limited = files.slice(0, 5);
    setImageFiles(limited);
    setImagePreviews(limited.map((file) => URL.createObjectURL(file)));
  };

  const handleRemoveImage = (index) => {
    // If we have new uploads in this session, operate on imageFiles/imagePreviews
    if (imageFiles.length > 0 || imagePreviews.length > 0) {
      setImageFiles((prev) => prev.filter((_, i) => i !== index));
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    // Otherwise operate on existing saved image URLs stored on the form
    setForm((prev) => {
      const current = Array.isArray(prev.images) ? prev.images : [];
      const nextImages = current.filter((_, i) => i !== index);

      let nextCover = prev.coverImage;
      if (index === 0) {
        nextCover = nextImages[0] || '';
      } else if (!nextImages.includes(nextCover)) {
        nextCover = nextImages[0] || '';
      }

      return {
        ...prev,
        images: nextImages,
        coverImage: nextCover,
      };
    });
  };

  const handleLocationBlur = async () => {
    const query = form.location?.trim();
    if (!query) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        },
      );
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const { lat, lon } = data[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
          setMarkerPosition([latNum, lonNum]);
        }
      }
    } catch (geoErr) {
      // eslint-disable-next-line no-console
      console.error('Error geocoding location for map preview', geoErr);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        },
      );
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error reverse geocoding', err);
    }
    return null;
  };

  useEffect(() => {
    const updateLocationFromMap = async () => {
      if (markerPosition && markerPosition.length === 2) {
        const address = await reverseGeocode(markerPosition[0], markerPosition[1]);
        if (address) {
          setForm((prev) => ({ ...prev, location: address }));
        }
      }
    };

    // Only update if markerPosition has changed from initial value
    if (markerPosition && markerPosition.length === 2 && markerPosition[0] !== 14.5995 && markerPosition[1] !== 120.9842) {
      updateLocationFromMap();
    }
  }, [markerPosition]);

  const startEditing = (listing) => {
    setEditingListingId(listing.id);
    setForm({
      title: listing.title || '',
      category: listing.category || 'home',
      rate: listing.rate != null ? String(listing.rate) : '',
      discount: listing.discount != null ? String(listing.discount) : '',
      promo: listing.promo || '',
      coverImage: listing.coverImage || '',
      images: listing.imageUrls || [],
      location: listing.location || '',
      description: listing.description || '',
      amenities: listing.amenities || '',
      rules: listing.rules || '',
      maxGuests: listing.maxGuests != null ? String(listing.maxGuests) : '',
      availabilityStart: listing.availabilityStart || '',
      availabilityEnd: listing.availabilityEnd || '',
      availabilityRange:
        listing.availabilityStart && listing.availabilityEnd
          ? `${listing.availabilityStart} to ${listing.availabilityEnd}`
          : '',
      serviceCategory: listing.serviceCategory || '',
      serviceArea: listing.serviceArea || '',
      serviceDuration: listing.serviceDuration || '',
      serviceTimeSlots: listing.serviceTimeSlots || '',
    });
    if (listing.availabilityStart || listing.availabilityEnd) {
      const startDate = listing.availabilityStart
        ? new Date(listing.availabilityStart)
        : null;
      const endDate = listing.availabilityEnd
        ? new Date(listing.availabilityEnd)
        : null;
      setAvailabilityDates([startDate, endDate]);
    } else {
      setAvailabilityDates([null, null]);
    }
    if (listing.coordinates && Array.isArray(listing.coordinates) && listing.coordinates.length === 2) {
      setMarkerPosition([listing.coordinates[0], listing.coordinates[1]]);
    } else {
      setMarkerPosition([14.5995, 120.9842]);
    }
    setImageFiles([]);
    setImagePreviews([]);
    setActiveStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const publishListing = async (listing) => {
    if (listing.status === 'published') return;
    if (isAtListingLimit()) {
      setError('You have reached your plan\'s limit for published listings.');
      return;
    }
    try {
      const ref = doc(db, 'listings', listing.id);
      await updateDoc(ref, {
        status: 'published',
        updatedAt: serverTimestamp(),
      });
      if (listing.hostId) {
        await awardHostListingPoints(listing.hostId, 10, 'published_listing', { listingId: listing.id });
      }
      const okMessage = 'Listing published.';
      setSuccess(okMessage);
      setError('');
      setSnackbarSeverity('success');
      setSnackbarMessage(okMessage);
      setSnackbarOpen(true);
      setHostListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: 'published' } : l)));
      setPublishedCount((prev) => prev + 1);
    } catch (err) {
      setError(err.message || 'Failed to publish listing. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarMessage(err.message || 'Failed to publish listing. Please try again.');
      setSnackbarOpen(true);
    }
  };

  const unpublishListing = async (listing) => {
    if (listing.status !== 'published') return;
    try {
      const ref = doc(db, 'listings', listing.id);
      await updateDoc(ref, {
        status: 'draft',
        updatedAt: serverTimestamp(),
      });
      setSuccess('Listing moved back to draft.');
      setError('');
      setHostListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: 'draft' } : l)));
      setPublishedCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      setError(err.message || 'Failed to unpublish listing. Please try again.');
    }
  };

  const deleteListing = async (listing) => {
    try {
      const ref = doc(db, 'listings', listing.id);
      await deleteDoc(ref);
      setHostListings((prev) => prev.filter((l) => l.id !== listing.id));
      if (listing.status === 'published') {
        setPublishedCount((prev) => Math.max(prev - 1, 0));
      }
      setSuccess('Listing deleted.');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to delete listing. Please try again.');
    }
  };

  const handleSave = async (status) => {
    if (!user) {
      setError('You must be logged in to create listings.');
      setSnackbarSeverity('error');
      setSnackbarMessage('You must be logged in to create listings.');
      setSnackbarOpen(true);
      return;
    }

    const atLimitBefore = isAtListingLimit();

    if (status === 'published' && !editingListingId && atLimitBefore && freeListingCredits <= 0) {
      setError('You have reached your plan\'s limit for published listings.');
      return;
    }

    if (!form.title || !form.location) {
      setError('Please provide at least a title and location for your listing.');
      setSnackbarSeverity('error');
      setSnackbarMessage('Please provide at least a title and location for your listing.');
      setSnackbarOpen(true);
      return;
    }

    if (form.availabilityStart && form.availabilityEnd && form.availabilityEnd < form.availabilityStart) {
      setError('Availability end date cannot be before the start date.');
      setSnackbarSeverity('error');
      setSnackbarMessage('Availability end date cannot be before the start date.');
      setSnackbarOpen(true);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      let coverUrl = form.coverImage || null;
      let imageUrls = Array.isArray(form.images) ? [...form.images] : [];

      if (imageFiles.length > 0) {
        setUploadingCover(true);
        const uploadedUrls = [];

        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          throw new Error('Cloudinary configuration is missing. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
        }

        // Upload all selected images (up to 5) to Cloudinary
        // eslint-disable-next-line no-restricted-syntax
        for (const file of imageFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', uploadPreset);

          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to upload image to Cloudinary.');
          }

          // eslint-disable-next-line no-await-in-loop
          const data = await response.json();
          if (data.secure_url) {
            uploadedUrls.push(data.secure_url);
          }
        }

        if (uploadedUrls.length === 0) {
          throw new Error('No images were uploaded.');
        }

        imageUrls = uploadedUrls;
        coverUrl = uploadedUrls[0] || coverUrl;
      }

      const payload = {
        hostId: user.uid,
        title: form.title,
        category: form.category,
        rate: form.rate ? Number(form.rate) : null,
        discount: form.discount ? Number(form.discount) : null,
        promo: form.promo || null,
        coverImage: coverUrl,
        imageUrls,
        location: form.location,
        description: form.description,
        amenities: form.amenities || '',
        rules: form.rules || '',
        maxGuests: form.maxGuests ? Number(form.maxGuests) : null,
        availabilityStart: form.availabilityStart || null,
        availabilityEnd: form.availabilityEnd || null,
        serviceCategory: form.category === 'service' ? (form.serviceCategory || null) : null,
        serviceArea: form.category === 'service' ? (form.serviceArea || null) : null,
        serviceDuration: form.category === 'service' ? (form.serviceDuration || null) : null,
        serviceTimeSlots: form.category === 'service' ? (form.serviceTimeSlots || null) : null,
        status,
        updatedAt: serverTimestamp(),
      };

      if (markerPosition && markerPosition.length === 2) {
        payload.coordinates = [markerPosition[0], markerPosition[1]];
      }

      if (editingListingId) {
        const ref = doc(db, 'listings', editingListingId);
        await updateDoc(ref, payload);
        setHostListings((prev) =>
          prev.map((l) => (l.id === editingListingId ? { ...l, ...payload } : l)),
        );
      } else {
        const listingsRef = collection(db, 'listings');
        const newDoc = await addDoc(listingsRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        if (status === 'published') {
          await awardHostListingPoints(user.uid, 10, 'published_listing', { listingId: newDoc.id });
        }
      }

      const okMessage = status === 'draft' ? 'Draft saved.' : 'Listing published.';
      setSuccess(okMessage);
      setSnackbarSeverity('success');
      setSnackbarMessage(okMessage);
      setSnackbarOpen(true);
      if (status === 'published' && !editingListingId) {
        // If we were at the plan limit but had a free listing credit, consume one credit
        if (atLimitBefore && freeListingCredits > 0) {
          try {
            const creditsRef = collection(db, 'hostFreeListings');
            const qCredits = query(creditsRef, where('hostId', '==', user.uid));
            const creditsSnap = await getDocs(qCredits);
            let consumed = false;
            // eslint-disable-next-line no-restricted-syntax
            for (const d of creditsSnap.docs) {
              const data = d.data();
              const remaining = typeof data.remainingListings === 'number' ? data.remainingListings : 0;
              if (remaining > 0) {
                const ref = doc(db, 'hostFreeListings', d.id);
                await updateDoc(ref, { remainingListings: remaining - 1 });
                consumed = true;
                break;
              }
            }
            if (consumed) {
              setFreeListingCredits((prev) => Math.max(prev - 1, 0));
            }
          } catch (creditErr) {
            // eslint-disable-next-line no-console
            console.error('Failed to consume free listing credit', creditErr);
          }
        }
        setPublishedCount((prev) => prev + 1);
      }
      setForm({
        title: '',
        category: 'home',
        rate: '',
        discount: '',
        promo: '',
        coverImage: '',
        images: [],
        location: '',
        description: '',
        amenities: '',
        rules: '',
        maxGuests: '',
        availabilityStart: '',
        availabilityEnd: '',
        availabilityRange: '',
        serviceCategory: '',
        serviceArea: '',
        serviceDuration: '',
        serviceTimeSlots: '',
      });
      setActiveStep(0);
      setEditingListingId(null);
      setMarkerPosition([14.5995, 120.9842]);
      setImageFiles([]);
      setImagePreviews([]);
      setAvailabilityDates([null, null]);
    } catch (err) {
      const errMessage = err.message || 'Failed to save listing. Please try again.';
      setError(errMessage);
      setSnackbarSeverity('error');
      setSnackbarMessage(errMessage);
      setSnackbarOpen(true);
    } finally {
      setSaving(false);
      setUploadingCover(false);
    }
  };

  const publishedListings = hostListings.filter((l) => l.status === 'published');
  const draftListings = hostListings.filter((l) => l.status === 'draft');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-3">
        <h4 className="text-2xl font-bold mb-2">
          Host Listings - Create a listing
        </h4>
        <p className="text-sm text-gray-600">
          Choose whether you list a Home, Experience, or Service, then add your pricing and details.
        </p>
        {!loadingHost && hostProfile && (
          <p className="text-sm text-gray-600 mt-1">
            You are on <strong>{hostProfile.subscriptionPlan || 'your current plan'}</strong> with{' '}
            {hostProfile.listingLimit === null || hostProfile.listingLimit === undefined
              ? 'unlimited listings.'
              : `${hostProfile.listingLimit} total published listings.`}{' '}
            Currently published: {publishedCount}.
          </p>
        )}
        {!loadingHost && !hostProfile && (
          <p className="text-sm text-gray-600 mt-1">
            No host subscription profile found. Complete host registration to unlock publishing limits.
          </p>
        )}
      </div>

      <div className="mt-3">
        <div className="flex justify-between items-center mb-4">
          <div className={`flex-1 text-center ${activeStep >= 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${activeStep >= 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
              1
            </div>
            <p className="text-sm">Basics</p>
          </div>
          <div className={`flex-1 text-center ${activeStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${activeStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
              2
            </div>
            <p className="text-sm">Amenities & Rules</p>
          </div>
          <div className={`flex-1 text-center ${activeStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${activeStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
              3
            </div>
            <p className="text-sm">Pricing & Publish</p>
          </div>
        </div>
        <div className="flex">
          <div className={`h-1 flex-1 ${activeStep >= 0 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`h-1 flex-1 ${activeStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`h-1 flex-1 ${activeStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 place-items-center">
        <div className="col-span-12 max-w-4xl">
          <div className="bg-white rounded-lg shadow p-3 min-h-[520px]">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-2">
                {success}
              </div>
            )}

            {activeStep === 0 && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing title</label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold mb-1">Listing photos</p>
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={uploadingCover}
                  >
                    <label className="cursor-pointer">
                      {imageFiles.length > 0 ? 'Change images' : 'Upload images'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImagesChange}
                      />
                    </label>
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload up to 5 images. The first image will be used as the cover on guest pages.
                  </p>
                  {form.coverImage && imageFiles.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Existing photos are already saved for this listing.
                    </p>
                  )}
                  {/* Preview grid */}
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {imagePreviews.length > 0
                      ? imagePreviews.map((src, idx) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={idx}
                            className={`relative w-18 h-18 rounded overflow-hidden border ${idx === 0 ? 'border-green-600 border-2' : 'border-gray-300'}`}
                          >
                            <img
                              src={src}
                              alt={idx === 0 ? 'Cover preview' : 'Photo preview'}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="absolute top-0.5 right-0.5 bg-white/80 text-xs px-1 rounded-full border border-gray-300 hover:bg-red-50"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      : Array.isArray(form.images) && form.images.length > 0
                        ? form.images.map((url, idx) => (
                            <div
                              key={url}
                              className={`relative w-18 h-18 rounded overflow-hidden border ${idx === 0 ? 'border-green-600 border-2' : 'border-gray-300'}`}
                            >
                              <img
                                src={url}
                                alt={idx === 0 ? 'Cover preview' : 'Photo preview'}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-0.5 right-0.5 bg-white/80 text-xs px-1 rounded-full border border-gray-300 hover:bg-red-50"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        : null}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing type</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="home">Home</option>
                    <option value="experience">Experience</option>
                    <option value="service">Service</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    onBlur={handleLocationBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max guests</label>
                  <input
                    type="number"
                    name="maxGuests"
                    value={form.maxGuests}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mt-6 border border-gray-300 rounded-lg overflow-hidden h-56 max-w-md bg-white relative z-0">
                  <MapContainer
                    center={markerPosition || [14.5995, 120.9842]}
                    zoom={12}
                    scrollWheelZoom={false}
                    className="w-full h-full"
                  >
                    <TileLayer
                      attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker
                      markerPosition={markerPosition}
                      setMarkerPosition={setMarkerPosition}
                    />
                  </MapContainer>
                </div>

                <div className="mt-6 w-full relative z-10 flex flex-col items-start">
                  <p className="text-sm font-semibold mb-2">Availability range</p>
                  <div className="mt-2 w-full max-w-xs">
                    <DatePicker
                      selected={availabilityDates[0]}
                      onChange={handleAvailabilityRangeChange}
                      startDate={availabilityDates[0]}
                      endDate={availabilityDates[1]}
                      selectsRange
                      minDate={new Date()}
                      dateFormat="MMM dd"
                      monthsShown={1}
                      placeholderText="Select availability range"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      calendarClassName="!text-xs"
                      renderCustomHeader={(headerProps) => (
                        <div className="flex items-center justify-between mb-2 px-1">
                          <button
                            type="button"
                            onClick={headerProps.decreaseMonth}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                          >
                            Prev
                          </button>
                          <span className="text-sm font-semibold text-gray-800">
                            {headerProps.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={headerProps.increaseMonth}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Guests can only book within this date range.
                  </p>
                </div>

                {/* Draft saving for this step is handled by the shared footer button below */}
              </>
            )}

            {activeStep === 1 && (
              <>
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-800">Amenities</label>
                    <span className="text-xs text-gray-500 capitalize">{form.category}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {getAmenityOptionsForCategory().map((amenity) => {
                      const current = form.amenities || '';
                      const selected = current
                        .split(',')
                        .map((p) => p.trim())
                        .filter((p) => p.length > 0)
                        .includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                            selected
                              ? 'bg-green-100 border-green-500 text-green-800'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                          onClick={() => handleQuickAdd('amenities', amenity)}
                        >
                          {amenity}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-800">House rules</label>
                    <span className="text-xs text-gray-500 capitalize">{form.category}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {getRuleOptionsForCategory().map((rule) => {
                      const current = form.rules || '';
                      const selected = current
                        .split(',')
                        .map((p) => p.trim())
                        .filter((p) => p.length > 0)
                        .includes(rule);
                      return (
                        <button
                          key={rule}
                          type="button"
                          className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                            selected
                              ? 'bg-green-100 border-green-500 text-green-800'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                          onClick={() => handleQuickAdd('rules', rule)}
                        >
                          {rule}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </>
            )}

            {activeStep === 2 && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.category === 'service' ? 'Price per session / per hour' : 'Nightly rate / base rate'}
                  </label>
                  <input
                    type="number"
                    name="rate"
                    value={form.rate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {form.category === 'service' && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service category</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {SERVICE_CATEGORIES.map((opt) => {
                          const selected = (form.serviceCategory || '').trim() === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                                selected
                                  ? 'bg-green-100 border-green-500 text-green-800'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => handleSingleSelect('serviceCategory', opt)}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service area / coverage</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {SERVICE_AREAS.map((opt) => {
                          const selected = (form.serviceArea || '').trim() === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                                selected
                                  ? 'bg-green-100 border-green-500 text-green-800'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => handleSingleSelect('serviceArea', opt)}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Typical duration</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {SERVICE_DURATIONS.map((opt) => {
                            const current = form.serviceDuration || '';
                            const parts = current
                              .split(',')
                              .map((p) => p.trim())
                              .filter((p) => p.length > 0);
                            const selected = parts.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                                  selected
                                    ? 'bg-green-100 border-green-500 text-green-800'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                }`}
                                onClick={() => handleQuickAdd('serviceDuration', opt)}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Availability time slots</label>
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Days</p>
                          <div className="flex flex-wrap gap-2">
                            {SERVICE_AVAILABILITY_DAYS.map((opt) => {
                              const current = form.serviceTimeSlots || '';
                              const parts = current
                                .split(',')
                                .map((p) => p.trim())
                                .filter((p) => p.length > 0);
                              const selected = parts.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                                    selected
                                      ? 'bg-green-100 border-green-500 text-green-800'
                                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                  }`}
                                  onClick={() => handleQuickAdd('serviceTimeSlots', opt)}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Hour ranges</p>
                          <div className="flex flex-wrap gap-2">
                            {SERVICE_AVAILABILITY_RANGES.map((opt) => {
                              const current = form.serviceTimeSlots || '';
                              const parts = current
                                .split(',')
                                .map((p) => p.trim())
                                .filter((p) => p.length > 0);
                              const selected = parts.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap ${
                                    selected
                                      ? 'bg-green-100 border-green-500 text-green-800'
                                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                  }`}
                                  onClick={() => handleQuickAdd('serviceTimeSlots', opt)}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <input
                          type="text"
                          name="serviceTimeSlots"
                          value={form.serviceTimeSlots}
                          onChange={handleChange}
                          placeholder="e.g. Mon–Fri 9am–6pm, Sat 10am–2pm"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                    disabled={saving || (!editingListingId && isAtListingLimit())}
                    onClick={() => handleSave('published')}
                  >
                    {isAtListingLimit() ? 'Publish limit reached' : 'Publish listing'}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => handleSave('draft')}
                  >
                    Save as draft
                  </button>
                </div>
              </>

            )}

            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
              >
                Back
              </button>

              {activeStep < 2 && (
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                  onClick={() => setActiveStep((prev) => Math.min(prev + 1, 2))}
                >
                  Next
                </button>
              )}
              {activeStep < 2 && (
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                >
                  Save as draft
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {snackbarOpen && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-white ${snackbarSeverity === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {snackbarMessage}
        </div>
      )}
    </div>
  );
}
