import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

/** service_role 管理端客户端（仅服务端使用，绕过 RLS 用于校验 token 与受信写入） */
export function getAdminClient(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('[authServer] Supabase env not configured.');
    return null;
  }
  _admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

/**
 * 从请求的 Authorization: Bearer <jwt> 校验登录态，返回认证用户。
 * 用 service_role 的 auth.getUser(token) 向 Supabase 验证 JWT 合法性。
 * 未携带 / 非法 / 过期 token 一律返回 null（路由据此返回 401）。
 */
export async function getAuthedUser(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  const admin = getAdminClient();
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    const metaName = (u.user_metadata?.name as string) || '';
    const name = metaName.trim() || u.email?.split('@')[0] || '用户';
    return {
      id: u.id,
      email: u.email || '',
      name,
    };
  } catch (err) {
    console.warn('[authServer] token verification failed:', err);
    return null;
  }
}
