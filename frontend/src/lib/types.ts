export interface UserProfile {
  id: string;
  name: string;
  currentRole: string;
  targetRole?: string;
  skills: string[];
  experience: string;
  interests?: string;
  personality?: string;
  coachNote?: string;
}

export interface DiagnosticReport {
  id: string;
  userId: string;
  createdAt: string;
  matchScore: number;
  currentAssessment: string;
  feasibility: string;
  feasibilityExplanation: string;
  skillsToAcquire: { name: string; priority: "high" | "medium" | "low"; description?: string }[];
  actionPlan: { phase: string; duration?: string; title?: string; steps?: string[]; details?: string[] }[];
  possiblePaths: { title: string; description: string; tags?: string[] }[];
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
  coachType?: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  category: "skill" | "task" | "milestone";
  dueDate?: string;
}
