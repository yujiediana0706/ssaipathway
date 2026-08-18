"use client";

import { useState, useMemo, useEffect } from "react";
import NavBar from "@/components/NavBar";
import { getStoredUser, clearStoredUser } from "@/lib/userStore";
import type { StoredUser } from "@/lib/userStore";
import { getStoredReport, clearStoredReport } from "@/lib/reportStore";
import type { SavedReport } from "@/lib/reportStore";

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
  description?: string;
  priority: Priority;
  isFromReport?: boolean;
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
  const [user, setUser] = useState<StoredUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  // Build initial task/skill list from stored report + user profile (once loaded)
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [report, setReport] = useState<SavedReport | null>(null);

  useEffect(() => {
    if (!user) return;

    // Load saved report
    const savedReport = getStoredReport();
    setReport(savedReport);

    // Seed skills from report's skillsToAcquire (not user's own skills)
    if (savedReport && savedReport.skillsToAcquire.length > 0) {
      setSkills(
        savedReport.skillsToAcquire.map((s, i) => ({
          id: `report-s-${i}`,
          name: s.name,
          description: s.description,
          priority: s.priority,
          isFromReport: true,
        }))
      );
    } else {
      // Fallback: no report yet, use generic suggestions based on user profile
      setSkills([
        { id: "s1", name: "AI 工具使用", description: "掌握主流 AI 工具与平台", priority: "high" },
        { id: "s2", name: "数据分析能力", description: "使用数据驱动决策", priority: "high" },
        { id: "s3", name: "行业知识补充", description: "学习目标行业核心概念", priority: "medium" },
        { id: "s4", name: "作品集构建", description: "打造可展示的项目成果", priority: "medium" },
      ]);
    }

    // Seed tasks from report's action plan
    if (savedReport && savedReport.actionPlan.length > 0) {
      const reportTasks: DashboardTask[] = [];
      savedReport.actionPlan.forEach((step, phaseIdx) => {
        step.details.forEach((detail, detailIdx) => {
          reportTasks.push({
            id: `report-t-${phaseIdx}-${detailIdx}`,
            title: detail,
            category: phaseIdx === 0 ? "milestone" : "task",
            completed: false,
          });
        });
      });
      // Mark the first milestone as completed (onboarding done)
      if (reportTasks.length > 0) {
        reportTasks[0].completed = true;
      }
      setTasks(reportTasks);
    } else {
      // Fallback: no report yet
      setTasks([
        {
          id: "t1",
          title: user.target
            ? `拆解 ${user.target} 岗位 JD`
            : "完成目标岗位 JD 拆解",
          category: "task",
          completed: true,
        },
        {
          id: "t2",
          title: "完成 AI 探索对话",
          category: "milestone",
          completed: true,
        },
        {
          id: "t3",
          title: "生成转型诊断报告",
          category: "milestone",
          completed: false,
        },
        {
          id: "t4",
          title: "体验一次岗位模拟器",
          category: "task",
          completed: false,
        },
        {
          id: "t5",
          title: "与 Coach 复盘转型路径",
          category: "task",
          completed: false,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: "a1", title: "完成 AI 转型探索", time: "刚刚", type: "session" },
    { id: "a2", title: "生成个性化诊断报告", time: "刚刚", type: "milestone" },
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

  const handleResetProfile = () => {
    clearStoredUser();
    clearStoredReport();
    setUser(null);
    setReport(null);
    setTasks([]);
    setSkills([]);
  };

  // Loading state while reading localStorage
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand"></span>
        </div>
      </div>
    );
  }

  // No user profile yet — prompt onboarding
  if (user === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">
          🧭
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          还没有你的转型档案
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          先完成 30 秒的信息收集，AI 才能为你定制转型路径与工作台内容。
        </p>
        <a
          href="/onboarding"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          创建我的转型档案 →
        </a>
      </div>
    );
  }

  const userName = user.name;

  return (
    <div className="min-h-screen bg-muted text-brand">
      <NavBar />

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">欢迎回来 👋</p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand">
            你好，{userName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.currentRole}
            {user.years ? ` · ${user.years}` : ""}
            {user.target ? ` · 目标：${user.target}` : ""}
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card md:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              整体转型进度
            </p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-4xl font-semibold text-brand">
                {progressPercent}%
              </span>
              <span className="text-xs text-muted-foreground">
                {completedCount} / {totalTasks} 已完成
              </span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-brand-light">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {report && (
              <p className="mt-3 text-xs text-muted-foreground">
                AI 匹配度：<span className="font-semibold text-brand">{report.matchScore}</span>/100
              </p>
            )}
          </div>

          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              已完成任务
            </p>
            <p className="mt-4 text-4xl font-semibold text-brand">
              {completedCount}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              完成 {totalTasks} 项规划中的任务
            </p>
          </div>

          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              待掌握技能
            </p>
            <p className="mt-4 text-4xl font-semibold text-brand">
              {skills.length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              正在培养 {skills.length} 项核心能力
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand">任务清单</h2>
              <span className="chip">
                {completedCount}/{totalTasks}
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className={`group flex items-start gap-3 rounded-xl border border-border bg-white p-3 transition-colors hover:border-brand-border ${
                    task.completed ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border text-brand focus:ring-brand"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm text-brand ${
                        task.completed ? "line-through text-muted-foreground" : ""
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
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-light hover:text-foreground group-hover:opacity-100"
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
                <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  暂无任务，添加第一个任务吧
                </li>
              )}
            </ul>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex gap-2">
                <select
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value as Category)}
                  className="w-24 shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-sm text-brand outline-none transition-colors focus:border-brand-border"
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
              <h2 className="text-base font-semibold text-brand">待掌握技能</h2>
              <span className="chip">{skills.length} 项</span>
            </div>
            {report && (
              <p className="mt-1 text-xs text-tech">
                基于 AI 诊断报告推荐
              </p>
            )}

            <ul className="mt-4 space-y-2">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition-colors hover:border-brand-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-brand">
                      {skill.name}
                      {skill.isFromReport && (
                        <span className="ml-2 rounded-full bg-tech-light px-2 py-0.5 text-[10px] font-medium text-tech">
                          AI 推荐
                        </span>
                      )}
                    </p>
                    {skill.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {skill.description}
                      </p>
                    )}
                    <span
                      className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityStyles[skill.priority]}`}
                    >
                      优先级：{priorityLabels[skill.priority]}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSkill(skill.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-light hover:text-foreground group-hover:opacity-100"
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
                <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  尚未添加技能
                </li>
              )}
            </ul>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex gap-2">
                <select
                  value={newSkillPriority}
                  onChange={(e) => setNewSkillPriority(e.target.value as Priority)}
                  className="w-24 shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-sm text-brand outline-none transition-colors focus:border-brand-border"
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
              <h2 className="text-base font-semibold text-brand">快捷入口</h2>
              <div className="mt-4 space-y-3">
                <a
                  href="/simulator"
                  className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 transition-colors hover:border-brand-border hover:bg-muted"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
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
                    <p className="text-sm font-medium text-brand">职业模拟器</p>
                    <p className="text-xs text-muted-foreground">沉浸式体验目标岗位的一天</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-muted-foreground"
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
                  className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 transition-colors hover:border-brand-border hover:bg-muted"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
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
                    <p className="text-sm font-medium text-brand">导师 Coach</p>
                    <p className="text-xs text-muted-foreground">预约 1 对 1 行业导师</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>

                <a
                  href="/onboarding"
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-brand-border hover:bg-muted"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand ring-1 ring-brand-border">
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
                    <p className="text-sm font-medium text-brand">重新探索</p>
                    <p className="text-xs text-muted-foreground">重新做 AI 探索，刷新报告</p>
                  </div>
                </a>

                <button
                  onClick={handleResetProfile}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-rose-300 hover:bg-rose-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-muted-foreground ring-1 ring-brand-border">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                        clipRule="evenodd"
                      />
                      <path
                        fillRule="evenodd"
                        d="M19.78 10.53a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H9a.75.75 0 000 1.5h8.44l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">清除档案</p>
                    <p className="text-xs text-muted-foreground">退出并清除本地用户信息</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand">最近动态</h2>
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
                        ? "bg-brand"
                        : "bg-blue-500"
                    }`}
                  />
                  {idx !== activities.length - 1 && (
                    <span className="absolute top-4 h-full w-px bg-brand-border" />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-sm text-brand">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
                </div>
              </li>
            ))}
            {activities.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                暂无动态
              </li>
            )}
          </ol>
        </section>
      </main>
    </div>
  );
}
