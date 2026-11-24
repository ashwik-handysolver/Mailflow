import { supabase } from '../lib/supabase';

/**
 * Stores template attachment files. Signed in to Supabase, files go to the
 * private "attachments" Storage bucket under the user's own folder, so they
 * follow the account across browsers. Without Supabase they stay in this
 * browser's IndexedDB (localStorage can't hold files). Files saved to
 * IndexedDB before the switch are moved to Storage the first time they're read.
 */
const BUCKET = 'attachments';

/** The signed-in user's folder in the bucket, or null when not using Supabase. */
async function cloudFolder(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const DB_NAME = 'mailflow';
const STORE = 'attachments';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('File storage is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open file storage.'));
  });
  // Allow a retry later if opening failed (e.g. private browsing).
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error ?? new Error('File storage failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('File storage was interrupted (storage may be full).'));
      })
  );
}

/** Saves files under their ids (overwrites existing ids). */
/** Saves files under their ids (overwrites existing ids). */
export async function putFiles(entries: { id: string; file: File }[]): Promise<void> {
  if (entries.length === 0) return;
  const folder = await cloudFolder();
  if (folder) {
    const results = await Promise.all(
      entries.map((e) =>
        supabase!.storage.from(BUCKET).upload(`${folder}/${e.id}`, e.file, {
          upsert: true,
          contentType: e.file.type || 'application/octet-stream',
        })
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(`Couldn't upload the attachment: ${failed.error.message}`);
    return;
  }
  await localPut(entries);
}

/** Loads files by id; names and types come from the template's metadata. Missing ids are absent from the result. */
export async function getFiles(metas: { id: string; name: string; type: string }[]): Promise<Map<string, File>> {
  const out = new Map<string, File>();
  if (metas.length === 0) return out;
  const folder = await cloudFolder();
  if (!folder) return localGet(metas.map((m) => m.id));

  const missing: string[] = [];
  await Promise.all(
    metas.map(async (m) => {
      const { data, error } = await supabase!.storage.from(BUCKET).download(`${folder}/${m.id}`);
      if (error || !data) missing.push(m.id);
      else out.set(m.id, new File([data], m.name, { type: m.type || data.type }));
    })
  );
  // Files saved in this browser before the move to Storage: upload them now.
  if (missing.length > 0) {
    const legacy = await localGet(missing).catch(() => new Map<string, File>());
    if (legacy.size > 0) {
      const entries = [...legacy].map(([id, file]) => ({ id, file }));
      await putFiles(entries).catch(() => undefined);
      for (const [id, file] of legacy) out.set(id, file);
    }
  }
  return out;
}

export async function deleteFiles(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const folder = await cloudFolder();
  if (folder) {
    const { error } = await supabase!.storage.from(BUCKET).remove(ids.map((id) => `${folder}/${id}`));
    if (error) throw error;
  }
  await localDelete(ids).catch(() => undefined);
}

export async function clearFiles(): Promise<void> {
  const folder = await cloudFolder();
  if (folder) {
    const { data } = await supabase!.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (data && data.length > 0) {
      await supabase!.storage.from(BUCKET).remove(data.map((o) => `${folder}/${o.name}`));
    }
  }
  await run('readwrite', (store) => store.clear()).catch(() => undefined);
}

export function newAttachmentId(): string {
  return `file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ----- Browser (IndexedDB) storage -----

async function localPut(entries: { id: string; file: File }[]): Promise<void> {
  await run('readwrite', (store) => {
    for (const e of entries) store.put(e.file, e.id);
  });
}

async function localGet(ids: string[]): Promise<Map<string, File>> {
  const out = new Map<string, File>();
  if (ids.length === 0) return out;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result instanceof Blob) out.set(id, req.result as File);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not read stored files.'));
  });
  return out;
}

async function localDelete(ids: string[]): Promise<void> {
  await run('readwrite', (store) => {
    for (const id of ids) store.delete(id);
  });
}
