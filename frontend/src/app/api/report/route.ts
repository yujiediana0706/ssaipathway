import { generateDiagnosticReport } from "@/lib/glm";
import type { DiagnosticReport } from "@/lib/types";
import type { DiagnosticReportInput } from "@/lib/glm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReportRequestBody {
  userProfile: DiagnosticReportInput;
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

  const validationError = validateUserProfile(body.userProfile);
  if (validationError) {
    return Response.json(
      { error: validationError },
      { status: 400 }
    );
  }

  try {
    const report: DiagnosticReport = await generateDiagnosticReport(
      body.userProfile
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