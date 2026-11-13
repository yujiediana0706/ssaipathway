"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, authHeaders } from "@/lib/firebase";
import {
  applyAuthSession,
  clearStoredUser,
  type StoredUser,
} from "@/lib/userStore";

export interface AuthProfile {
  id: string;
  name: string;
  email?: string | null;
  current_role?: string | null;
  target_role?: string | null;
  experience?: string | null;
  skills?: string[] | null;
  interests?: string | null;
  user_type?: string | null;
  personality?: string | null;
  coach_note?: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  storedUser: StoredUser | null;
  loading: boolean; // 初始会话恢复中
  signUp: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ needsConfirmation: boolean; emailSent: boolean; error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 自建邮件验证的回跳地址：验证后统一跳到 /api/auth/verify-email
 * 注意：这个 URL 只在 Firebase Admin SDK 生成链接时需要（在服务端），
 * 前端这里不再使用 Firebase 内置 sendEmailVerification，
 * 验证邮件由 /api/auth/send-verification 服务端用 Resend 发送。
 * 保留这个函数只是为了兼容可能的未来扩展。
 */
function verificationSettings(): ActionCodeSettings {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    url: `${origin}/api/auth/verify-email?origin=${encodeURIComponent(origin)}`,
    handleCodeInApp: false,
  };
}

/** 调自建 API 发送验证邮件（用 Resend，送达率远高于 Firebase 内置） */
async function sendVerificationEmailViaApi(displayName: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      console.warn("[auth] sendVerificationEmailViaApi failed:", data?.error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[auth] sendVerificationEmailViaApi error:", err);
    return false;
  }
}

/** Firebase Auth 错误码 → 中文友好提示 */
function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code || "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "邮箱或密码不正确";
    case "auth/invalid-email":
      return "邮箱格式不正确";
    case "auth/email-already-in-use":
      return "这个邮箱已经注册过了，请直接登录";
    case "auth/weak-password":
      return "密码至少 6 位";
    case "auth/too-many-requests":
      return "尝试次数过多，请稍后再试";
    case "auth/user-disabled":
      return "账号已被禁用，请联系支持";
    case "auth/network-request-failed":
      return "网络异常，请检查网络后重试";
    default:
      return (err as Error | null)?.message || "操作失败，请稍后重试";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser: User) => {
    try {
      const res = await fetch("/api/db/profile", {
        headers: await authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const p = (data?.profile as AuthProfile) ?? null;

        // 如果 profile 里缺少关键字段（老用户数据在 localStorage 里），补写回数据库
        // 注册时只建 id/name/email 空壳，current_role/target_role/skills 等全是空
        const needsBackfill = !p?.current_role && (p?.email || p?.name);
        if (needsBackfill && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("pathway:user");
            if (raw) {
              const local = JSON.parse(raw) as any;
              if (local?.currentRole || local?.current_role) {
                const backfill: Record<string, unknown> = {
                  name: local.name || authUser.displayName || local?.name,
                  email: authUser.email || "",
                };
                if (local.currentRole) backfill.current_role = local.currentRole;
                if (local.years) backfill.experience = local.years;
                if (local.skills) backfill.skills = local.skills.split(/[、,，\s]+/).filter(Boolean);
                if (local.interests) backfill.interests = local.interests;
                if (local.target) backfill.target_role = local.target;
                if (local.type) backfill.user_type = local.type;
                if (local.personality) backfill.personality = local.personality;
                if (local.coachNote) backfill.coach_note = local.coachNote;

                await fetch("/api/db/profile", {
                  method: "POST",
                  headers: await authHeaders(),
                  body: JSON.stringify({ action: "update", updates: backfill }),
                });
              }
            }
          } catch {
            /* ignore — backfill 失败不阻塞 */
          }
        }

        const finalProfile = needsBackfill
          ? ({ ...p, ...(JSON.parse(localStorage.getItem("pathway:user") || "{}") as any) } as AuthProfile)
          : p;

        setProfile(finalProfile);
        const merged = applyAuthSession(
          { id: authUser.uid, email: authUser.email ?? "", name: authUser.displayName || "" },
          finalProfile
        );
        setStoredUser(merged);
        return finalProfile;
      }
    } catch (err) {
      console.warn("[auth] loadProfile failed:", err);
    }
    // 档案还没建，至少把登录身份落到本地
    const merged = applyAuthSession(
      { id: authUser.uid, email: authUser.email ?? "", name: authUser.displayName || "" },
      null
    );
    setStoredUser(merged);
    return null;
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    let active = true;

    // onAuthStateChanged 首次回调即完成初始会话恢复，之后持续监听登录态变化
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadProfile(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
        // 登出时不主动清 localStorage 的 pathway 数据，
        // 但要保证 AuthProvider 状态干净
        setStoredUser(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadProfile]);

  // mounted 后二次检查：如果 profile 有 email/name 但没 current_role
  // （注册时建的空壳），从 localStorage 补写
  useEffect(() => {
    if (loading || !user) return;
    if (profile?.current_role) return; // 已有数据，跳过
    // 如果有 email 或 name，说明已建空壳 → 触发 backfill
    if (profile?.email || profile?.name) {
      // 直接调用 loadProfile 重新跑（里面有 backfill 逻辑）
      loadProfile(user).catch(() => undefined);
    }
  }, [loading, user, profile, loadProfile]);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = getFirebaseAuth();
      if (!auth) return { needsConfirmation: false, emailSent: false, error: "Firebase 未配置" };
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await updateProfile(cred.user, { displayName: name.trim() });

        // 用自建 API 发验证邮件（Resend），替代 Firebase 内置（送达率太低）
        const emailSent = await sendVerificationEmailViaApi(name.trim());

        return { needsConfirmation: true, emailSent, error: null };
      } catch (err) {
        return { needsConfirmation: false, emailSent: false, error: mapFirebaseAuthError(err) };
      }
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) return { error: "Firebase 未配置" };
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { error: null };
    } catch (err) {
      return { error: mapFirebaseAuthError(err) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) await firebaseSignOut(auth);
    } catch { /* ignore */ }
    // 注意：这里**不清** localStorage 的 pathway 业务数据（pathway:user 等），
    // 这样下次登录时 login 跳转逻辑能读到老数据，知道用户不是新用户
    clearStoredUser();
    setUser(null);
    setProfile(null);
    setStoredUser(null);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) return { error: "Firebase 未配置" };
    const current = auth.currentUser;
    if (!current) return { error: "请先登录后再重发验证邮件" };
    if (email.trim() && current.email && current.email !== email.trim()) {
      return { error: "当前登录账号与该邮箱不一致" };
    }
    try {
      // 用自建 API 发（Resend），而非 Firebase 内置
      const ok = await sendVerificationEmailViaApi(
        current.displayName || current.email?.split("@")[0] || "用户"
      );
      if (!ok) return { error: "邮件发送失败，请稍后重试" };
      return { error: null };
    } catch (err) {
      return { error: mapFirebaseAuthError(err) };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) return { error: "Firebase 未配置" };
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { error: null };
    } catch (err) {
      return { error: mapFirebaseAuthError(err) };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        storedUser,
        loading,
        signUp,
        signIn,
        signOut,
        resendConfirmation,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 <AuthProvider> 内使用");
  return ctx;
}
