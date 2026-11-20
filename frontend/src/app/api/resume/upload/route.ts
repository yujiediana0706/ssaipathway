import { NextResponse } from "next/server";
import { getAuthedUser, getAdminStorage } from "@/lib/firebaseAdmin";
import * as db from "@/lib/firestore";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** 从文件 buffer 里提取文本（PDF/DOCX/TXT/DOC） */
async function extractResumeText(buffer: Buffer, fileName: string, contentType: string): Promise<string | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  try {
    if (ext === "txt" || contentType.startsWith("text/")) {
      return buffer.toString("utf-8").slice(0, 8000) || null;
    }
    if (ext === "pdf" || contentType.includes("pdf")) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer), { mergePages: true });
      return result.text?.slice(0, 8000) || null;
    }
    if (ext === "docx" || contentType.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer });
      return r.value.slice(0, 8000) || null;
    }
    if (ext === "doc") {
      const text = buffer
        .toString("utf-8")
        .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text.slice(0, 8000) || null;
    }
    return null;
  } catch (err) {
    console.warn("[Resume] extract failed:", err);
    return null;
  }
}

const ANON_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  // 延迟注册：匿名用户也可上传（免费开放完整诊断链路），user 可为 null
  const user = await getAuthedUser(request);

  // 提前拦截非 multipart 请求：请求体无法解析时不要落到通用异常里变成 500
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    console.warn(
      `[Resume Upload] code=RESUME_UPLOAD_BAD_CONTENT_TYPE contentType=${contentType || "(empty)"}`
    );
    return NextResponse.json(
      { error: "上传请求格式不正确，请重新选择文件后重试", code: "RESUME_UPLOAD_BAD_CONTENT_TYPE" },
      { status: 400 }
    );
  }

  // 每小时每 IP 最多 20 次上传，避免匿名接口被刷存储
  const limited = await rateLimit(`resume:upload:${user?.id || clientIp(request)}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "上传过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const storage = getAdminStorage();
  if (!storage) {
    console.error("[Resume Upload] code=RESUME_UPLOAD_STORAGE_UNAVAILABLE reason=no_admin_storage");
    return NextResponse.json(
      { error: "文件存储暂不可用，请稍后重试", code: "RESUME_UPLOAD_STORAGE_UNAVAILABLE" },
      { status: 503 }
    );
  }

  let stage = "init";
  try {
    stage = "parse_form";
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const source = (formData.get("source") as string) || "upload"; // diagnosis / upload
    const makePrimary = formData.get("makePrimary") === "true";
    const anonId = (formData.get("anonId") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "没有收到文件，请重新选择简历后上传", code: "RESUME_UPLOAD_NO_FILE" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "文件不能超过 10MB", code: "RESUME_UPLOAD_TOO_LARGE" },
        { status: 400 }
      );
    }

    // 匿名上传：anonId 用于路径隔离（uuid 格式校验，防路径穿越）
    if (!user && !ANON_ID_RE.test(anonId)) {
      return NextResponse.json(
        { error: "上传会话已失效，请刷新页面后重试", code: "RESUME_UPLOAD_INVALID_ANON_ID" },
        { status: 400 }
      );
    }

    // 登录用户才检查简历数量上限（匿名不入库，无上限概念）
    stage = "load_existing";
    const existing = user ? await db.getResumesByUserId(user.id) : [];
    if (user && existing.length >= 3) {
      return NextResponse.json(
        { error: "最多只能上传 3 份简历，请先删除一份", code: "RESUME_UPLOAD_LIMIT_REACHED" },
        { status: 400 }
      );
    }

    // 按 user_id / anonId 隔离路径 + 安全文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const safeName = file.name.replace(/[^\w\u4e00-\u9fff.\-]+/g, "_");
    const path = user
      ? `resumes/${user.id}/${timestamp}_${random}_${safeName}`
      : `resumes/anonymous/${anonId}/${timestamp}_${random}_${safeName}`;

    // 上传到 Firebase Storage
    stage = "read_file";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    stage = "storage_save";
    const bucket = storage.bucket();
    const storageFile = bucket.file(path);
    try {
      await storageFile.save(buffer, {
        metadata: { contentType: file.type || "application/octet-stream" },
      });
    } catch (err) {
      console.error(
        "[Resume Upload] code=RESUME_UPLOAD_STORAGE_FAILED stage=storage_save",
        err
      );
      return NextResponse.json(
        { error: "文件保存失败，请稍后重试", code: "RESUME_UPLOAD_STORAGE_FAILED" },
        { status: 503 }
      );
    }

    // 解析文本
    stage = "extract_text";
    const extractedText = await extractResumeText(buffer, file.name, file.type || "");

    // 确定是否 primary：第一份自动 primary，或者显式 makePrimary=true
    const willBePrimary = makePrimary || existing.length === 0;

    // 存 DB（仅登录用户；匿名简历只落 Storage，注册后重新上传才入库）
    if (user) {
      stage = "db_save";
      try {
        const row = await db.createResume({
          user_id: user.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size || null,
          extracted_text: extractedText,
          source,
          is_primary: willBePrimary,
        });
        if (willBePrimary && existing.length > 0) {
          // 如果新上传的设为 primary，清除旧 primary
          await db.setPrimaryResume(user.id, row!.id!);
        }
      } catch (err: any) {
        // DB 写失败不阻止上传（文件已在 Storage）
        console.warn(
          "[Resume Upload] code=RESUME_UPLOAD_DB_SAVE_FAILED stage=db_save",
          err?.message || err
        );
      }
    }

    return NextResponse.json({
      path,
      name: file.name,
      extractedLength: extractedText?.length || 0,
      textPreview: extractedText ? extractedText.slice(0, 200) : null,
    });
  } catch (err) {
    console.error(`[Resume Upload] code=RESUME_UPLOAD_FAILED stage=${stage}`, err);
    return NextResponse.json(
      { error: "简历上传失败，请稍后重试", code: "RESUME_UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
