import { auth } from './firebase';
import { addDoc, setDoc, updateDoc, CollectionReference, DocumentReference, DocumentData } from 'firebase/firestore';

export async function safeAddDoc(colRef: CollectionReference<DocumentData>, data: any) {
  try {
    return await addDoc(colRef, data);
  } catch (err: any) {
    const errStr = err?.message || String(err);
    if (errStr.includes('Quota limit exceeded') || errStr.includes('resource-exhausted') || errStr.includes('offline') || errStr.includes('network')) {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_date', new Date().toDateString());
      try {
        const queueKey = 'app_offline_writes_queue';
        const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
        existing.push({ type: 'add', path: colRef.path, data, timestamp: Date.now() });
        localStorage.setItem(queueKey, JSON.stringify(existing));
      } catch {}
      console.warn('Firestore write queued offline due to quota/network limit');
      return { id: `offline_${Date.now()}` } as DocumentReference;
    }
    throw err;
  }
}

export async function safeSetDoc(docRef: DocumentReference<DocumentData>, data: any, options?: any) {
  try {
    return await setDoc(docRef, data, options);
  } catch (err: any) {
    const errStr = err?.message || String(err);
    if (errStr.includes('Quota limit exceeded') || errStr.includes('resource-exhausted') || errStr.includes('offline') || errStr.includes('network')) {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_date', new Date().toDateString());
      try {
        const queueKey = 'app_offline_writes_queue';
        const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
        existing.push({ type: 'set', path: docRef.path, data, options, timestamp: Date.now() });
        localStorage.setItem(queueKey, JSON.stringify(existing));
      } catch {}
      console.warn('Firestore setDoc queued offline due to quota/network limit');
      return;
    }
    throw err;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing anymore to prevent app crash, just logging and using console.error
  // throw new Error(JSON.stringify(errInfo));
}
