/**
 * 简历 JD 定向优化工作台 — 类型定义
 */

/** 简历块类型：保留原始排版结构 */
export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph"
  | "bullet"      // 无序列表项
  | "numbered"    // 有序列表项
  | "table"
  | "divider"
  | "meta";       // 姓名/联系方式等头部元信息

export interface ResumeBlock {
  id: string;
  type: BlockType;
  text: string;
  /** AI 改写理由（仅优化后简历块有） */
  reason?: string;
  /** 样式快照（用于右侧继承排版） */
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSize?: number;   // pt
    fontFamily?: string;
    lineHeight?: number; // 倍数，如 1.5
    marginTop?: number;  // pt
    marginBottom?: number; // pt
    leftIndent?: number; // pt
    align?: "left" | "center" | "right" | "justify";
    bulletChar?: string; // • / - / * 等
    color?: string;      // hex
  };
  /** 列表层级（0 为顶层） */
  listLevel?: number;
}

export interface ResumeDocument {
  blocks: ResumeBlock[];
  fileName: string;
  fileType: string;
  /** PDF 解析时可能丢失排版，置 true 并在 UI 提示 */
  layoutDegraded: boolean;
  rawText: string;
}

/** 改写策略 */
export type RewriteStrategy = "conservative" | "moderate" | "aggressive";

// ─── JD 定向分析报告 ─────────────────────────────────────────────

export interface JDKeywordMatch {
  keyword: string;
  found: boolean;
  context?: string;
}

export interface JDAnalysisReport {
  // 0. 三大重点（置于报告最顶部，一眼可见）
  highlights: {
    /** 最匹配、要重点写的一段经历 */
    keyExperience: string;
    /** 要重点强调的核心能力 */
    keyCompetency: string;
    /** 现在最差、最缺的部分 */
    keyGap: string;
  };

  // 1. 基础匹配概览
  matchScore: number; // 0-100
  matchedKeywords: string[];
  missingKeywords: string[];

  // 2. 候选人现状盘点
  coreCompetencies: string[];
  projectHighlights: string[];
  certifications: string[];
  softSkills: string[];

  // 3. JD 拆解
  coreResponsibilities: string[];
  hardRequirements: string[];
  preferredQualifications: string[];
  implicitRequirements: string[];
  teamPreferences: string[];

  // 4. 转型可行性评估
  feasibility: "high" | "medium" | "low";
  feasibilityReason: string;
  gapList: {
    hardGap: string[];
    experienceGap: string[];
    skillGap: string[];
  };

  // 5. 针对性行动项
  shortTermActions: string[];   // 简历可包装优化项
  longTermActions: string[];    // 需补充的项目/证书/经历

  // 6. 风险提示
  fabricationRisks: string[];   // 不能编造的经历
  backgroundCheckRisks: string[]; // 背调踩坑
  wordingBoundaries: string[];  // 话术边界

  // 7. 优化策略说明
  optimizationStrategy: string;
  modulesToStrengthen: string[];
  modulesToWeaken: string[];

  disclaimer: string;
}

// ─── 优化会话（含版本历史） ──────────────────────────────────────

export interface ResumeOptimizeVersion {
  id: string;
  createdAt: string;
  blocks: ResumeBlock[];
  strategy: RewriteStrategy;
  note?: string;
}

export interface ResumeOptimizeSession {
  id?: string;
  user_id: string;
  resumeFileName: string;
  resumeFilePath?: string;
  resumeBlocks: ResumeBlock[];   // 原始简历块
  optimizedBlocks: ResumeBlock[]; // 当前优化后简历块
  jdText: string;
  analysisReport?: JDAnalysisReport;
  strategy: RewriteStrategy;
  strictLayout: boolean;
  versions: ResumeOptimizeVersion[];
  created_at?: string;
  updated_at?: string;
}
