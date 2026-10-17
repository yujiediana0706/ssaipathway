// 向后兼容层：Supabase Auth 已迁移至 Firebase Auth。
// 该文件仅保留 authHeaders 的 re-export，
// 供既有 import { authHeaders } from "@/lib/supabase" 的代码继续使用。
export { authHeaders } from "@/lib/firebase";
