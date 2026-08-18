// Shared user profile persistence (localStorage-based, registration-like)

export interface StoredUser {
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
