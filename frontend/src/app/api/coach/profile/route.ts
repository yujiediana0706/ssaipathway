import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";
import { runCoachAIReview } from "@/lib/coachVerificationAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 当前登录用户自己的教练资料（含私密字段）
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const coach = await mp.getCoachByUserId(user.id);
  return NextResponse.json({ coach });
}

export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await request.json();
    const educationDocs: mp.CoachDoc[] = Array.isArray(body.education_docs) ? body.education_docs : [];
    const workDocs: mp.CoachDoc[] = Array.isArray(body.work_docs) ? body.work_docs : [];

    // 硬性材料：各至少 1 份，且路径必须属于本人
    // 上传接口的路径是 coach-docs/{uid}/xxx 或 coach-avatars/{uid}/xxx
    const owned = (d: mp.CoachDoc) => {
      if (typeof d.path !== "string") return false;
      const segments = d.path.split("/");
      // 预期结构：[prefix, uid, filename]
      return segments.length >= 2 && segments[1] === user.id;
    };
    if (!educationDocs.some(owned)) {
      return NextResponse.json({ error: "请上传至少 1 份学历证明" }, { status: 400 });
    }
    if (!workDocs.some(owned)) {
      return NextResponse.json({ error: "请上传至少 1 份工作证明" }, { status: 400 });
    }

    const displayName = String(body.display_name ?? "").trim();
    if (!displayName) return NextResponse.json({ error: "请填写教练昵称" }, { status: 400 });

    const priceSingle = body.price_single === null || body.price_single === "" || body.price_single === undefined
      ? null : Number(body.price_single);
    const pricePackage = body.price_package_5 === null || body.price_package_5 === "" || body.price_package_5 === undefined
      ? null : Number(body.price_package_5);
    if (priceSingle == null && pricePackage == null) {
      return NextResponse.json({ error: "单次价和 5 次套餐价至少填写一项" }, { status: 400 });
    }
    if ((priceSingle != null && (!Number.isFinite(priceSingle) || priceSingle < 0)) ||
        (pricePackage != null && (!Number.isFinite(pricePackage) || pricePackage < 0))) {
      return NextResponse.json({ error: "价格必须是非负数字" }, { status: 400 });
    }

    const sessionDurationMin = body.session_duration_min === 30 ? 30 : 60;

    if (body.meeting_link) {
      try {
        const u = new URL(String(body.meeting_link));
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        return NextResponse.json({ error: "会议链接需为合法的 http(s) 网址" }, { status: 400 });
      }
    }

    const strArr = (v: unknown): string[] =>
      Array.isArray(v) ? [...new Set((v as unknown[]).map((x) => String(x).trim()).filter(Boolean))] : [];

    const tier = body.tier === 'mentor' ? 'mentor' : 'peer';
    const verificationDocs: mp.CoachDoc[] = Array.isArray(body.verification_docs) ? body.verification_docs : [];
    // mentor 硬性要求：至少 1 份职业资格证书（coach 认证等），且路径属于本人
    if (tier === 'mentor' && !verificationDocs.some(owned)) {
      return NextResponse.json({ error: "申请 Coach 需上传至少 1 份职业资格证书（如 ICF/ACC/PCC、GCDF 等）" }, { status: 400 });
    }

    const coach = await mp.upsertCoachProfile(user.id, {
      display_name: displayName,
      avatar_url: body.avatar_url ?? null,
      headline: String(body.headline ?? "").trim() || null,
      bio: String(body.bio ?? "").trim() || null,
      companies: strArr(body.companies),
      schools: strArr(body.schools),
      topic_tags: strArr(body.topic_tags),
      price_single: priceSingle,
      price_package_5: pricePackage,
      session_duration_min: sessionDurationMin,
      meeting_link: String(body.meeting_link ?? "").trim() || null,
      education_docs: educationDocs,
      work_docs: workDocs,
      other_docs: Array.isArray(body.other_docs) ? body.other_docs : [],
      verification_docs: verificationDocs,
      tier,
    });

    // 待审核的档案立即跑一次 AI 初审，管理员打开后台即可看到结论
    if (coach.verification_status === "pending") {
      try {
        const review = await runCoachAIReview(coach);
        await mp.saveCoachAIReview(coach.id, review);
        coach.ai_review = review;
      } catch (e) {
        console.warn("[api/coach/profile] AI review failed:", e);
      }
    }

    return NextResponse.json({ coach, id: coach.id });
  } catch (err) {
    console.error("[api/coach/profile] POST error:", err);
    return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}
