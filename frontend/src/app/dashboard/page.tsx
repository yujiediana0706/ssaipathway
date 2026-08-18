"use client";

import { useState, useMemo } from "react";
import NavBar from "@/components/NavBar";

type Category = "skill" | "task" | "milestone";
type Priority = "high" | "medium" | "low";

interface DashboardTask {
  id: string;
  title: string;
  category: Category;
  completed: boolean;
}

interface Skill {
  id: string;
  name: string;
  priority: Priority;
}

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: "milestone" | "task" | "session";
}

const categoryStyles: Record<Category, string> = {
  skill: "bg-amber-50 text-amber-700 border-amber-200",
  task: "bg-blue-50 text-blue-700 border-blue-200",
  milestone: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const categoryLabels: Record<Category, string> = {
  skill: "技能",
  task: "任务",
  milestone: "里程碑",
};

const priorityStyles: Record<Priority, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

const priorityLabels: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export default function DashboardPage() {
  const userName = "李昀泽";

  const [tasks, setTasks] = useState<DashboardTask[]>([
    { id: "t1", title: "完成产品经理岗位 JD 拆解", category: "task", completed: true },
    { id: "t2", title: "撰写 PRD 文档（AI 对话功能）", category: "task", completed: true },
    { id: "t3", title: "学习 RICE 评分模型", category: "skill", completed: false },
    { id: "t4", title: "完成模拟面试一轮", category: "milestone", completed: false },
    { id: "t5", title: "与导师复盘产品策略", category: "task", completed: false },
  ]);

  const [skills, setSkills] = useState<Skill[]>([
    { id: "s1", name: "产品思维", priority: "high" },
    { id: "s2", name: "数据分析", priority: "high" },
    { id: "s3", name: "AI 产品设计", priority: "medium" },
    { id: "s4", name: "跨部门协作", priority: "medium" },
  ]);

  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: "a1", title: "完成「产品经理的一天」模拟体验", time: "2 小时前", type: "session" },
    { id: "a2", title: "达成里程碑：首次模拟面试通关", time: "昨天", type: "milestone" },
    { id: "a3", title: "完成任务：竞品分析初稿", time: "2 天前", type: "task" },
    { id: "a4", title: "匹配到新导师：陈思远（前字节 AI 产品）", time: "3 天前", type: "session" },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<Category>("task");

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillPriority, setNewSkillPriority] = useState<Priority>("medium");

  const { completedCount, totalTasks, progressPercent } = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    return {
      completedCount: done,
      totalTasks: total,
      progressPercent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [tasks]);

  const toggleTask = (id: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
      const target = prev.find((t) => t.id === id);
      if (target && !target.completed) {
        const label = categoryLabels[target.category];
        setActivities((acts) => [
          {
            id: `a-${Date.now()}`,
            title: `完成${label}：${target.title}`,
            time: "刚刚",
            type: target.category === "milestone" ? "milestone" : "task",
          },
          ...acts,
        ]);
      }
      return next;
    });
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setTasks((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, title, category: newTaskCategory, completed: false },
    ]);
    setNewTaskTitle("");
    setNewTaskCategory("task");
  };

  const addSkill = () => {
    const name = newSkillName.trim();
    if (!name) return;
    setSkills((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, name, priority: newSkillPriority },
    ]);
    setNewSkillName("");
    setNewSkillPriority("medium");
  };

  const removeSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <NavBar />

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-zinc-500">欢迎回来 👋</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            你好，{userName}
          </h1>
          <p className="text-sm text-zinc-500">
            继续你的转型之旅，今天也要向目标迈进一步。
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card md:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              整体转型进度
            </p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-4xl font-semibold text-zinc-900">
                {progressPercent}%
              </span>
              <span className="text-xs text-zinc-500">
                {completedCount} / {totalTasks} 已完成
              </span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-900 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              已完成任务
            </p>
            <p className="mt-4 text-4xl font-semibold text-zinc-900">
              {completedCount}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              完成 {totalTasks} 项规划中的任务
            </p>
          </div>

          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              待掌握技能
            </p>
            <p className="mt-4 text-4xl font-semibold text-zinc-900">
              {skills.length}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              正在培养 {skills.length} 项核心能力
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">任务清单</h2>
              <span className="chip">
                {completedCount}/{totalTasks}
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className={`group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 ${
                    task.completed ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm text-zinc-900 ${
                        task.completed ? "line-through text-zinc-400" : ""
                      }`}
                    >
                      {task.title}
                    </p>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryStyles[task.category]}`}
                    >
                      {categoryLabels[task.category]}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
                    aria-label="删除任务"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 3.75V4h-3a.75.75 0 000 1.5H6v10A2.5 2.5 0 008.5 18h3a2.5 2.5 0 002.5-2.5v-10h.25a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 009.5 2h-1a1.75 1.75 0 00-1.75 1.75zM7.5 5.5h5v10a1 1 0 01-1 1h-3a1 1 0 01-1-1v-10z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                  暂无任务，添加第一个任务吧
                </li>
              )}
            </ul>

            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
              <div className="flex gap-2">
                <select
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value as Category)}
                  className="w-24 shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400"
                >
                  <option value="skill">技能</option>
                  <option value="task">任务</option>
                  <option value="milestone">里程碑</option>
                </select>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="添加任务..."
                  className="input-primary py-2"
                />
              </div>
              <button onClick={addTask} className="btn-primary w-full py-2">
                添加任务
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">待掌握技能</h2>
              <span className="chip">{skills.length} 项</span>
            </div>

            <ul className="mt-4 space-y-2">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-zinc-900">{skill.name}</p>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityStyles[skill.priority]}`}
                    >
                      优先级：{priorityLabels[skill.priority]}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSkill(skill.id)}
                    className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
                    aria-label="删除技能"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 3.75V4h-3a.75.75 0 000 1.5H6v10A2.5 2.5 0 008.5 18h3a2.5 2.5 0 002.5-2.5v-10h.25a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 009.5 2h-1a1.75 1.75 0 00-1.75 1.75zM7.5 5.5h5v10a1 1 0 01-1 1h-3a1 1 0 01-1-1v-10z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </li>
              ))}
              {skills.length === 0 && (
                <li className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                  尚未添加技能
                </li>
              )}
            </ul>

            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
              <div className="flex gap-2">
                <select
                  value={newSkillPriority}
                  onChange={(e) => setNewSkillPriority(e.target.value as Priority)}
                  className="w-24 shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400"
                >
                  <option value="high">高优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="low">低优先级</option>
                </select>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  placeholder="添加技能..."
                  className="input-primary py-2"
                />
              </div>
              <button onClick={addSkill} className="btn-primary w-full py-2">
                添加技能
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-zinc-900">快捷入口</h2>
              <div className="mt-4 space-y-3">
                <a
                  href="/simulator"
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path d="M8.5 3.75a.75.75 0 011.5 0v3.5l2.95-2.318a.75.75 0 11.9 1.2l-2.95 2.318 2.95 2.318a.75.75 0 11-.9 1.2L10 8.75v3.5a.75.75 0 01-1.5 0V8.75L5.55 11.068a.75.75 0 01-.9-1.2l2.95-2.318-2.95-2.318a.75.75 0 01.9-1.2L8.5 7.25v-3.5z" />
                      <path
                        fillRule="evenodd"
                        d="M4.25 5.5a1.75 1.75 0 00-1.75 1.75v5.5c0 .966.784 1.75 1.75 1.75h11.5A1.75 1.75 0 0017 12.75v-5.5a1.75 1.75 0 00-1.75-1.75H4.25zM3 7.25C3 6.56 3.56 6 4.25 6h11.5c.69 0 1.25.56 1.25 1.25v5.5c0 .69-.56 1.25-1.25 1.25H4.25C3.56 14 3 13.44 3 12.75v-5.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">职业模拟器</p>
                    <p className="text-xs text-zinc-500">沉浸式体验目标岗位的一天</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-zinc-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>

                <a
                  href="/coach"
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a.23.23 0 01.417-.023 4.5 4.5 0 008.237 0 .23.23 0 01.417.023 4.5 4.5 0 01-4.072 4.498 7.97 7.97 0 01-1.335.095 7.97 7.97 0 01-1.335-.095 4.5 4.5 0 01-4.072-4.498z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">导师 Coach</p>
                    <p className="text-xs text-zinc-500">预约 1 对 1 行业导师</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-zinc-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>

                <button
                  onClick={() => alert("正在重新启动诊断流程...")}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-zinc-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">重新诊断</p>
                    <p className="text-xs text-zinc-500">基于最新状态重新评估路径</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">最近动态</h2>
            <span className="chip">时间线</span>
          </div>

          <ol className="mt-6 space-y-5">
            {activities.map((item, idx) => (
              <li key={item.id} className="relative flex gap-4 pl-2">
                <div className="relative flex flex-col items-center">
                  <span
                    className={`mt-1 h-3 w-3 rounded-full ring-4 ring-white ${
                      item.type === "milestone"
                        ? "bg-emerald-500"
                        : item.type === "session"
                        ? "bg-zinc-900"
                        : "bg-blue-500"
                    }`}
                  />
                  {idx !== activities.length - 1 && (
                    <span className="absolute top-4 h-full w-px bg-zinc-200" />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-sm text-zinc-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.time}</p>
                </div>
              </li>
            ))}
            {activities.length === 0 && (
              <li className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                暂无动态
              </li>
            )}
          </ol>
        </section>
      </main>
    </div>
  );
}
