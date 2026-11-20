/** 路由层共用的小工具：功能开关守卫、统一错误结构、请求体解析 */
import { NextResponse } from "next/server";
import { getResumeStudioMode } from "./feature";

export interface ApiProblem {
  code: string;
  message: string;
  retryable: boolean;
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  retryable = false,
  extra: Record<string, unknown> = {}
): Response {
  return NextResponse.json(
    { error: { code, message, retryable } as ApiProblem, ...extra },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * 能力守卫：
 * - off：所有接口关闭，前端引导回旧路径
 * - manual：只保留导出，上传与模型调用关闭
 */
export function guardStudio(capability: "upload" | "ai" | "export"): Response | null {
  const mode = getResumeStudioMode();
  if (mode === "off") {
    return jsonError(
      503,
      "FEATURE_DISABLED",
      "Resume Studio is temporarily unavailable. Please use the classic resume optimizer.",
      false,
      { fallback: "/resume-optimize" }
    );
  }
  if (mode === "manual" && capability !== "export") {
    return jsonError(
      409,
      "UPLOAD_DISABLED",
      "Upload and AI features are turned off right now. You can fill in the resume form manually.",
      false
    );
  }
  return null;
}

export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function noStoreJson(data: unknown, status = 200): Response {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
