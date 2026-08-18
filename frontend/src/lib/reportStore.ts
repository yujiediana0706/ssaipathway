// Report data persistence (localStorage-based)

export interface SavedSkillItem {
  name: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface SavedPlanStep {
  phase: string;
  duration: string;
  title: string;
  details: string[];
}

export interface SavedReport {
  matchScore: number;
  skillsToAcquire: SavedSkillItem[];
  actionPlan: SavedPlanStep[];
  savedAt: number;
}

const REPORT_KEY = "pathway:report";

export function getStoredReport(): SavedReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedReport;
  } catch {
    return null;
  }
}

export function storeReport(report: SavedReport): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  } catch {
    // ignore
  }
}

export function clearStoredReport(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REPORT_KEY);
  } catch {
    // ignore
  }
}
