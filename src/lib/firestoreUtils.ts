import { auth } from './firebase';
import { addDoc, setDoc, updateDoc, CollectionReference, DocumentReference, DocumentData } from 'firebase/firestore';

export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // Keep Firestore Sentinel objects (like serverTimestamp(), deleteField()) and Date objects intact
  if (obj instanceof Date || ('_methodName' in (obj as any)) || ('seconds' in (obj as any))) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return (obj as any[])
      .filter(item => item !== undefined)
      .map(item => sanitizeFirestorePayload(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeFirestorePayload(value);
    }
  }
  return cleaned as T;
}

export async function safeAddDoc(colRef: CollectionReference<DocumentData>, data: any) {
  const cleanData = sanitizeFirestorePayload(data);
  try {
    return await addDoc(colRef, cleanData);
  } catch (err: any) {
    const errStr = err?.message || String(err);
    if (errStr.includes('Quota limit exceeded') || errStr.includes('resource-exhausted') || errStr.includes('offline') || errStr.includes('network')) {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_date', new Date().toDateString());
      try {
        const queueKey = 'app_offline_writes_queue';
        const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
        existing.push({ type: 'add', path: colRef.path, data: cleanData, timestamp: Date.now() });
        localStorage.setItem(queueKey, JSON.stringify(existing));
      } catch {}
      console.warn('Firestore write queued offline due to quota/network limit');
      return { id: `offline_${Date.now()}` } as DocumentReference;
    }
    throw err;
  }
}

export async function safeSetDoc(docRef: DocumentReference<DocumentData>, data: any, options?: any) {
  const cleanData = sanitizeFirestorePayload(data);
  try {
    return options !== undefined ? await setDoc(docRef, cleanData, options) : await setDoc(docRef, cleanData);
  } catch (err: any) {
    const errStr = err?.message || String(err);
    if (errStr.includes('Quota limit exceeded') || errStr.includes('resource-exhausted') || errStr.includes('offline') || errStr.includes('network')) {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_date', new Date().toDateString());
      try {
        const queueKey = 'app_offline_writes_queue';
        const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
        existing.push({ type: 'set', path: docRef.path, data: cleanData, options, timestamp: Date.now() });
        localStorage.setItem(queueKey, JSON.stringify(existing));
      } catch {}
      console.warn('Firestore setDoc queued offline due to quota/network limit');
      return;
    }
    throw err;
  }
}

export async function safeUpdateDoc(docRef: DocumentReference<DocumentData>, data: any) {
  const cleanData = sanitizeFirestorePayload(data);
  try {
    return await updateDoc(docRef, cleanData);
  } catch (err: any) {
    const errStr = err?.message || String(err);
    if (errStr.includes('Quota limit exceeded') || errStr.includes('resource-exhausted') || errStr.includes('offline') || errStr.includes('network')) {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_date', new Date().toDateString());
      try {
        const queueKey = 'app_offline_writes_queue';
        const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
        existing.push({ type: 'update', path: docRef.path, data: cleanData, timestamp: Date.now() });
        localStorage.setItem(queueKey, JSON.stringify(existing));
      } catch {}
      console.warn('Firestore updateDoc queued offline due to quota/network limit');
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
