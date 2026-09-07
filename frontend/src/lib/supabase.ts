import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 浏览器端 Supabase 客户端：负责 Auth（邮箱注册/登录/会话）。
// 开启会话持久化（localStorage）+ 自动刷新 token + 从 URL 检测邮箱验证回跳的会话。
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;

/**
 * 给需要鉴权的 /api/db/* 请求附加 Authorization: Bearer <access_token>。
 * 服务端用 service_role 校验该 JWT，并强制把数据归属到认证用户。
 */
export async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore：未登录时不带 token，服务端会返回 401
  }
  return headers;
}
