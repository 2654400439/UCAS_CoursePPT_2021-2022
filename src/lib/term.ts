import { normalizeText } from "./normalize";

export type ParsedTerm = {
  /** 规范化后的展示文本 */
  label: string;
  /** 用于排序：越大越新。形如 startYear*10 + semesterIndex */
  sortKey: number | null;
  /** 归一化时产生的提示（用于调试/未来扩展） */
  warnings: string[];
};

export type TermSeason = "秋" | "春" | "夏" | "未知";

const seasonToIndex: Record<string, 1 | 2 | 3> = {
  秋: 1,
  春: 2,
  夏: 3,
};

const indexToSeason: Record<1 | 2 | 3, "秋" | "春" | "夏"> = {
  1: "秋",
  2: "春",
  3: "夏",
};

function toFourDigitYear(y: string): number | null {
  const s = normalizeText(y);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (s.length === 4) return n;
  if (s.length === 2) return 2000 + n;
  return null;
}

function detectSeason(termRaw: string): "秋" | "春" | "夏" | null {
  if (/[秋]/.test(termRaw)) return "秋";
  if (/[春]/.test(termRaw)) return "春";
  if (/[夏]/.test(termRaw)) return "夏";
  return null;
}

function detectSemesterIndex(termRaw: string): 1 | 2 | 3 | null {
  if (/第一学期|第1学期|一学期/.test(termRaw)) return 1;
  if (/第二学期|第2学期|二学期/.test(termRaw)) return 2;
  if (/第三学期|第3学期|三学期/.test(termRaw)) return 3;
  return null;
}

/**
 * 只提取“学期季节/类型”，用于“同一季节跨年份合并、不同季节拆分”。
 *
 * - 能识别：秋/春/夏；也可从“第1/2/3学期”推断
 * - 识别失败则返回“未知”
 */
export function termSeason(term: string): TermSeason {
  const raw = normalizeText(term);
  if (!raw) return "未知";
  const s = raw.replace(/[—–]/g, "-");

  const seasonDetected = detectSeason(s);
  if (seasonDetected) return seasonDetected;

  const idxDetected = detectSemesterIndex(s);
  if (idxDetected) return indexToSeason[idxDetected];

  return "未知";
}

/**
 * 按国科大“三学期制”规整学期：
 * - 秋：第一学期
 * - 春：第二学期
 * - 夏：第三学期
 *
 * 尽量从各种写法解析年份与季节，并输出统一 label：
 * `YYYY-YYYY学年 · 秋/春/夏（第1/2/3学期）`
 */
export function normalizeTerm(term: string): ParsedTerm {
  const raw = normalizeText(term);
  const warnings: string[] = [];
  if (!raw) return { label: "", sortKey: null, warnings: ["学期为空"] };

  // Normalize separators
  const s = raw.replace(/[—–]/g, "-");

  // Prefer explicit year range like 2021-2022 / 21-22
  const rangeMatch = s.match(/(\d{2,4})\s*-\s*(\d{2,4})/);
  const seasonDetected = detectSeason(s);
  const idxDetected = detectSemesterIndex(s);

  let startYear: number | null = null;

  if (rangeMatch) {
    const a = toFourDigitYear(rangeMatch[1]);
    const b = toFourDigitYear(rangeMatch[2]);
    if (a && b) {
      // Handle weird "22-22" by interpreting as calendar year 2022
      if (a === b) {
        if (!seasonDetected && !idxDetected) {
          warnings.push("学期年份为同一年且缺少季节/学期序号，无法确定学年");
        } else {
          const season = seasonDetected ?? indexToSeason[idxDetected ?? 1];
          startYear = season === "秋" ? a : a - 1;
          warnings.push("学期年份为同一年，已按季节推断所属学年");
        }
      } else {
        startYear = a;
        // sanity check
        if (b !== a + 1) warnings.push("学年跨度不为 1 年，已按起始年处理");
      }
    }
  }

  // If no range, try find single year like 2022 or 22
  if (!startYear) {
    const yearMatch = s.match(/(\d{4}|\d{2})/);
    const y = yearMatch ? toFourDigitYear(yearMatch[1]) : null;
    if (y) {
      const season = seasonDetected ?? (idxDetected ? indexToSeason[idxDetected] : null);
      if (season) {
        startYear = season === "秋" ? y : y - 1;
      } else {
        warnings.push("只解析到年份，缺少季节/学期序号");
      }
    }
  }

  const season = seasonDetected ?? (idxDetected ? indexToSeason[idxDetected] : null);
  const seasonClean = season ? (String(season).trim() as "秋" | "春" | "夏") : null;
  const semesterIndex: 1 | 2 | 3 | null = seasonClean ? seasonToIndex[seasonClean] : idxDetected;

  if (!seasonClean || !semesterIndex) {
    return { label: raw, sortKey: null, warnings: ["无法识别季节/学期序号：保留原文"] };
  }

  if (!startYear) {
    return { label: raw, sortKey: null, warnings: ["无法识别学年：保留原文"] };
  }

  const label = `${startYear}-${startYear + 1}学年 · ${seasonClean}（第${semesterIndex}学期）`;
  const sortKey = startYear * 10 + semesterIndex;
  return { label, sortKey, warnings };
}

export function termSortKey(term: string): number | null {
  return normalizeTerm(term).sortKey;
}


