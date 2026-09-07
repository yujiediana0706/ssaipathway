import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getAuthedUser } from '@/lib/authServer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const tasks = await db.getTasksByUserId(user.id);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[API tasks] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'list': {
        const tasks = await db.getTasksByUserId(user.id);
        return NextResponse.json({ tasks });
      }
      case 'create': {
        const { task } = body;
        const created = await db.createTask({ ...task, user_id: user.id });
        return NextResponse.json({ task: created });
      }
      case 'bulk-create': {
        const { tasks } = body;
        if (!Array.isArray(tasks)) return NextResponse.json({ error: 'tasks must be an array' }, { status: 400 });
        const scoped = tasks.map((t: Record<string, unknown>) => ({ ...t, user_id: user.id }));
        const created = await db.createTasks(scoped);
        return NextResponse.json({ tasks: created });
      }
      case 'update': {
        const { id, updates } = body;
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const updated = await db.updateTask(id, updates);
        return NextResponse.json({ task: updated });
      }
      case 'delete': {
        const { id } = body;
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        await db.deleteTask(id);
        return NextResponse.json({ success: true });
      }
      case 'clear-user': {
        await db.clearTasksByUserId(user.id);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[API tasks] POST error:', error);
    return NextResponse.json({ error: 'Task operation failed' }, { status: 500 });
  }
}
