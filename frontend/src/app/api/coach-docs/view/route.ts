import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/authServer";
import { isAdminEmail } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 私有材料签名 URL：仅文件所属教练本人或管理员可取
export async function GET(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "缺少 path" }, { status: 400 });

  // 路径形如 {uid}/xxx，第一级目录即归属
  const ownerId = path.split("/")[0];
  const admin = isAdminEmail(user.email);
  if (ownerId !== user.id && !admin) {
    return NextResponse.json({ error: "无权查看该材料" }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await supabase.storage
    .from("coach-docs")
    .createSignedUrl(path, 600); // 10 分钟
  if (error || !data) {
    console.error("[coach-docs] sign url failed:", error?.message);
    return NextResponse.json({ error: "材料不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
