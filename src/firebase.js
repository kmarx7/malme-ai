import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD-BVjbsp7qxhH0A5V2VbKotry6AM5KR60",
  authDomain: "voicememok-acada.firebaseapp.com",
  projectId: "voicememok-acada",
  storageBucket: "voicememok-acada.firebasestorage.app",
  messagingSenderId: "24544481752",
  appId: "1:24544481752:web:10620a2b077b40037622ad",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);
export default app;
