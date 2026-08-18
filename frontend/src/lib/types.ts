export interface UserProfile {
  id: string;
  name: string;
  currentRole: string;
  targetRole?: string;
  skills: string[];
  experience: string;
}

export interface DiagnosticReport {
  id: string;
  userId: string;
  createdAt: string;
  matchScore: number;
  currentAssessment: string;
  feasibility: string;
  skillsToAcquire: { name: string; priority: "high" | "medium" | "low" }[];
  actionPlan: { phase: string; steps: string[] }[];
  possiblePaths: { title: string; description: string }[];
}

export interface SimulatorSession {
  id: string;
  userId: string;
  role: string;
  type: "day-in-life" | "interview";
  startedAt: string;
  completedAt?: string;
  score?: number;
  personalityTag?: string;
}

export interface CoachProfile {
  id: string;
  name: string;
  avatar: string;
  headline: string;
  industry: string;
  yearsExperience: number;
  ratePerHour: number;
  availableSlots: { day: string; time: string }[];
  rating: number;
  sessionsCount: number;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  category: "skill" | "task" | "milestone";
  dueDate?: string;
}
