import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 旧的“单独提交认证材料”入口已下线：
// 材料随身份申请一起提交，身份只能由管理员审核动作授予。
export async function POST() {
  return NextResponse.json(
    {
      error: "认证申请已迁移到“身份申请”流程，请在成为教练页面选择 Peer / Coach 后提交",
      code: "E_GONE",
      use: "/api/roles/application",
    },
    { status: 410 },
  );
}
