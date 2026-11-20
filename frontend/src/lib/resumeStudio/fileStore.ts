/**
 * 原件的留存策略（Firebase Storage 未开通，不能依赖它）。
 *
 * 优先级：
 * 1. Firestore 文档内联 base64 —— 简历 docx 通常 20~300KB，单文档上限 1MiB，
 *    小文件直接落库，容器重建也不丢
 * 2. 配置了 RESUME_STUDIO_FILE_DIR 时写本地目录 —— 需要是持久卷，
 *    否则容器重建会丢（仅作为兜底，并在日志里标注）
 * 3. 都不可用时只记录元信息（文件名、大小、sha256）+ 文本快照，
 *    保证重试与排查仍然可用
 *
 * 解析快照（结构化 JSON + 原文）始终随任务文档落库，不依赖文件存储。
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminDb } from "@/lib/firebaseAdmin";

const FILES_COLLECTION = "resume_studio_files";
/** base64 膨胀 4/3，留出余量保证整篇文档 < 1MiB */
const MAX_INLINE_BYTES = 500 * 1024;

export interface StoredOriginal {
  /** firestore | local | none */
  store: "firestore" | "local" | "none";
  /** Firestore 文档 id 或本地文件路径 */
  ref: string | null;
  sha256: string;
  bytes: number;
}

export async function persistOriginal(
  userId: string,
  jobId: string,
  buffer: Buffer,
  fileName: string
): Promise<StoredOriginal> {
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const base: StoredOriginal = { store: "none", ref: null, sha256, bytes: buffer.length };

  const db = getAdminDb();
  if (db && buffer.length <= MAX_INLINE_BYTES) {
    try {
      await db
        .collection(FILES_COLLECTION)
        .doc(jobId)
        .set({
          user_id: userId,
          job_id: jobId,
          file_name: fileName,
          content_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: buffer.length,
          sha256,
          encoding: "base64",
          data: buffer.toString("base64"),
          created_at: new Date().toISOString(),
        });
      return { ...base, store: "firestore", ref: jobId };
    } catch (err) {
      console.warn("[resume-studio] persist original to firestore failed:", err);
    }
  }

  const dir = process.env.RESUME_STUDIO_FILE_DIR;
  if (dir) {
    try {
      await mkdir(dir, { recursive: true });
      const target = path.join(dir, `${jobId}.docx`);
      await writeFile(target, buffer);
      console.warn(
        `[resume-studio] original stored on local disk (${target}); make sure this directory is a persistent volume.`
      );
      return { ...base, store: "local", ref: target };
    } catch (err) {
      console.warn("[resume-studio] persist original to local dir failed:", err);
    }
  }

  // 原件太大或存储不可用：保留可排查的元信息即可
  console.warn(
    `[resume-studio] original not persisted (${buffer.length} bytes, firestore=${Boolean(db)}, dir=${Boolean(dir)}); metadata only.`
  );
  return base;
}
