#!/usr/bin/env node
/**
 * 角色/徽章历史数据审计（只读优先）
 *
 * 用法（在 frontend 目录下，复用依赖与环境变量）：
 *   node --env-file=.env.production scripts/maintenance/audit-roles.mjs
 *   node --env-file=.env.production scripts/maintenance/audit-roles.mjs --apply-yujie-peer
 *
 * 默认只输出修复清单，不写任何数据。
 * --apply-yujie-peer 仅把 yujie_diana@outlook.com 修复为 peer（已确认）。
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const YUJIE_EMAIL = "yujie_diana@outlook.com";

function initApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error("缺少 FIREBASE_PROJECT_ID");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
  return getFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const applyYujie = process.argv.includes("--apply-yujie-peer");
  const db = initApp();
  const auth = getAuth();

  const [profilesSnap, usersSnap] = await Promise.all([
    db.collection("coach_profiles").get(),
    db.collection("users").get(),
  ]);

  const roles = new Map();
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    roles.set(d.id, {
      role: data.role ?? "none",
      role_status: data.role_status ?? "none",
    });
  });

  const issues = [];
  const byUser = new Map();

  for (const doc of profilesSnap.docs) {
    const p = doc.data();
    const uid = p.user_id;
    if (!uid) {
      issues.push({ type: "profile_without_user", coachProfileId: doc.id, name: p.display_name ?? null });
      continue;
    }
    if (byUser.has(uid)) {
      issues.push({
        type: "duplicate_coach_profiles",
        userId: uid,
        ids: [byUser.get(uid).id, doc.id],
        names: [byUser.get(uid).name, p.display_name ?? null],
      });
    } else {
      byUser.set(uid, { id: doc.id, name: p.display_name ?? null, tier: p.tier ?? "peer" });
    }

    const role = roles.get(uid)?.role ?? "none";
    const roleStatus = roles.get(uid)?.role_status ?? "none";
    const verified = p.verified === true || p.verification_status === "approved";
    const expectedRole = p.tier === "mentor" ? "coach" : "peer";

    if (verified && role === "none") {
      issues.push({
        type: "verified_without_role",
        userId: uid,
        coachProfileId: doc.id,
        name: p.display_name ?? null,
        tier: p.tier ?? "peer",
        expectedRole,
        action: `授予 ${expectedRole}（role=${expectedRole}, role_status=active）或撤销 verified`,
      });
    } else if (verified && role !== expectedRole && role !== "admin") {
      issues.push({
        type: "role_tier_mismatch",
        userId: uid,
        coachProfileId: doc.id,
        name: p.display_name ?? null,
        tier: p.tier ?? "peer",
        expectedRole,
        actualRole: role,
        roleStatus,
        action: `角色应为 ${expectedRole}`,
      });
    } else if (!verified && role !== "none" && role !== "admin") {
      issues.push({
        type: "role_without_verified",
        userId: uid,
        coachProfileId: doc.id,
        name: p.display_name ?? null,
        role,
        roleStatus,
        action: "身份已授予但档案未认证，需确认是否补齐 verified",
      });
    }

    if (p.tier === "mentor" && !(Array.isArray(p.verification_docs) && p.verification_docs.length > 0)) {
      issues.push({
        type: "coach_without_certificate",
        userId: uid,
        coachProfileId: doc.id,
        name: p.display_name ?? null,
        action: "Coach 需至少 1 份职业资格证书；如无则降级为 peer 或撤销认证",
      });
    }
  }

  // Yujie 专项
  let yujie = null;
  try {
    const authUser = await auth.getUserByEmail(YUJIE_EMAIL);
    const role = roles.get(authUser.uid) ?? { role: "none", role_status: "none" };
    const profile = byUser.get(authUser.uid) ?? null;
    yujie = {
      uid: authUser.uid,
      email: authUser.email,
      role: role.role,
      role_status: role.role_status,
      coachProfile: profile,
      plannedFix: { role: "peer", role_status: "active", tier: "peer", verified: true },
    };
  } catch (err) {
    yujie = { email: YUJIE_EMAIL, error: `Auth 中找不到该邮箱：${err.message}` };
  }

  console.log("=== 角色/徽章审计清单（只读）===");
  console.log(JSON.stringify({ generatedAt: nowIso(), profileCount: profilesSnap.size, userDocs: usersSnap.size, yujie, issues }, null, 2));
  console.log(`\n共发现 ${issues.length} 条待确认问题。`);

  if (!applyYujie) {
    console.log("\n未执行任何写入。确认清单后可加 --apply-yujie-peer 修复 Yujie。");
    return;
  }

  if (!yujie?.uid) {
    console.log("\n无法执行修复：找不到 Yujie 的 Auth 账号。");
    return;
  }

  const now = nowIso();
  await db.collection("users").doc(yujie.uid).set(
    {
      role: "peer",
      role_status: "active",
      role_updated_at: now,
      role_updated_by: "maintenance-script",
      role_updated_by_email: "system",
      suspend_reason: null,
    },
    { merge: true },
  );

  const profileSnap = await db.collection("coach_profiles").where("user_id", "==", yujie.uid).get();
  for (const doc of profileSnap.docs) {
    await doc.ref.set(
      {
        tier: "peer",
        verified: true,
        verification_status: "approved",
        verification_reason: null,
        reviewed_at: now,
        updated_at: now,
      },
      { merge: true },
    );
  }

  await db.collection("audit_logs").doc().set({
    actor_id: "maintenance-script",
    actor_email: "system",
    action: "historical_role_fixed",
    entity: "user_role",
    entity_id: yujie.uid,
    target_user_id: yujie.uid,
    target_email: YUJIE_EMAIL,
    from_status: `${yujie.role}/${yujie.role_status}`,
    to_status: "peer/active",
    reason: "修正历史数据：Yujie 被错误标记为 verified coach，按确认结果修复为 peer",
    meta: { coach_profiles_updated: profileSnap.size },
    at: now,
  });

  console.log(`\n✅ 已修复 Yujie（${YUJIE_EMAIL}）为 peer，更新 coach_profiles ${profileSnap.size} 条，并写入审计日志。`);
}

main().catch((err) => {
  console.error("审计脚本执行失败：", err);
  process.exit(1);
});
