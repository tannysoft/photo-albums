// Firebase Admin SDK — server-only. Used for Firestore access and verifying
// the admin's ID token on protected API routes.
import "server-only";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key is stored with literal "\n"; convert back to real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Lazily initialize on first use so that `next build` (which imports route
// modules to read their config) doesn't require env vars to be present.
function lazy<T extends object>(factory: () => T): T {
  let instance: T | null = null;
  const get = () => (instance ??= factory());
  return new Proxy({} as T, {
    get(_t, prop) {
      const value = (get() as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(get()) : value;
    },
  });
}

export const adminDb: Firestore = lazy(() => getFirestore(getAdminApp()));
export const adminAuth: Auth = lazy(() => getAuth(getAdminApp()));

/**
 * Owner admins from the ADMIN_EMAILS env var. These are permanent admins that
 * cannot be removed from the dashboard (the bootstrap / lockout safeguard).
 */
export function ownerAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True if the email is an admin: an env owner, or listed in Firestore. */
export async function isAdminEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (ownerAdminEmails().includes(e)) return true;
  const doc = await adminDb.collection("admins").doc(e).get();
  return doc.exists;
}

export interface AdminUser {
  uid: string;
  email: string;
  isOwner: boolean;
}

/**
 * Verify the Bearer token from a request and confirm the user is an allowed
 * admin (env owner or Firestore-managed admin). Returns the user on success,
 * or null if unauthenticated/unauthorized.
 */
export async function verifyAdmin(req: Request): Promise<AdminUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    const email = decoded.email?.toLowerCase();
    if (!email) return null;
    const isOwner = ownerAdminEmails().includes(email);
    if (!isOwner && !(await isAdminEmail(email))) return null;
    return { uid: decoded.uid, email, isOwner };
  } catch {
    return null;
  }
}
