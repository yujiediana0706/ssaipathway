// Shared user profile persistence (localStorage + Supabase sync)
import { authHeaders } from "@/lib/supabase";

export interface StoredUser {
  id?: string;
  email?: string;
  name: string;
  currentRole: string;
  years: string;
  skills: string;
  interests: string;
  target: string;
  type: "A" | "B" | null;
  personality?: string;
  coachNote?: string;
  resumeFileName?: string;
  resumeStoragePath?: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

const STORAGE_KEY = "pathway:user";

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    if (!parsed.name || !parsed.currentRole) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeUser(user: StoredUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ─── Auth ↔ Local 合并 ───────────────────────────────────────────

interface AuthIdentity {
  id: string;
  email: string;
  name: string;
}

interface AuthProfileRow {
  id?: string;
  name?: string | null;
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

/**
 * 登录/注册成功后，把认证身份（id=auth.users.id）与数据库档案合并进本地 StoredUser。
 * 保留本地旅程里更丰富的字段（exploreDetail、简历路径等），只覆盖身份与档案字段。
 */
export function applyAuthSession(
  auth: AuthIdentity,
  profile: AuthProfileRow | null
): StoredUser {
  const now = Date.now();
  let existing: Partial<StoredUser> = {};
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) existing = JSON.parse(raw) as Partial<StoredUser>;
    }
  } catch {
    // ignore
  }

  const merged: StoredUser = {
    createdAt: existing.createdAt ?? now,
    ...existing,
    id: auth.id, // 强制以认证账号 id 为准，所有数据据此归属
    email: auth.email,
    name: profile?.name || existing.name || auth.name || "用户",
    currentRole: profile?.current_role || existing.currentRole || "",
    years: profile?.experience || existing.years || "",
    skills: Array.isArray(profile?.skills)
      ? profile!.skills!.join(", ")
      : existing.skills || "",
    interests: profile?.interests || existing.interests || "",
    target: profile?.target_role || existing.target || "",
    type: (profile?.user_type as "A" | "B") || existing.type || null,
    personality: profile?.personality || existing.personality,
    coachNote: profile?.coach_note || existing.coachNote,
    updatedAt: now,
  } as StoredUser;

  storeUser(merged);
  return merged;
}

// ─── Supabase Sync（请求带登录 token，服务端强制归属）────────────

export async function syncUserToSupabase(user: StoredUser): Promise<string | null> {
  try {
    const res = await fetch("/api/db/profile", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        action: "create",
        profile: {
          name: user.name,
          current_role: user.currentRole,
          target_role: user.target || null,
          experience: user.years,
          skills: user.skills ? user.skills.split(/[、,，\s]+/).filter(Boolean) : [],
          interests: user.interests || null,
          user_type: user.type,
          personality: user.personality || null,
          coach_note: user.coachNote || null,
        },
      }),
    });

    if (!res.ok) {
      console.warn("[userStore] Failed to sync user to Supabase:", res.status);
      return null;
    }

    const data = await res.json();
    if (data?.profile?.id) {
      const updatedUser = { ...user, id: data.profile.id };
      storeUser(updatedUser);
      return data.profile.id;
    }
    return null;
  } catch (err) {
    console.warn("[userStore] Supabase sync error:", err);
    return null;
  }
}

/** 加载当前登录用户的档案（不再按名字查询，按认证账号）。name 参数仅为兼容旧调用。 */
export async function loadUserFromSupabase(_name?: string): Promise<StoredUser | null> {
  try {
    const res = await fetch("/api/db/profile", {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const p: AuthProfileRow | null = data?.profile ?? null;
    if (!p || !p.id) return null;

    return {
      id: p.id,
      email: data?.user?.email || undefined,
      name: p.name || data?.user?.name || "",
      currentRole: p.current_role || "",
      years: p.experience || "",
      skills: Array.isArray(p.skills) ? p.skills.join(", ") : "",
      interests: p.interests || "",
      target: p.target_role || "",
      type: (p.user_type as "A" | "B") || null,
      personality: p.personality || undefined,
      coachNote: p.coach_note || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch (err) {
    console.warn("[userStore] Supabase load error:", err);
    return null;
  }
}
