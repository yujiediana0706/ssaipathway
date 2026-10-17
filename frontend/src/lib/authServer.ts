// 服务端鉴权已迁移至 Firebase Admin（实现见 lib/firebaseAdmin.ts）。
// 该文件保留 getAuthedUser 的 re-export，
// 供既有 import { getAuthedUser } from "@/lib/authServer" 的 API 路由继续使用。
export { getAuthedUser } from "@/lib/firebaseAdmin";
export type { AuthedUser } from "@/lib/firebaseAdmin";
