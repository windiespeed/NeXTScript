import type { DocumentReference } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";

/**
 * Read-merge-write a document inside a Firestore transaction.
 *
 * A plain get() then set() lets two people saving the same document at the same
 * moment silently overwrite each other's changes. Inside a transaction, Firestore
 * retries the merge if the document changed between the read and the write, so
 * both edits land. Returns null if the document doesn't exist.
 */
export async function mergeDoc<T>(ref: DocumentReference, merge: (existing: T) => T): Promise<T | null> {
  return getDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const updated = merge(doc.data() as T);
    tx.set(ref, updated as FirebaseFirestore.DocumentData);
    return updated;
  });
}
