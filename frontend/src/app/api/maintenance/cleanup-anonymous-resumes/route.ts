import { NextResponse } from "next/server";
import { getAdminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "resumes/anonymous/";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const MAX_PAGES = 40; // 单次最多处理约 2 万个对象，避免函数超时

/**
 * 匿名简历 30 天清理任务。
 * 调用方式（由 Cloud Scheduler / cron 每天触发）：
 *   curl -X POST "https://<domain>/api/maintenance/cleanup-anonymous-resumes" \
 *        -H "x-cleanup-token: $CLEANUP_TOKEN"
 * 或 GET ?token=$CLEANUP_TOKEN
 */
async function handle(request: Request) {
  const expected = process.env.CLEANUP_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "CLEANUP_TOKEN not configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  const token = request.headers.get("x-cleanup-token") || url.searchParams.get("token") || "";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const storage = getAdminStorage();
  if (!storage) {
    return NextResponse.json({ error: "Firebase Storage not configured" }, { status: 503 });
  }

  const bucket = storage.bucket();
  const cutoff = Date.now() - MAX_AGE_MS;
  let pageToken: string | undefined;
  let scanned = 0;
  let deleted = 0;
  const failures: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const [files, nextQuery] = await bucket.getFiles({
      prefix: PREFIX,
      maxResults: PAGE_SIZE,
      pageToken,
    });
    scanned += files.length;

    for (const file of files) {
      const created = file.metadata?.timeCreated || file.metadata?.updated;
      const ts = created ? Date.parse(String(created)) : NaN;
      if (!Number.isFinite(ts) || ts > cutoff) continue;
      try {
        await file.delete({ ignoreNotFound: true });
        deleted += 1;
      } catch (err) {
        failures.push(file.name);
        console.warn("[cleanup] delete failed:", file.name, err);
      }
    }

    pageToken = nextQuery?.pageToken;
    if (!pageToken) break;
  }

  return NextResponse.json({
    ok: true,
    prefix: PREFIX,
    cutoff: new Date(cutoff).toISOString(),
    scanned,
    deleted,
    failures: failures.slice(0, 20),
  });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
