import { generateDiagnosticReport } from "@/lib/glm";
import type { DiagnosticReport } from "@/lib/types";
import type { DiagnosticReportInput } from "@/lib/glm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReportRequestBody {
  userProfile: DiagnosticReportInput;
}

/** 从 Supabase Storage 下载简历文件并提取文本 */
async function fetchResumeContent(storagePath: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !storagePath) return null;

  const bucket = "resumes";
  const downloadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;

  try {
    const res = await fetch(downloadUrl, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!res.ok) {
      console.warn("[Resume] Download failed:", res.status);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = storagePath.split(".").pop()?.toLowerCase();

    // .txt: 直接读取
    if (ext === "txt" || contentType.startsWith("text/")) {
      return buffer.toString("utf-8");
    }

    // .pdf: 使用 unpdf（兼容 Node.js/Edge，无 DOM 依赖）
    if (ext === "pdf" || contentType.includes("pdf")) {
      try {
        const { extractText } = await import("unpdf");
        // unpdf 要求 Uint8Array，不是 Buffer
        const uint8 = new Uint8Array(buffer);
        const result = await extractText(uint8, { mergePages: true });
        const text = result.text || "";
        console.info("[Resume] PDF parsed, text length:", text.length);
        return text.slice(0, 3000) || null;
      } catch (err) {
        console.warn("[Resume] PDF parse failed:", err);
        return null;
      }
    }

    // .docx: 使用 mammoth
    if (ext === "docx" || contentType.includes("wordprocessingml")) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return result.value || null;
      } catch (err) {
        console.warn("[Resume] DOCX parse failed:", err);
        return `[Word简历，无法解析内容，文件名: ${storagePath}]`;
      }
    }

    // .doc (旧格式): 尝试读取为文本
    if (ext === "doc") {
      const text = buffer.toString("utf-8").replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r]/g, " ").replace(/\s+/g, " ").trim();
      return text.slice(0, 2000) || `[Word简历，文件名: ${storagePath}]`;
    }

    // 兜底
    return `[简历文件: ${storagePath}]`;
  } catch (err) {
    console.warn("[Resume] Fetch error:", err);
    return null;
  }
}

function validateUserProfile(profile: DiagnosticReportInput): string | null {
  if (!profile.name || profile.name.trim().length === 0) {
    return "userProfile.name is required";
  }
  if (!profile.currentRole || profile.currentRole.trim().length === 0) {
    return "userProfile.currentRole is required";
  }
  if (!Array.isArray(profile.skills)) {
    return "userProfile.skills must be an array";
  }
  if (profile.skills.length === 0) {
    return "userProfile.skills must not be empty";
  }
  if (!profile.experience || profile.experience.trim().length === 0) {
    return "userProfile.experience is required";
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  let body: ReportRequestBody;

  try {
    body = (await request.json()) as ReportRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.userProfile) {
    return Response.json(
      { error: "Missing 'userProfile' field" },
      { status: 400 }
    );
  }

  const {
    personality,
    coachNote,
    archetype,
    resumeStoragePath,
    exploreAnswers,
    archetypeScores,
    focusDirection,
    ...restProfile
  } = body.userProfile;

  // 从 Supabase Storage 获取简历内容
  let resumeContent: string | undefined;
  if (resumeStoragePath) {
    console.info("[Report] Fetching resume from storage:", resumeStoragePath);
    resumeContent = (await fetchResumeContent(resumeStoragePath)) || undefined;
    if (resumeContent) {
      console.info("[Report] Resume content extracted, length:", resumeContent.length);
      console.info("[Report] Resume preview (first 200 chars):", resumeContent.slice(0, 200));
    } else {
      console.warn("[Report] Resume content is empty after extraction");
    }
  }

  const enhancedProfile: DiagnosticReportInput = {
    ...restProfile,
    interests: (body.userProfile as any).interests,
    personality,
    coachNote,
    archetype,
    resumeStoragePath,
    resumeContent,
    exploreAnswers,
    archetypeScores,
    focusDirection,
  };

  const validationError = validateUserProfile(enhancedProfile);
  if (validationError) {
    return Response.json(
      { error: validationError },
      { status: 400 }
    );
  }

  try {
    const report: DiagnosticReport = await generateDiagnosticReport(
      enhancedProfile
    );

    return Response.json(report, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[API report] Error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}
