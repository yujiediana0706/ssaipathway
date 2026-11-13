#!/usr/bin/env node
/**
 * NDJSON → 阿里云 RDS PostgreSQL 导入
 *
 * 用法：
 *   cd scripts/aliyun
 *   export DATABASE_URL="postgres://user:pass@host:5432/pathway?sslmode=require"
 *   node import-postgres.mjs                 # 导入 dump/ 下全部集合
 *   node import-postgres.mjs --only coach_profiles
 *   node import-postgres.mjs --include-ephemeral   # 连同 rate_limits 一起导入
 *
 * 前置：
 *   1) 已用 psql 执行 sql/001_schema.sql 与 sql/002_indexes.sql
 *   2) 已用 migrate-firestore.mjs 生成 dump/*.ndjson
 *   3) dump/auth-users.json（可选）：`firebase auth:export dump/auth-users.json --format=json`
 *      → 导入为 users 表，全部标记 must_reset_password = true
 *
 * 特性：
 *   - 幂等：ON CONFLICT DO UPDATE，可重复执行
 *   - 无损：表结构里没有的 Firestore 字段写进 extra jsonb
 *   - 事务：每 500 行一个事务，失败即整批回滚
 */

import { createReadStream, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = resolve(HERE, "dump");
const BATCH = 500;

/** 集合 → 表结构映射 */
const MAPS = [
  {
    collection: "profiles",
    table: "profiles",
    pk: ["id"],
    arrayCols: ["skills"],
    columns: [
      "id", "name", "email", "current_role", "target_role", "experience", "skills",
      "interests", "user_type", "personality", "coach_note", "created_at", "updated_at",
    ],
    hasExtra: true,
  },
  {
    collection: "user_resumes",
    table: "user_resumes",
    pk: ["id"],
    arrayCols: [],
    boolCols: ["is_primary"],
    columns: [
      "id", "user_id", "file_name", "file_path", "file_type", "file_size",
      "extracted_text", "source", "is_primary", "created_at",
    ],
    hasExtra: true,
  },
  {
    collection: "diagnostic_reports",
    table: "diagnostic_reports",
    pk: ["id"],
    jsonCols: [
      "skills_to_acquire", "action_plan", "possible_paths", "risk_points", "recommended_companies",
    ],
    columns: [
      "id", "user_id", "match_score", "current_assessment", "feasibility",
      "skills_to_acquire", "action_plan", "possible_paths", "ai_replace_risk",
      "ai_replace_analysis", "risk_points", "resume_summary", "choice_analysis",
      "recommended_companies", "created_at",
    ],
    hasExtra: true,
  },
  {
    collection: "simulator_sessions",
    table: "simulator_sessions",
    pk: ["id"],
    jsonCols: ["decisions", "transcript"],
    columns: [
      "id", "user_id", "role", "session_type", "score", "personality_tag",
      "decisions", "transcript", "created_at", "completed_at",
    ],
    hasExtra: true,
  },
  {
    collection: "tasks",
    table: "tasks",
    pk: ["id"],
    boolCols: ["completed"],
    columns: [
      "id", "user_id", "report_id", "title", "category", "priority",
      "completed", "due_date", "order_index", "created_at",
    ],
    hasExtra: true,
  },
  {
    collection: "coach_profiles",
    table: "coach_profiles",
    pk: ["id"],
    arrayCols: ["companies", "schools", "topic_tags"],
    jsonCols: ["education_docs", "work_docs", "other_docs", "verification_docs", "embedding"],
    boolCols: ["verified"],
    columns: [
      "id", "user_id", "display_name", "avatar_url", "headline", "bio",
      "companies", "schools", "topic_tags", "price_single", "price_package_5",
      "meeting_link", "education_docs", "work_docs", "other_docs", "verification_docs",
      "verification_status", "verification_reason", "verified", "reviewed_at",
      "sessions_count", "tier", "interview_status", "search_text", "embedding",
      "embedding_updated_at", "rating_avg", "review_count", "created_at", "updated_at",
    ],
    hasExtra: true,
  },
  {
    collection: "coach_slots",
    table: "coach_slots",
    pk: ["id"],
    columns: ["id", "coach_id", "start_at", "duration_min", "status", "created_at"],
    hasExtra: true,
  },
  {
    collection: "coach_orders",
    table: "coach_orders",
    pk: ["id"],
    renames: { stripe_payment_intent: "payment_ref" },
    columns: [
      "id", "coachee_id", "coach_id", "kind", "amount", "remaining_redemptions",
      "status", "cancel_reason", "payment_status", "amount_cents", "currency",
      "payment_ref", "paid_at", "lock_expires_at", "created_at", "confirmed_at",
      "completed_at", "released_at", "refunded_at",
    ],
    hasExtra: true,
  },
  {
    collection: "coach_bookings",
    table: "coach_bookings",
    pk: ["id"],
    columns: [
      "id", "order_id", "coachee_id", "coach_id", "slot_id", "status",
      "meeting_snapshot", "created_at", "confirmed_at", "completed_at",
      "released_at", "refunded_at",
    ],
    hasExtra: true,
  },
  {
    collection: "coach_reviews",
    table: "coach_reviews",
    pk: ["id"],
    columns: [
      "id", "booking_id", "coach_id", "reviewer_id", "rating", "comment",
      "reviewer_name", "created_at", "updated_at",
    ],
    hasExtra: true,
  },
  {
    collection: "concierge_bookings",
    table: "concierge_bookings",
    pk: ["id"],
    boolCols: ["consent"],
    columns: [
      "id", "user_id", "user_email", "user_name", "coach_id", "question",
      "expected_time", "contact", "consent", "status", "created_at", "updated_at",
    ],
    hasExtra: true,
  },
  {
    collection: "coach_threads",
    table: "coach_threads",
    pk: ["user_id"],
    jsonCols: ["messages"],
    columns: ["user_id", "messages", "updated_at"],
    hasExtra: true,
  },
  {
    collection: "rate_limits",
    table: "rate_limits",
    pk: ["key", "window_start"],
    columns: ["key", "window_start", "count", "expires_at", "updated_at"],
    hasExtra: false,
    ephemeral: true,
  },
];

const q = (ident) => `"${ident.replace(/"/g, '""')}"`;

function toTimestamp(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function coerce(map, column, value) {
  if (value === undefined) return null;
  if (value === "") return null;

  if ((map.jsonCols || []).includes(column)) {
    if (value === null) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if ((map.arrayCols || []).includes(column)) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v));
  }
  if ((map.boolCols || []).includes(column)) return Boolean(value);
  if (/(_at|start_at|due_date)$/.test(column)) return toTimestamp(value);
  return value;
}

async function* readNdjson(file) {
  if (!existsSync(file)) return;
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    yield JSON.parse(trimmed);
  }
}

async function importCollection(client, map) {
  const file = resolve(DUMP_DIR, `${map.collection}.ndjson`);
  if (!existsSync(file)) {
    console.log(`[skip] ${map.collection}: 无 dump 文件`);
    return 0;
  }

  const known = new Set(map.columns);
  const renames = map.renames || {};
  const unknownSeen = new Set();
  let buffer = [];
  let imported = 0;
  let skipped = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    const cols = map.columns;
    const colSql = cols.map(q).join(", ");
    const conflict = map.pk.map(q).join(", ");
    const updates = cols
      .filter((c) => !map.pk.includes(c))
      .map((c) => `${q(c)} = EXCLUDED.${q(c)}`)
      .join(", ");

    const values = [];
    const tuples = buffer.map((row, rowIdx) => {
      const placeholders = cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`);
      values.push(...row);
      return `(${placeholders.join(", ")})`;
    });

    const sql = `
      INSERT INTO ${q(map.table)} (${colSql})
      VALUES ${tuples.join(", ")}
      ON CONFLICT (${conflict}) ${updates ? `DO UPDATE SET ${updates}` : "DO NOTHING"}
    `;
    await client.query(sql, values);
    imported += buffer.length;
    buffer = [];
  };

  try {
    await client.query("BEGIN");
    for await (const record of readNdjson(file)) {
      const data = record.data || {};
      const id = record.id;
      if (!id) { skipped += 1; continue; }

      // 记录未知字段 → extra
      const extra = {};
      for (const [k, v] of Object.entries(data)) {
        const target = renames[k] || k;
        if (!known.has(target)) {
          unknownSeen.add(k);
          extra[k] = v;
        }
      }

      const row = map.columns.map((col) => {
        // 1) 直接同名列 2) rename 映射 3) pk 上的 id 4) extra
        if (col === "id" && data.id == null) return id;
        if (col === "user_id" && map.pk.includes("user_id") && data.user_id == null) return id;
        if (col === "extra") return JSON.stringify(extra);
        if (Object.prototype.hasOwnProperty.call(data, col)) {
          return coerce(map, col, data[col]);
        }
        const renamed = Object.entries(renames).find(([, to]) => to === col);
        if (renamed) return coerce(map, col, data[renamed[0]]);
        return null;
      });

      if (map.hasExtra) {
        const extraIdx = map.columns.indexOf("extra");
        if (extraIdx === -1) {
          // columns 里没写 extra 但表有该列 → 追加
          map.columns.push("extra");
          row.push(JSON.stringify(extra));
        } else {
          row[extraIdx] = JSON.stringify(extra);
        }
      }

      buffer.push(row);
      if (buffer.length >= BATCH) await flush();
    }
    await flush();
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  if (unknownSeen.size) {
    console.log(`[extra] ${map.collection}: 未映射字段 ${[...unknownSeen].join(", ")} → extra`);
  }
  console.log(`[load] ${map.collection.padEnd(22)} ${imported} 行${skipped ? `（跳过 ${skipped}）` : ""}`);
  return imported;
}

/** Firebase Auth 导出 → users 表（全部要求重置密码） */
async function importAuthUsers(client) {
  const file = resolve(DUMP_DIR, "auth-users.json");
  if (!existsSync(file)) {
    console.log("[skip] auth-users.json 不存在（可选步骤）");
    return 0;
  }
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const users = Array.isArray(raw) ? raw : raw.users || [];
  let count = 0;

  await client.query("BEGIN");
  try {
    for (const u of users) {
      const id = u.localId || u.uid;
      if (!id || !u.email) continue;
      await client.query(
        `INSERT INTO users (id, email, display_name, email_verified, must_reset_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, now(), now())
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           email_verified = EXCLUDED.email_verified`,
        [id, u.email, u.displayName || null, Boolean(u.emailVerified)]
      );
      count += 1;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  console.log(`[load] auth users             ${count} 行（must_reset_password=true）`);
  return count;
}

/** 导入后校验：逐表 count 与 dump 条数对比 */
async function verify(client) {
  const summaryFile = resolve(DUMP_DIR, "_summary.json");
  if (!existsSync(summaryFile)) return;
  const summary = JSON.parse(readFileSync(summaryFile, "utf8"));

  console.log("\n集合                         dump      DB    状态");
  for (const map of MAPS) {
    const expected = summary.collections?.[map.collection];
    if (expected == null) continue;
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${q(map.table)}`);
    const actual = rows[0].n;
    const ok = actual >= expected ? "OK" : "CHECK";
    console.log(`${map.collection.padEnd(24)} ${String(expected).padStart(6)} ${String(actual).padStart(7)}    ${ok}`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("缺少 DATABASE_URL");

  const includeEphemeral = process.argv.includes("--include-ephemeral");
  const onlyIdx = process.argv.indexOf("--only");
  const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await importAuthUsers(client);

    for (const map of MAPS) {
      if (map.ephemeral && !includeEphemeral) {
        console.log(`[skip] ${map.collection}: 临时数据，--include-ephemeral 才会导入`);
        continue;
      }
      if (only && map.collection !== only) continue;
      await importCollection(client, map);
    }

    await verify(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("导入失败:", err);
  process.exit(1);
});
