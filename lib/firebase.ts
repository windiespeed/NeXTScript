/**
 * Firebase Admin SDK initialization.
 * Used by server-side API routes to read/write Firestore.
 * The getApps() check prevents re-initialization during Next.js hot reloads.
 */

import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // .env.local stores the private key with literal \n — convert back to real newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}
