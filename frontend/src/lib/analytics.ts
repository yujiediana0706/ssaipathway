// 埋点事件定义（前端 / 服务端共用）
// 字段命名对齐未来的 PostgreSQL 迁移：snake_case 列名

export const EVENTS = {
  pageView: "page_view",
  quizStart: "quiz_start",
  quizAnswer: "quiz_answer",
  quizComplete: "quiz_complete",
  chatMessage: "chat_message",
  resumeUploaded: "resume_uploaded",
  reportView: "report_view",
  coachView: "coach_view",
  bookingClick: "booking_click",
  wechatModalOpen: "wechat_modal_open",
  wechatAdded: "wechat_added",
  // 角色申请与审核
  roleApplicationStarted: "role_application_started",
  roleApplicationSubmitted: "role_application_submitted",
  roleApplicationWithdrawn: "role_application_withdrawn",
  roleApplicationReviewDecided: "role_application_review_decided",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// 与 userStore 中的匿名 ID 共用同一个 key，保证埋点与线索能串成一条链路
export const ANON_ID_KEY = "pathway:anon-id";

export const LEAD_STATUSES = ["new", "contacted", "won", "invalid"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  student_id: string;
  anon_id: string;
  name: string;
  email: string;
  contact: string;
  need_summary: string;
  source_channel: string;
  source_path: string;
  source_report_id: string;
  source_booking_id: string;
  coach_id: string;
  status: LeadStatus;
  status_history: { status: LeadStatus; at: string }[];
  created_at: string;
  updated_at: string;
}

export function dayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
