import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

let _app: App | null = null;
let _db: Firestore | null = null;

function getAdminApp(): App | null {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId) {
    console.warn("[firebaseAdmin] projectId missing");
    return null;
  }

  try {
    if (clientEmail && privateKey) {
      _app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } else {
      // GCP 托管环境（Cloud Run / App Engine）可自动发现凭证
      _app = initializeApp({ projectId, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
    }
  } catch (err) {
    console.warn("[firebaseAdmin] init failed:", err);
    return null;
  }
  return _app;
}

export function getAdminDb(): Firestore | null {
  if (_db) return _db;
  const app = getAdminApp();
  if (!app) return null;
  _db = getFirestore(app);
  // 仅在显式要求时使用 REST（默认 gRPC；本地代理需设置小写 https_proxy 环境变量）
  if (process.env.FIRESTORE_PREFER_REST === "1") {
    _db.settings({ preferRest: true });
  }
  return _db;
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  if (!app) return null;
  return getAuth(app);
}

export function getAdminStorage(): Storage | null {
  const app = getAdminApp();
  if (!app) return null;
  return getStorage(app);
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

/**
 * 从请求的 Authorization: Bearer <idToken> 校验登录态，返回认证用户。
 * 用 Firebase Admin verifyIdToken 验证 JWT 合法性。
 */
export async function getAuthedUser(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const adminAuth = getAdminAuth();
  if (!adminAuth) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.uid) return null;
    const name =
      (decoded.name || "").trim() ||
      (decoded.email || "").split("@")[0] ||
      "用户";
    return {
      id: decoded.uid,
      email: decoded.email || "",
      name,
    };
  } catch (err) {
    console.warn("[firebaseAdmin] token verification failed:", err);
    return null;
  }
}
