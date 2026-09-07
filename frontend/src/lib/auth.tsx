"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, authHeaders } from "@/lib/supabase";
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

        // 如果 profile 里缺少关键字段（老用户数据在 localStorage 里），补写回 Supabase
        // auth trigger 只建 id/name/email 空壳，current_role/target_role/skills 等全是空
        const needsBackfill = !p?.current_role && (p?.email || p?.name);
        if (needsBackfill && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("pathway:user");
            if (raw) {
              const local = JSON.parse(raw) as any;
              if (local?.currentRole || local?.current_role) {
                const backfill: Record<string, unknown> = {
                  name: local.name || authUser.user_metadata?.name || local?.name,
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
          { id: authUser.id, email: authUser.email ?? "", name: (authUser.user_metadata?.name as string) || "" },
          finalProfile
        );
        setStoredUser(merged);
        return finalProfile;
      }
    } catch (err) {
      console.warn("[auth] loadProfile failed:", err);
    }
    // 档案还没建（理论上 trigger 会建），至少把登录身份落到本地
    const merged = applyAuthSession(
      { id: authUser.id, email: authUser.email ?? "", name: (authUser.user_metadata?.name as string) || "" },
      null
    );
    setStoredUser(merged);
    return null;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    // 初始恢复会话
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session: Session | null) => {
      if (!active) return;
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        // 登出时不主动清 localStorage 的 pathway 数据，
        // 但要保证 AuthProvider 状态干净
        setStoredUser(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // mounted 后二次检查：如果 profile 有 email/name 但没 current_role
  // （auth trigger 建的空壳），从 localStorage 补写
  useEffect(() => {
    if (loading || !user) return;
    if (profile?.current_role) return; // 已有数据，跳过
    // 如果有 email 或 name，说明 trigger 已建空壳 → 触发 backfill
    if (profile?.email || profile?.name) {
      // 直接调用 loadProfile 重新跑（里面有 backfill 逻辑）
      loadProfile(user).catch(() => undefined);
    }
  }, [loading, user, profile, loadProfile]);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      if (!supabase) return { needsConfirmation: false, error: "Supabase 未配置" };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login?verified=1`
              : undefined,
        },
      });
      if (error) return { needsConfirmation: false, error: error.message };
      // 开启邮箱验证时 session 为 null，需要用户去邮箱点链接
      const needsConfirmation = !data.session;
      return { needsConfirmation, error: null };
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase 未配置" };
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      // 友好提示
      if (/invalid login credentials/i.test(error.message))
        return { error: "邮箱或密码不正确" };
      if (/email not confirmed/i.test(error.message))
        return { error: "邮箱还未验证，请先去邮箱点击验证链接" };
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (supabase) await supabase.auth.signOut({ scope: "global" });
    } catch { /* ignore */ }
    // 注意：这里**不清** localStorage 的 pathway 业务数据（pathway:user 等），
    // 这样下次登录时 login 跳转逻辑能读到老数据，知道用户不是新用户
    clearStoredUser();
    setUser(null);
    setProfile(null);
    setStoredUser(null);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    if (!supabase) return { error: "Supabase 未配置" };
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login?verified=1`
            : undefined,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
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
