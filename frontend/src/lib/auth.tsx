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
  ) => Promise<{ needsConfirmation: boolean; error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
      if (!auth) return { needsConfirmation: false, error: "Firebase 未配置" };
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await updateProfile(cred.user, { displayName: name.trim() });
        // 注册后自动发送验证邮件
        try {
          await sendEmailVerification(cred.user);
        } catch (err) {
          console.warn("[auth] sendEmailVerification failed:", err);
        }
        // Firebase 注册即登录，但要求邮箱验证后才能继续使用 → 提示去邮箱
        return { needsConfirmation: true, error: null };
      } catch (err) {
        return { needsConfirmation: false, error: mapFirebaseAuthError(err) };
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
    // Firebase 只能给当前登录用户重发验证邮件（注册后用户处于登录态）
    const current = auth.currentUser;
    if (!current) return { error: "请先登录后再重发验证邮件" };
    if (email.trim() && current.email && current.email !== email.trim()) {
      return { error: "当前登录账号与该邮箱不一致" };
    }
    try {
      await sendEmailVerification(current);
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
