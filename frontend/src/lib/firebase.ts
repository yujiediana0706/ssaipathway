// Firebase 客户端配置（浏览器端）
// 负责 Auth（邮箱注册/登录/会话）+ Firestore 客户端读取
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("[firebase] env not configured");
    return null;
  }
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const a = getFirebaseApp();
  if (!a) return null;
  auth = getAuth(a);
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  if (db) return db;
  const a = getFirebaseApp();
  if (!a) return null;
  db = getFirestore(a);
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (storage) return storage;
  const a = getFirebaseApp();
  if (!a) return null;
  storage = getStorage(a);
  return storage;
}

/**
 * 给需要鉴权的 /api/* 请求附加 Authorization: Bearer <idToken>。
 * 服务端用 Firebase Admin 校验该 token，并强制把数据归属到认证用户。
 */
export async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  try {
    const a = getFirebaseAuth();
    if (a?.currentUser) {
      const token = await a.currentUser.getIdToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // ignore：未登录时不带 token，服务端会返回 401
  }
  return headers;
}
