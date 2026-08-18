// Report data persistence (localStorage + Supabase sync)

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
  id?: string;
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

// ─── Supabase Sync ───────────────────────────────────────────────

export async function syncReportToSupabase(
  report: SavedReport,
  userId: string
): Promise<string | null> {
  try {
    const res = await fetch("/api/db/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        report: {
          user_id: userId,
          match_score: report.matchScore,
          current_assessment: null,
          feasibility: null,
          skills_to_acquire: report.skillsToAcquire,
          action_plan: report.actionPlan,
          possible_paths: [],
        },
      }),
    });

    if (!res.ok) {
      console.warn("[reportStore] Failed to sync report to Supabase:", res.status);
      return null;
    }

    const data = await res.json();
    if (data?.report?.id) {
      const updatedReport = { ...report, id: data.report.id };
      storeReport(updatedReport);
      return data.report.id;
    }
    return null;
  } catch (err) {
    console.warn("[reportStore] Supabase sync error:", err);
    return null;
  }
}

export async function loadLatestReportFromSupabase(userId: string): Promise<SavedReport | null> {
  try {
    const res = await fetch("/api/db/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "latest",
        user_id: userId,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.report) return null;

    const r = data.report;
    return {
      id: r.id,
      matchScore: r.match_score,
      skillsToAcquire: Array.isArray(r.skills_to_acquire) ? r.skills_to_acquire : [],
      actionPlan: r.action_plan && Array.isArray(r.action_plan)
        ? Object.values(r.action_plan)
        : [],
      savedAt: new Date(r.created_at).getTime(),
    };
  } catch (err) {
    console.warn("[reportStore] Supabase load error:", err);
    return null;
  }
}

// ─── Tasks Sync ───────────────────────────────────────────────────

export interface SavedTask {
  id?: string;
  title: string;
  category: string;
  completed: boolean;
  priority?: string;
  order_index?: number;
}

export async function syncTasksToSupabase(
  tasks: SavedTask[],
  userId: string,
  reportId?: string | null
): Promise<void> {
  try {
    // First clear existing tasks for this user
    await fetch("/api/db/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clear-user",
        user_id: userId,
      }),
    });

    if (tasks.length === 0) return;

    // Then bulk insert
    const taskRows = tasks.map((t, idx) => ({
      user_id: userId,
      report_id: reportId || null,
      title: t.title,
      category: t.category,
      priority: t.priority || "medium",
      completed: t.completed,
      due_date: null,
      order_index: t.order_index ?? idx,
    }));

    await fetch("/api/db/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk-create",
        tasks: taskRows,
      }),
    });
  } catch (err) {
    console.warn("[reportStore] Tasks sync error:", err);
  }
}

export async function loadTasksFromSupabase(userId: string): Promise<SavedTask[]> {
  try {
    const res = await fetch(`/api/db/tasks?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.tasks) return [];

    return data.tasks.map((t: { id: string; title: string; category: string; completed: boolean; priority: string | null; order_index: number }) => ({
      id: t.id,
      title: t.title,
      category: t.category || "task",
      completed: t.completed,
      priority: t.priority || "medium",
      order_index: t.order_index,
    }));
  } catch (err) {
    console.warn("[reportStore] Tasks load error:", err);
    return [];
  }
}

export async function updateTaskInSupabase(
  taskId: string,
  updates: { completed?: boolean; title?: string }
): Promise<void> {
  try {
    await fetch("/api/db/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: taskId,
        updates,
      }),
    });
  } catch (err) {
    console.warn("[reportStore] Task update error:", err);
  }
}

export async function deleteTaskFromSupabase(taskId: string): Promise<void> {
  try {
    await fetch("/api/db/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        id: taskId,
      }),
    });
  } catch (err) {
    console.warn("[reportStore] Task delete error:", err);
  }
}
