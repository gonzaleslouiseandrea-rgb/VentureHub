import { useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, query, setDoc, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/ToastProvider.jsx';

export default function useFavorites() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [favorites, setFavorites] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    const fetchFavorites = async () => {
      if (!user) {
        setFavorites(new Set());
        return;
      }
      try {
        const favRef = collection(db, 'favorites');
        const q = query(favRef, where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!mounted) return;
        const ids = new Set(snapshot.docs.map((d) => d.data().listingId));
        setFavorites(ids);
      } catch (err) {
        // surface error
        // eslint-disable-next-line no-console
        console.error('Error fetching favorites', err);
        if (err && err.code === 'permission-denied') {
          showToast('Permission denied reading favorites. Check Firestore rules.', 'warning');
        } else {
          showToast('Error loading favorites', 'error');
        }
      }
    };
    fetchFavorites();
    return () => { mounted = false; };
  }, [user, showToast]);

  const toggleFavorite = useCallback(async (id) => {
    if (!user) {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      showToast('Favorites saved locally. Log in to persist.', 'info');
      return;
    }

    // Determine action before optimistic update
    let wasFavorited = false;
    setFavorites((prev) => {
      wasFavorited = prev.has(id);
      return prev;
    });

    // optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    const docId = `${user.uid}_${id}`;
    try {
      if (wasFavorited) {
        await deleteDoc(doc(db, 'favorites', docId));
        showToast('Removed from favorites', 'info');
      } else {
        await setDoc(doc(db, 'favorites', docId), {
          userId: user.uid,
          listingId: id,
          createdAt: new Date(),
        });
        showToast('Added to favorites', 'success');
      }
    } catch (err) {
      // revert optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      // eslint-disable-next-line no-console
      console.error('Error toggling favorite', err);
      if (err && err.code === 'permission-denied') {
        showToast('Permission denied saving favorites. Check Firestore rules.', 'error');
      } else {
        showToast('Error updating favorites', 'error');
      }
    }
  }, [user, showToast]);

  return { favorites, toggleFavorite };
}
