#!/usr/bin/env node
/**
 * 角色申请/审核 端到端测试（对已部署环境执行，结束后清理测试数据）
 *
 * 运行：
 *   cd frontend
 *   BOOTSTRAP_TEST_EMAIL=e2e-bootstrap@pathway.test \
 *   node --env-file=.env.production scripts/maintenance/e2e-roles.mjs
 *
 * 前置：服务器 BOOTSTRAP_ADMIN_EMAILS 临时包含 BOOTSTRAP_TEST_EMAIL，用于验证首个管理员引导。
 * 说明：
 * - 测试账号通过 Identity Toolkit 邮箱注册获得 idToken（不触碰现有用户密码）；
 * - 测试产生的申请/档案/管理员记录/审计日志会在最后清理；
 * - 白名单状态恢复到测试前。
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const BASE = process.env.BASE_URL || "https://yourpathwayai.com";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;
const PASSWORD = "E2ePass-12345678!";
const BOOTSTRAP_TEST_EMAIL = process.env.BOOTSTRAP_TEST_EMAIL || "e2e-bootstrap@pathway.test";
const E2E = ["e2e-peer@pathway.test", "e2e-coach@pathway.test", "e2e-withdraw@pathway.test", BOOTSTRAP_TEST_EMAIL];
const ADMIN = BOOTSTRAP_TEST_EMAIL;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function init() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
  return { db: getFirestore(), auth: getAuth() };
}

async function identity(path, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function signUpOrIn(auth, email) {
  let uid;
  try {
    const u = await auth.getUserByEmail(email);
    uid = u.uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    const u = await auth.createUser({ email, password: PASSWORD, emailVerified: true });
    uid = u.uid;
  }
  const res = await identity("signInWithPassword", { email, password: PASSWORD, returnSecureToken: true });
  if (res.status !== 200) throw new Error(`登录失败：${JSON.stringify(res.body)}`);
  return { uid, token: res.body.idToken };
}

async function deleteAccount(auth, uid) {
  if (!uid) return;
  try { await auth.deleteUser(uid); } catch { /* ignore */ }
}

async function api(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

function materials(uid, role) {
  const doc = (name) => ({ path: `coach-docs/${uid}/${name}.pdf`, name, uploaded_at: new Date().toISOString() });
  return {
    education_docs: [doc("edu")],
    work_docs: [doc("work")],
    other_docs: [],
    verification_docs: role === "coach" ? [doc("cert")] : [],
  };
}

function profile(name) {
  return {
    display_name: name,
    headline: "E2E 测试账号",
    bio: "自动化测试创建，请忽略。",
    companies: ["Test Co"],
    schools: ["Test University"],
    topic_tags: ["测试"],
    focus_areas: ["职业咨询"],
    price_single: 199,
    price_package_5: 799,
    session_duration_min: 60,
    meeting_link: null,
  };
}

async function main() {
  const { db, auth } = init();

  const bootstrapRef = db.collection("system").doc("admin_bootstrap");
  const bootstrapSnap = await bootstrapRef.get();
  const bootstrapBefore = bootstrapSnap.exists ? bootstrapSnap.data() : null;
  const adminsSnap = await db.collection("admins").get();
  const adminsBefore = adminsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const accounts = {};
  for (const email of E2E) accounts[email] = await signUpOrIn(auth, email);
  const uids = Object.fromEntries(Object.entries(accounts).map(([e, a]) => [e, a.uid]));
  const tokens = Object.fromEntries(Object.entries(accounts).map(([e, a]) => [e, a.token]));

  try {
    // ── 0. 首个管理员引导 ──
    for (const d of adminsSnap.docs) await d.ref.delete();
    await bootstrapRef.set({ active: true }, { merge: true });
    const meAfterBootstrap = await api("/api/me", tokens[ADMIN]);
    const adminDoc = await db.collection("admins").doc(ADMIN).get();
    record(
      "首个管理员引导：白名单邮箱登录后自动成为管理员",
      meAfterBootstrap.status === 200 && meAfterBootstrap.json?.isAdmin === true && adminDoc.exists,
      `isAdmin=${meAfterBootstrap.json?.isAdmin}, adminsDoc=${adminDoc.exists}`,
    );
    const bootAudit = await db.collection("audit_logs").where("action", "==", "admin_bootstrap_claimed").limit(5).get();
    record("首个管理员引导写入审计日志", !bootAudit.empty, `entries=${bootAudit.size}`);

    // ── 1. 授予合伙人；白名单失效 ──
    const grant = await api("/api/admin/admins", tokens[ADMIN], {
      method: "POST",
      body: { action: "grant", email: E2E[2], reason: "E2E 测试管理员", confirm: true },
    });
    const bootAfterGrant = await bootstrapRef.get();
    record(
      "授予管理员成功且白名单自动失效",
      grant.status === 200 && bootAfterGrant.data()?.active === false,
      `status=${grant.status}, bootstrapActive=${bootAfterGrant.data()?.active}`,
    );

    const grantNoConfirm = await api("/api/admin/admins", tokens[ADMIN], {
      method: "POST",
      body: { action: "grant", email: "nobody@example.com", reason: "x", confirm: false },
    });
    record(
      "授予管理员缺少二次确认被拒",
      grantNoConfirm.status === 400 && grantNoConfirm.json?.code === "E_CONFIRM_REQUIRED",
      `status=${grantNoConfirm.status}, code=${grantNoConfirm.json?.code}`,
    );

    // ── 2. 越权字段 ──
    const forbidden = await api("/api/roles/application", tokens[E2E[0]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("越权"), materials: materials(uids[E2E[0]], "peer"), submit: true, verified: true },
    });
    record(
      "申请接口拒绝客户端自授字段（verified）",
      forbidden.status === 400 && forbidden.json?.code === "E_FORBIDDEN_FIELD",
      `status=${forbidden.status}, code=${forbidden.json?.code}`,
    );
    const forbiddenAudit = await db.collection("audit_logs").where("action", "==", "security_forbidden_field").limit(1).get();
    record("越权字段尝试写入审计日志", !forbiddenAudit.empty);

    // ── 3. peer 申请 → 重复提交 → 审核通过 ──
    const peerUid = uids[E2E[0]];
    const peerSubmit = await api("/api/roles/application", tokens[E2E[0]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Peer"), materials: materials(peerUid, "peer"), submit: true },
    });
    record(
      "peer 申请提交成功",
      peerSubmit.status === 200 && peerSubmit.json?.application?.status === "submitted",
      `status=${peerSubmit.status}, app=${peerSubmit.json?.application?.status}`,
    );

    const peerDup = await api("/api/roles/application", tokens[E2E[0]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Peer"), materials: materials(peerUid, "peer"), submit: true },
    });
    record(
      "重复提交被拒（已有申请在审）",
      peerDup.status === 409 && peerDup.json?.code === "E_APPLICATION_EXISTS",
      `status=${peerDup.status}, code=${peerDup.json?.code}`,
    );

    const nonAdmin = await api("/api/admin/role-applications", tokens[E2E[0]]);
    record("非管理员调用审核列表被拒", nonAdmin.status === 403 && nonAdmin.json?.code === "E_NOT_ADMIN", `status=${nonAdmin.status}`);
    const nonAdminDecide = await api("/api/admin/role-applications", tokens[E2E[0]], {
      method: "POST",
      body: { applicationId: peerSubmit.json?.application?.id, action: "approve", reason: "越权" },
    });
    record("非管理员调用审核动作被拒", nonAdminDecide.status === 403, `status=${nonAdminDecide.status}`);

    const pending1 = await api("/api/admin/role-applications?status=pending", tokens[ADMIN]);
    const peerApp = (pending1.json?.applications ?? []).find((a) => a.user_id === peerUid);
    const peerApprove = await api("/api/admin/role-applications", tokens[ADMIN], {
      method: "POST",
      body: { applicationId: peerApp?.id, action: "approve", reason: "材料齐全，审核通过" },
    });
    const peerMe = await api("/api/me", tokens[E2E[0]]);
    record(
      "peer 审核通过后身份生效且不被算成 coach",
      peerApprove.status === 200 && peerMe.json?.isPeer === true && peerMe.json?.isCoach === false,
      `approve=${peerApprove.status}, isPeer=${peerMe.json?.isPeer}, isCoach=${peerMe.json?.isCoach}`,
    );

    const peerAgain = await api("/api/roles/application", tokens[E2E[0]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Peer"), materials: materials(peerUid, "peer"), submit: true },
    });
    record(
      "已有身份时再次申请被拒",
      peerAgain.status === 409 && peerAgain.json?.code === "E_ROLE_EXISTS",
      `status=${peerAgain.status}, code=${peerAgain.json?.code}`,
    );

    // ── 4. 封禁 / 恢复 ──
    const suspend = await api("/api/admin/role-applications", tokens[ADMIN], {
      method: "POST",
      body: { applicationId: peerApp?.id, action: "suspend", reason: "E2E 测试封禁" },
    });
    const peerSuspended = await api("/api/me", tokens[E2E[0]]);
    const restore = await api("/api/admin/role-applications", tokens[ADMIN], {
      method: "POST",
      body: { applicationId: peerApp?.id, action: "restore", reason: "E2E 测试恢复" },
    });
    const peerRestored = await api("/api/me", tokens[E2E[0]]);
    record(
      "封禁后身份暂停，恢复后重新生效",
      suspend.status === 200 &&
        peerSuspended.json?.roleStatus === "suspended" &&
        peerSuspended.json?.isPeer === false &&
        restore.status === 200 &&
        peerRestored.json?.roleStatus === "active",
      `suspend=${suspend.status}, status=${peerSuspended.json?.roleStatus}, restore=${restore.status}`,
    );

    // ── 5. coach 申请 → 切换被拒 → 驳回 → 学员可见原因 → 重提 ──
    const coachUid = uids[E2E[1]];
    const coachSubmit = await api("/api/roles/application", tokens[E2E[1]], {
      method: "POST",
      body: { requested_role: "coach", profile: profile("E2E Coach"), materials: materials(coachUid, "coach"), submit: true },
    });
    record("coach 申请提交成功", coachSubmit.status === 200, `status=${coachSubmit.status}`);

    const switchTry = await api("/api/roles/application", tokens[E2E[1]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Coach"), materials: materials(coachUid, "peer"), submit: true },
    });
    record(
      "审核中切换身份被拒（须先撤回）",
      switchTry.status === 409 && switchTry.json?.code === "E_APPLICATION_EXISTS",
      `status=${switchTry.status}, code=${switchTry.json?.code}`,
    );

    const pendingCoach = await api("/api/admin/role-applications?status=pending", tokens[ADMIN]);
    const coachApp = (pendingCoach.json?.applications ?? []).find((a) => a.user_id === coachUid);
    const rejectReason = "证书扫描件不清晰，请重新上传 ICF 证书";
    const coachReject = await api("/api/admin/role-applications", tokens[ADMIN], {
      method: "POST",
      body: { applicationId: coachApp?.id, action: "reject", reason: rejectReason },
    });
    const coachState = await api("/api/roles/application", tokens[E2E[1]]);
    record(
      "coach 驳回成功且学员可见驳回原因",
      coachReject.status === 200 &&
        coachState.json?.application?.status === "rejected" &&
        coachState.json?.application?.reason === rejectReason,
      `reject=${coachReject.status}, state=${coachState.json?.application?.status}`,
    );

    const coachResubmit = await api("/api/roles/application", tokens[E2E[1]], {
      method: "POST",
      body: { requested_role: "coach", profile: profile("E2E Coach"), materials: materials(coachUid, "coach"), submit: true },
    });
    record(
      "驳回后重新提交成功（无需冷却）",
      coachResubmit.status === 200 && coachResubmit.json?.application?.status === "submitted",
      `status=${coachResubmit.status}`,
    );

    // ── 6. 撤回 + 7 天冷却 ──
    const wUid = uids[E2E[2]];
    const wSubmit = await api("/api/roles/application", tokens[E2E[2]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Withdraw"), materials: materials(wUid, "peer"), submit: true },
    });
    const wWithdraw = await api("/api/roles/application", tokens[E2E[2]], {
      method: "PATCH",
      body: { action: "withdraw", reason: "E2E 测试撤回" },
    });
    const wRetry = await api("/api/roles/application", tokens[E2E[2]], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Withdraw"), materials: materials(wUid, "peer"), submit: true },
    });
    const cooldownDays = wWithdraw.json?.application?.cooldown_until
      ? Math.round((new Date(wWithdraw.json.application.cooldown_until).getTime() - Date.now()) / 86400000)
      : null;
    record(
      "撤回成功并进入 7 天冷却，冷却期内重提被拒",
      wSubmit.status === 200 &&
        wWithdraw.status === 200 &&
        wWithdraw.json?.application?.status === "withdrawn" &&
        cooldownDays >= 6 &&
        wRetry.status === 429 &&
        wRetry.json?.code === "E_COOLDOWN",
      `withdraw=${wWithdraw.status}, cooldownDays=${cooldownDays}, retry=${wRetry.status}`,
    );

    // ── 7. 管理员自审拦截 ──
    const adminUid = uids[ADMIN];
    const adminSubmit = await api("/api/roles/application", tokens[ADMIN], {
      method: "POST",
      body: { requested_role: "peer", profile: profile("E2E Admin"), materials: materials(adminUid, "peer"), submit: true },
    });
    const selfReview = await api("/api/admin/role-applications", tokens[ADMIN], {
      method: "POST",
      body: { applicationId: adminSubmit.json?.application?.id, action: "approve", reason: "自审测试" },
    });
    record(
      "管理员不能审核自己的申请（服务端拦截）",
      selfReview.status === 403 && selfReview.json?.code === "E_SELF_REVIEW",
      `status=${selfReview.status}, code=${selfReview.json?.code}`,
    );

    // ── 8. 审计日志完整性 ──
    const actions = [
      "role_application_submitted",
      "role_application_approved",
      "role_application_rejected",
      "role_application_withdrawn",
      "admin_granted",
      "user_role_suspended",
      "user_role_restored",
    ];
    const auditSnap = await db.collection("audit_logs").get();
    const seen = new Set(auditSnap.docs.map((d) => d.data().action));
    const missing = actions.filter((a) => !seen.has(a));
    record("关键审核动作均写入审计日志", missing.length === 0, missing.length ? `missing=${missing.join(",")}` : "all present");

    // ── 9. 撤销管理员 / 最后管理员保护 / 自授拦截 ──
    const revokeTestAdmin = await api("/api/admin/admins", tokens[ADMIN], {
      method: "POST",
      body: { action: "revoke", email: E2E[2], reason: "E2E 测试结束，撤销测试管理员", confirm: true },
    });
    record("撤销管理员成功", revokeTestAdmin.status === 200, `status=${revokeTestAdmin.status}`);

    const revokeLast = await api("/api/admin/admins", tokens[ADMIN], {
      method: "POST",
      body: { action: "revoke", email: ADMIN, reason: "E2E 测试最后管理员保护", confirm: true },
    });
    record(
      "不能撤销最后一个管理员",
      revokeLast.status === 409 && revokeLast.json?.code === "E_LAST_ADMIN",
      `status=${revokeLast.status}, code=${revokeLast.json?.code}`,
    );

    const selfGrant = await api("/api/admin/admins", tokens[ADMIN], {
      method: "POST",
      body: { action: "grant", email: ADMIN, reason: "自授测试", confirm: true },
    });
    record(
      "不能给自己授予管理员",
      selfGrant.status === 403 && selfGrant.json?.code === "E_SELF_GRANT",
      `status=${selfGrant.status}, code=${selfGrant.json?.code}`,
    );
  } finally {
    // ── 清理 ──
    for (const uid of Object.values(uids)) {
      for (const coll of ["role_applications", "coach_profiles"]) {
        const snap = await db.collection(coll).where("user_id", "==", uid).get();
        for (const d of snap.docs) await d.ref.delete();
      }
      await db.collection("users").doc(uid).delete();
    }
    for (const email of E2E) {
      await db.collection("admins").doc(email).delete();
    }
    const auditAll = await db.collection("audit_logs").get();
    for (const d of auditAll.docs) {
      const row = d.data();
      if (E2E.includes(row.actor_email) || E2E.includes(row.target_email)) await d.ref.delete();
    }
    // 恢复管理员快照与白名单状态
    if (bootstrapBefore === null) await bootstrapRef.set({ active: true }, { merge: true });
    else await bootstrapRef.set({ ...bootstrapBefore, active: true }, { merge: true });
    for (const a of adminsBefore) await db.collection("admins").doc(a.id).set(a, { merge: true });
    for (const email of E2E) {
      try {
        const snap = await db.collection("admins").doc(email).get();
        if (snap.exists && !adminsBefore.some((a) => a.id === email)) await snap.ref.delete();
      } catch { /* ignore */ }
    }
    for (const uid of Object.values(uids)) await deleteAccount(auth, uid);
    console.log("\n已清理测试数据并恢复白名单状态。");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`);
  if (failed.length) {
    failed.forEach((f) => console.log(`FAILED: ${f.name} — ${f.detail ?? ""}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E 执行失败：", err);
  process.exit(1);
});
