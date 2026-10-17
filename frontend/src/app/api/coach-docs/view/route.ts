import { NextResponse } from "next/server";
import { getAdminStorage, getAuthedUser } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/marketplaceFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 私有材料签名 URL：仅文件所属教练本人或管理员可取
export async function GET(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "缺少 path" }, { status: 400 });

  // 路径形如 coach-docs/{uid}/xxx 或 {uid}/xxx（兼容旧格式），取 uid 部分做归属校验
  const segments = path.split("/");
  const ownerId =
    segments[0] === "coach-docs" || segments[0] === "coach-avatars"
      ? segments[1]
      : segments[0];
  const admin = isAdminEmail(user.email);
  if (ownerId !== user.id && !admin) {
    return NextResponse.json({ error: "无权查看该材料" }, { status: 403 });
  }

  const storage = getAdminStorage();
  if (!storage) {
    return NextResponse.json({ error: "Firebase Storage not configured" }, { status: 500 });
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 600 * 1000, // 10 分钟
    });
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("[coach-docs] sign url failed:", err?.message || err);
    return NextResponse.json({ error: "材料不存在或已删除" }, { status: 404 });
  }
}
