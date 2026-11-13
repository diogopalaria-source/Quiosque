import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';
import { getBasePath, getPurchaseRequestsPath } from './utils';
import { sanitizeFirestorePayload } from './firestoreUtils';
import { PurchaseRequest } from '../types';

export type OutboxOpType = 'upsert' | 'patch' | 'delete';

interface OutboxOp {
  opId: string;
  docId: string;
  type: OutboxOpType;
  data?: Partial<PurchaseRequest>;
  createdAtMs: number;
}

const CACHE_PREFIX = 'pr_v2_cache_';
const OUTBOX_PREFIX = 'pr_v2_outbox_';
const BROADCAST_CHANNEL_NAME = 'mr_cheney_purchase_requests_v2';

type Listener = (items: PurchaseRequest[]) => void;

class PurchaseRequestsStore {
  private currentPath: string | null = null;
  private listeners = new Set<Listener>();
  private activeUnsub: Unsubscribe | null = null;
  private receivedUnsub: Unsubscribe | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isFlushing = false;

  private serverActiveLoaded = false;
  private serverReceivedLoaded = false;
  private serverActiveMap = new Map<string, PurchaseRequest>();
  private serverReceivedMap = new Map<string, PurchaseRequest>();
  private cachedItemsMap = new Map<string, PurchaseRequest>();
  private recentlyConfirmed = new Map<string, { item: PurchaseRequest | null; deleted: boolean; ts: number }>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'PR_UPDATED' && event.data?.path === this.getPath()) {
              this.loadLocalCache();
              this.emit();
              void this.flushOutbox();
            }
          };
        }
      } catch {}

      window.addEventListener('online', () => {
        void this.flushOutbox();
      });

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.listeners.size > 0) {
          void this.flushOutbox();
        }
      });

      window.addEventListener('storage', (e) => {
        const path = this.getPath();
        if (e.key === this.getCacheKey(path) || e.key === this.getOutboxKey(path)) {
          this.loadLocalCache();
          this.emit();
        }
      });
    }
  }

  private getPath(): string {
    return getPurchaseRequestsPath();
  }

  private getCacheKey(path: string): string {
    return `${CACHE_PREFIX}${path}`;
  }

  private getOutboxKey(path: string): string {
    return `${OUTBOX_PREFIX}${path}`;
  }

  private loadOutbox(): OutboxOp[] {
    const path = this.getPath();
    try {
      const raw = localStorage.getItem(this.getOutboxKey(path));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private saveOutbox(ops: OutboxOp[]): void {
    const path = this.getPath();
    try {
      localStorage.setItem(this.getOutboxKey(path), JSON.stringify(ops));
    } catch {}
  }

  private loadLocalCache(): void {
    const path = this.getPath();
    const map = new Map<string, PurchaseRequest>();

    // Load v2 dedicated cache first
    try {
      const raw = localStorage.getItem(this.getCacheKey(path));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: PurchaseRequest) => {
            if (item && item.id) map.set(item.id, item);
          });
        }
      }
    } catch {}

    // Fallback: hydrate from legacy cache key if v2 cache is still empty
    if (map.size === 0) {
      try {
        const legacyRaw = localStorage.getItem(`app_cache_${path}`);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: PurchaseRequest) => {
              if (item && item.id && !String(item.id).startsWith('offline_')) {
                map.set(item.id, item);
              }
            });
          }
        }
      } catch {}
    }

    this.cachedItemsMap = map;
  }

  private persistMergedCache(items: PurchaseRequest[]): void {
    const path = this.getPath();
    try {
      localStorage.setItem(this.getCacheKey(path), JSON.stringify(items));
      localStorage.setItem(`app_cache_${path}`, JSON.stringify(items));
    } catch {}
  }

  private migrateLegacyOfflineQueue(): void {
    const path = this.getPath();
    try {
      const raw = localStorage.getItem('app_offline_writes_queue');
      if (!raw) return;
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining: any[] = [];
      const outbox = this.loadOutbox();
      let changed = false;

      for (const entry of queue) {
        if (entry?.path === path && entry?.type === 'add' && entry?.data?.produto) {
          const newId = this.generateId();
          const itemData: PurchaseRequest = {
            ...entry.data,
            id: newId,
            userId: entry.data.userId || getBasePath()
          };
          outbox.push({
            opId: `mig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            docId: newId,
            type: 'upsert',
            data: itemData,
            createdAtMs: entry.timestamp || Date.now()
          });
          this.cachedItemsMap.set(newId, itemData);
          changed = true;
        } else {
          remaining.push(entry);
        }
      }

      if (changed) {
        this.saveOutbox(outbox);
        localStorage.setItem('app_offline_writes_queue', JSON.stringify(remaining));
      }
    } catch {}
  }

  private generateId(): string {
    return `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async ensureAuthReady(): Promise<void> {
    if (auth.currentUser) return;
    try {
      await signInAnonymously(auth);
    } catch (err) {
      // Rules under /users/{userId}/{document=**} permit writes even if anonymous sign-in is disabled,
      // so we log and proceed rather than blocking persistence.
      console.warn('[PurchaseRequestsStore] Anonymous auth fallback warning:', err);
    }
  }

  private buildMergedSnapshot(): PurchaseRequest[] {
    const merged = new Map<string, PurchaseRequest>();

    if (this.serverActiveLoaded) {
      this.serverActiveMap.forEach((v, k) => merged.set(k, v));
    } else {
      this.cachedItemsMap.forEach((v, k) => {
        if (v.status === 'pendente' || v.status === 'comprado') {
          merged.set(k, v);
        }
      });
    }

    if (this.serverReceivedLoaded) {
      this.serverReceivedMap.forEach((v, k) => merged.set(k, v));
    } else {
      this.cachedItemsMap.forEach((v, k) => {
        if (v.status === 'recebido') {
          merged.set(k, v);
        }
      });
    }

    // Preserve any recently confirmed items during the brief window before onSnapshot echoes
    const now = Date.now();
    this.recentlyConfirmed.forEach((entry, docId) => {
      if (now - entry.ts > 8000) {
        this.recentlyConfirmed.delete(docId);
        return;
      }
      if (entry.deleted) {
        merged.delete(docId);
      } else if (entry.item) {
        const existing = merged.get(docId);
        merged.set(docId, { ...(existing || {}), ...entry.item, id: docId } as PurchaseRequest);
      }
    });

    // Apply all pending outbox operations on top so un-synced local mutations NEVER vanish
    const outbox = this.loadOutbox();
    for (const op of outbox) {
      if (op.type === 'delete') {
        merged.delete(op.docId);
      } else if (op.type === 'upsert' && op.data) {
        merged.set(op.docId, { ...(op.data as PurchaseRequest), id: op.docId });
      } else if (op.type === 'patch' && op.data) {
        const current = merged.get(op.docId) || this.cachedItemsMap.get(op.docId);
        if (current) {
          merged.set(op.docId, { ...current, ...op.data, id: op.docId });
        }
      }
    }

    const result = Array.from(merged.values());
    this.cachedItemsMap = merged;
    this.persistMergedCache(result);
    return result;
  }

  private emit(): void {
    const items = this.buildMergedSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.error('[PurchaseRequestsStore] Listener error:', err);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('purchase-requests-synced', { detail: items }));
    }
  }

  private notifyCrossTab(): void {
    try {
      this.broadcastChannel?.postMessage({ type: 'PR_UPDATED', path: this.getPath() });
    } catch {}
  }

  private startListeners(): void {
    const path = this.getPath();
    if (this.currentPath === path && this.activeUnsub && this.receivedUnsub) {
      return;
    }

    this.stopListeners();
    this.currentPath = path;
    this.serverActiveLoaded = false;
    this.serverReceivedLoaded = false;
    this.serverActiveMap.clear();
    this.serverReceivedMap.clear();
    this.loadLocalCache();
    this.migrateLegacyOfflineQueue();

    const colRef = collection(db, path);

    // Stream 1: ALL active cards (Precisa Comprar + Confirmar Recebimento) — NO limit()!
    const activeQuery = query(colRef, where('status', 'in', ['pendente', 'comprado']));
    this.activeUnsub = onSnapshot(
      activeQuery,
      (snap) => {
        const nextMap = new Map<string, PurchaseRequest>();
        snap.forEach((docSnap) => {
          nextMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id } as PurchaseRequest);
        });
        this.serverActiveMap = nextMap;
        this.serverActiveLoaded = true;
        this.emit();
      },
      (err) => {
        console.warn('[PurchaseRequestsStore] Active onSnapshot error (keeping outbox + cache):', err);
      }
    );

    // Stream 2: Received history — isolated from active cards so history never truncates active items
    const receivedQuery = query(colRef, where('status', '==', 'recebido'));
    this.receivedUnsub = onSnapshot(
      receivedQuery,
      (snap) => {
        const nextMap = new Map<string, PurchaseRequest>();
        snap.forEach((docSnap) => {
          nextMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id } as PurchaseRequest);
        });
        this.serverReceivedMap = nextMap;
        this.serverReceivedLoaded = true;
        this.emit();
      },
      (err) => {
        console.warn('[PurchaseRequestsStore] Received onSnapshot error:', err);
      }
    );

    if (!this.periodicSyncTimer) {
      this.periodicSyncTimer = setInterval(() => {
        if (this.loadOutbox().length > 0) {
          void this.flushOutbox();
        }
      }, 10000);
    }

    void this.flushOutbox();
  }

  private stopListeners(): void {
    if (this.activeUnsub) {
      this.activeUnsub();
      this.activeUnsub = null;
    }
    if (this.receivedUnsub) {
      this.receivedUnsub();
      this.receivedUnsub = null;
    }
    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer);
      this.periodicSyncTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.currentPath = null;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.startListeners();
    listener(this.buildMergedSnapshot());

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopListeners();
      }
    };
  }

  public getSnapshot(): PurchaseRequest[] {
    if (!this.currentPath) {
      this.loadLocalCache();
    }
    return this.buildMergedSnapshot();
  }

  public getPendingSyncCount(): number {
    return this.loadOutbox().length;
  }

  public async forceRefresh(): Promise<PurchaseRequest[]> {
    const path = this.getPath();
    if (!this.currentPath || this.currentPath !== path) {
      this.loadLocalCache();
    }
    await this.flushOutbox();
    try {
      await this.ensureAuthReady();
      const colRef = collection(db, path);
      const [activeSnap, receivedSnap] = await Promise.all([
        getDocs(query(colRef, where('status', 'in', ['pendente', 'comprado']))),
        getDocs(query(colRef, where('status', '==', 'recebido')))
      ]);

      const nextActive = new Map<string, PurchaseRequest>();
      activeSnap.forEach((d) => nextActive.set(d.id, { ...d.data(), id: d.id } as PurchaseRequest));
      this.serverActiveMap = nextActive;
      this.serverActiveLoaded = true;

      const nextReceived = new Map<string, PurchaseRequest>();
      receivedSnap.forEach((d) => nextReceived.set(d.id, { ...d.data(), id: d.id } as PurchaseRequest));
      this.serverReceivedMap = nextReceived;
      this.serverReceivedLoaded = true;

      this.emit();
    } catch (err) {
      console.warn('[PurchaseRequestsStore] forceRefresh fallback to cache:', err);
    }
    return this.buildMergedSnapshot();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flushOutbox();
    }, 5000);
  }

  public async flushOutbox(): Promise<void> {
    if (this.isFlushing) return;
    const ops = this.loadOutbox();
    if (ops.length === 0) return;

    this.isFlushing = true;
    const path = this.getPath();
    try {
      await this.ensureAuthReady();
      let remaining = [...ops];

      for (const op of ops) {
        try {
          const docRef = doc(db, path, op.docId);
          if (op.type === 'delete') {
            await deleteDoc(docRef);
            this.serverActiveMap.delete(op.docId);
            this.serverReceivedMap.delete(op.docId);
            this.recentlyConfirmed.set(op.docId, { item: null, deleted: true, ts: Date.now() });
          } else if (op.type === 'upsert' && op.data) {
            const { id: _ignoreId, ...rest } = op.data as any;
            const payload = sanitizeFirestorePayload({
              ...rest,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            await setDoc(docRef, payload, { merge: true });
            const itemObj = { ...op.data, id: op.docId } as PurchaseRequest;
            if (itemObj.status === 'recebido') {
              this.serverActiveMap.delete(op.docId);
              this.serverReceivedMap.set(op.docId, itemObj);
            } else if (itemObj.status === 'pendente' || itemObj.status === 'comprado') {
              this.serverReceivedMap.delete(op.docId);
              this.serverActiveMap.set(op.docId, itemObj);
            }
            this.recentlyConfirmed.set(op.docId, { item: itemObj, deleted: false, ts: Date.now() });
          } else if (op.type === 'patch' && op.data) {
            const { id: _ignoreId, ...rest } = op.data as any;
            const payload = sanitizeFirestorePayload({
              ...rest,
              updatedAt: serverTimestamp()
            });
            await setDoc(docRef, payload, { merge: true });
            const existing = this.serverActiveMap.get(op.docId) || this.serverReceivedMap.get(op.docId) || this.cachedItemsMap.get(op.docId);
            const mergedItem = { ...(existing || {}), ...op.data, id: op.docId } as PurchaseRequest;
            if (mergedItem.status === 'recebido') {
              this.serverActiveMap.delete(op.docId);
              this.serverReceivedMap.set(op.docId, mergedItem);
            } else if (mergedItem.status === 'pendente' || mergedItem.status === 'comprado') {
              this.serverReceivedMap.delete(op.docId);
              this.serverActiveMap.set(op.docId, mergedItem);
            }
            this.recentlyConfirmed.set(op.docId, { item: mergedItem, deleted: false, ts: Date.now() });
          }

          remaining = remaining.filter((r) => r.opId !== op.opId);
          this.saveOutbox(remaining);
        } catch (err) {
          console.warn(`[PurchaseRequestsStore] Outbox op ${op.opId} (${op.type}) failed, will retry:`, err);
          this.scheduleRetry();
          break;
        }
      }

      if (remaining.length !== ops.length) {
        this.emit();
        this.notifyCrossTab();
      }
    } finally {
      this.isFlushing = false;
    }
  }

  public async createRequest(input: Omit<PurchaseRequest, 'id'>): Promise<{ item: PurchaseRequest; syncedToCloud: boolean }> {
    const path = this.getPath();
    const id = this.generateId();
    const nowIso = new Date().toISOString();

    const cleanItem: PurchaseRequest = sanitizeFirestorePayload({
      ...input,
      id,
      produto: (input.produto || '').trim().slice(0, 200),
      status: input.status || 'pendente',
      usuarioSolicitante: (input.usuarioSolicitante || 'Operação').trim(),
      dataSolicitacao: input.dataSolicitacao || nowIso.split('T')[0],
      urgente: Boolean(input.urgente),
      userId: input.userId || getBasePath(),
      createdAtIso: nowIso
    } as any);

    // 1. Write-ahead to outbox + local cache immediately
    const op: OutboxOp = {
      opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docId: id,
      type: 'upsert',
      data: cleanItem,
      createdAtMs: Date.now()
    };
    const outbox = this.loadOutbox();
    outbox.push(op);
    this.saveOutbox(outbox);
    this.cachedItemsMap.set(id, cleanItem);
    this.emit();
    this.notifyCrossTab();

    // 2. Immediately attempt cloud commit
    let syncedToCloud = false;
    try {
      await this.ensureAuthReady();
      const { id: _ignoreId, ...rest } = cleanItem as any;
      const firestorePayload = sanitizeFirestorePayload({
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, path, id), firestorePayload);

      // Remove from outbox only after confirmed cloud write
      this.saveOutbox(this.loadOutbox().filter((o) => o.opId !== op.opId));
      this.recentlyConfirmed.set(id, { item: cleanItem, deleted: false, ts: Date.now() });
      if (cleanItem.status === 'recebido') {
        this.serverReceivedMap.set(id, cleanItem);
      } else {
        this.serverActiveMap.set(id, cleanItem);
      }
      this.emit();
      this.notifyCrossTab();
      syncedToCloud = true;
    } catch (err) {
      console.error('[PurchaseRequestsStore] Cloud create failed, kept safely in Outbox for retry:', err);
      this.scheduleRetry();
    }

    return { item: cleanItem, syncedToCloud };
  }

  public async updateRequest(id: string, patch: Partial<PurchaseRequest>): Promise<{ syncedToCloud: boolean }> {
    const path = this.getPath();
    const cleanPatch = sanitizeFirestorePayload({
      ...patch,
      updatedAtIso: new Date().toISOString()
    } as any);

    const op: OutboxOp = {
      opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docId: id,
      type: 'patch',
      data: cleanPatch,
      createdAtMs: Date.now()
    };
    const outbox = this.loadOutbox();
    outbox.push(op);
    this.saveOutbox(outbox);

    const existing = this.cachedItemsMap.get(id) || this.serverActiveMap.get(id) || this.serverReceivedMap.get(id);
    const updatedItem = existing ? ({ ...existing, ...cleanPatch, id } as PurchaseRequest) : null;
    if (updatedItem) {
      this.cachedItemsMap.set(id, updatedItem);
    }
    this.emit();
    this.notifyCrossTab();

    let syncedToCloud = false;
    try {
      await this.ensureAuthReady();
      const { id: _ignoreId, ...rest } = (updatedItem || cleanPatch) as any;
      // Use setDoc with merge:true so even if a doc was still syncing it succeeds cleanly
      const firestorePayload = sanitizeFirestorePayload({
        ...(updatedItem ? rest : cleanPatch),
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, path, id), firestorePayload, { merge: true });

      this.saveOutbox(this.loadOutbox().filter((o) => o.opId !== op.opId));
      if (updatedItem) {
        this.recentlyConfirmed.set(id, { item: updatedItem, deleted: false, ts: Date.now() });
        if (updatedItem.status === 'recebido') {
          this.serverActiveMap.delete(id);
          this.serverReceivedMap.set(id, updatedItem);
        } else if (updatedItem.status === 'pendente' || updatedItem.status === 'comprado') {
          this.serverReceivedMap.delete(id);
          this.serverActiveMap.set(id, updatedItem);
        }
      }
      this.emit();
      this.notifyCrossTab();
      syncedToCloud = true;
    } catch (err) {
      console.error('[PurchaseRequestsStore] Cloud update failed, kept safely in Outbox for retry:', err);
      this.scheduleRetry();
    }

    return { syncedToCloud };
  }

  public async deleteRequest(id: string): Promise<void> {
    const path = this.getPath();

    const op: OutboxOp = {
      opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docId: id,
      type: 'delete',
      createdAtMs: Date.now()
    };
    const outbox = this.loadOutbox().filter((o) => o.docId !== id);
    outbox.push(op);
    this.saveOutbox(outbox);

    this.cachedItemsMap.delete(id);
    this.emit();
    this.notifyCrossTab();

    try {
      await this.ensureAuthReady();
      await deleteDoc(doc(db, path, id));
      this.saveOutbox(this.loadOutbox().filter((o) => o.opId !== op.opId));
      this.serverActiveMap.delete(id);
      this.serverReceivedMap.delete(id);
      this.recentlyConfirmed.set(id, { item: null, deleted: true, ts: Date.now() });
      this.emit();
      this.notifyCrossTab();
    } catch (err) {
      console.error('[PurchaseRequestsStore] Cloud delete failed, queued for retry:', err);
      this.scheduleRetry();
    }
  }
}

export const purchaseRequestsStore = new PurchaseRequestsStore();
