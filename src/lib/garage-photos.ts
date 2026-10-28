/**
 * Full-resolution garage photos, in IndexedDB.
 *
 * The garage itself lives in localStorage, and it has to keep living there:
 * it is read synchronously all over the app and it is small. What it cannot
 * hold is the photo at any real size. localStorage is about 5MB, the album
 * caps at 60 cars, and a 1080px JPEG is roughly 250KB once it is base64 -- so
 * a full-size copy per car is around 15MB, three times the entire budget.
 * That is why the album thumbnail is 360px at quality 0.55.
 *
 * IndexedDB has no such limit (the quota is a share of free disk, typically
 * gigabytes), so the big copy goes here, keyed by the same car id, and the
 * 360px thumbnail stays in localStorage for the grid. The grid keeps loading
 * synchronously from a tiny store; only opening one car pays for the big read.
 *
 * Everything here fails soft. Private browsing, a denied quota and a blocked
 * database all end the same way: no full-size photo, and the viewer shows the
 * thumbnail it already had. A photo is not worth an error message.
 */

const DB = "carz_garage_photos";
const STORE = "photos";
const VERSION = 1;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Store the big copy. Resolves false if it could not be kept; nothing breaks. */
export async function putFullPhoto(id: string, dataUrl: string): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      // Most likely a quota error, which is survivable: the thumbnail is saved
      // either way and the viewer falls back to it.
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/** The big copy, or null for a car saved before this existed. */
export async function getFullPhoto(id: string): Promise<string | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      req.onsuccess = () => {
        db.close();
        resolve(typeof req.result === "string" ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Called when a car leaves the album, so the big copy does not outlive it. */
export async function deleteFullPhoto(id: string): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
  } catch {
    /* ignore */
  }
}

/** Clearing the album clears these too. */
export async function clearFullPhotos(): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).clear();
  } catch {
    /* ignore */
  }
}
