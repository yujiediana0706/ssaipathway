#!/usr/bin/env node
/**
 * Firestore → 本地 NDJSON 导出
 *
 * 为什么不用 gcloud firestore export？
 *   `gcloud firestore export` 产出的是 LevelDB 二进制，无法直接导入 PostgreSQL。
 *   这里用 Admin SDK 逐集合读取，落成 { id, data } 的 NDJSON，便于校验与重放。
 *
 * 用法：
 *   cd scripts/aliyun && npm install
 *
 *   # 方式一：服务账号密钥
 *   export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
 *   export FIREBASE_PROJECT_ID=pathway-app-512202
 *   node migrate-firestore.mjs
 *
 *   # 方式二：沿用应用现有环境变量
 *   export FIREBASE_CLIENT_EMAIL=...
 *   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
 *   export FIREBASE_PROJECT_ID=pathway-app-512202
 *   node migrate-firestore.mjs
 *
 * 产物：
 *   dump/<collection>.ndjson        每行 { id, data }
 *   dump/_summary.json              各集合条数 + 导出时间
 */

import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";

const HERE = dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = resolve(HERE, "dump");

/** 需要迁移的集合；order 是导入顺序（父表在前） */
const COLLECTIONS = [
  "profiles",
  "user_resumes",
  "diagnostic_reports",
  "simulator_sessions",
  "tasks",
  "coach_profiles",
  "coach_slots",
  "coach_orders",
  "coach_bookings",
  "coach_reviews",
  "concierge_bookings",
  "coach_threads",
  "rate_limits", // 临时数据，可加 --skip-ephemeral 跳过
];

const EPHEMERAL = new Set(["rate_limits"]);

function initFirebase() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("缺少 FIREBASE_PROJECT_ID");

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault(), projectId });
    console.log("[firebase] 使用 GOOGLE_APPLICATION_CREDENTIALS");
  } else if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
    console.log("[firebase] 使用 FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY");
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
    console.log("[firebase] 回退到 ADC");
  }
  return getFirestore();
}

/** Firestore 特殊类型 → 可 JSON 化 / 可入库的普通值 */
function normalize(value, depth = 0) {
  if (value == null) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof GeoPoint) return { lat: value.latitude, lng: value.longitude };
  if (value instanceof DocumentReference) return value.path;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map((v) => normalize(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v, depth + 1);
    return out;
  }
  return value;
}

async function main() {
  const skipEphemeral = process.argv.includes("--skip-ephemeral");
  const db = initFirebase();
  mkdirSync(DUMP_DIR, { recursive: true });

  const summary = { exportedAt: new Date().toISOString(), collections: {} };
  let total = 0;

  for (const name of COLLECTIONS) {
    if (skipEphemeral && EPHEMERAL.has(name)) {
      console.log(`[skip] ${name}`);
      continue;
    }

    const file = resolve(DUMP_DIR, `${name}.ndjson`);
    const stream = createWriteStream(file, { encoding: "utf8" });
    const snap = await db.collection(name).get();
    let count = 0;

    for (const doc of snap.docs) {
      const record = { id: doc.id, data: normalize(doc.data()) };
      const ok = stream.write(JSON.stringify(record) + "\n");
      if (!ok) await new Promise((r) => stream.once("drain", r));
      count += 1;
    }
    await new Promise((r) => stream.end(r));

    summary.collections[name] = count;
    total += count;
    console.log(`[dump] ${name.padEnd(22)} ${count} 条 → ${file}`);
  }

  summary.total = total;
  writeFileSync(resolve(DUMP_DIR, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\n完成：${total} 条记录，清单见 dump/_summary.json`);
}

main().catch((err) => {
  console.error("导出失败:", err);
  process.exit(1);
});
