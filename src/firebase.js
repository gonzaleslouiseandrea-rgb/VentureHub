import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyATfLSESrwCi_4Q43KKREbcuwaPT4f_zsw',
  authDomain: 'venturehub-1fc72.firebaseapp.com',
  projectId: 'venturehub-1fc72',
  // Use the default appspot.com bucket domain; the firebasestorage.app URL is for REST access only
  storageBucket: 'venturehub-1fc72.appspot.com',
  messagingSenderId: '252944346498',
  appId: '1:252944346498:web:70c1831a138a668c0eb39b',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
