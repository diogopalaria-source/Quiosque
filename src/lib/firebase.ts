import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  browserPopupRedirectResolver 
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId;

// Force robust HTTP long polling instead of WebSockets. This avoids "client is offline" errors 
// inside restricted iFrames or behind proxy/firewall configurations.
export const db = databaseId 
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, databaseId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
export const logout = () => signOut(auth);
