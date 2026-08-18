// Shared user profile persistence (localStorage + Supabase sync)

export interface StoredUser {
  id?: string;
  name: string;
  currentRole: string;
  years: string;
  skills: string;
  interests: string;
  target: string;
  type: "A" | "B" | null;
  createdAt: number;
  updatedAt: number;
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

// ─── Supabase Sync ───────────────────────────────────────────────

export async function syncUserToSupabase(user: StoredUser): Promise<string | null> {
  try {
    const res = await fetch("/api/db/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

export async function loadUserFromSupabase(name: string): Promise<StoredUser | null> {
  try {
    const res = await fetch(`/api/db/profile?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.profile) return null;

    const p = data.profile;
    return {
      id: p.id,
      name: p.name,
      currentRole: p.current_role || "",
      years: p.experience || "",
      skills: Array.isArray(p.skills) ? p.skills.join(", ") : "",
      interests: p.interests || "",
      target: p.target_role || "",
      type: (p.user_type as "A" | "B") || null,
      createdAt: new Date(p.created_at).getTime(),
      updatedAt: Date.now(),
    };
  } catch (err) {
    console.warn("[userStore] Supabase load error:", err);
    return null;
  }
}
