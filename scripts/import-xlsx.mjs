import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const ROOT = process.cwd();

const INPUT = path.join(ROOT, "src", "data", "reviews_MESA2021.xlsx");
const OUTPUT = path.join(ROOT, "src", "data", "reviews.generated.ts");

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/（.*?）/g, (m) => m) // keep parentheses content but remove spaces
    .replace(/[()]/g, (m) => (m === "(" ? "（" : "）"));
}

function normalizeText(s) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeTerm(term) {
  const raw = normalizeText(term);
  const warnings = [];
  if (!raw) return { label: "", sortKey: null, warnings: ["学期为空"] };

  const seasonToIndex = { 秋: 1, 春: 2, 夏: 3 };
  const indexToSeason = { 1: "秋", 2: "春", 3: "夏" };

  const toFourDigitYear = (y) => {
    const s = normalizeText(y);
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (s.length === 4) return n;
    if (s.length === 2) return 2000 + n;
    return null;
  };

  const detectSeason = (t) => {
    if (/[秋]/.test(t)) return "秋";
    if (/[春]/.test(t)) return "春";
    if (/[夏]/.test(t)) return "夏";
    return null;
  };
  const detectIdx = (t) => {
    if (/第一学期|第1学期|一学期/.test(t)) return 1;
    if (/第二学期|第2学期|二学期/.test(t)) return 2;
    if (/第三学期|第3学期|三学期/.test(t)) return 3;
    return null;
  };

  const s = raw.replace(/[—–]/g, "-");
  const rangeMatch = s.match(/(\d{2,4})\s*-\s*(\d{2,4})/);
  const seasonDetected = detectSeason(s);
  const idxDetected = detectIdx(s);

  let startYear = null;
  if (rangeMatch) {
    const a = toFourDigitYear(rangeMatch[1]);
    const b = toFourDigitYear(rangeMatch[2]);
    if (a && b) {
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
        if (b !== a + 1) warnings.push("学年跨度不为 1 年，已按起始年处理");
      }
    }
  }

  if (!startYear) {
    const yearMatch = s.match(/(\d{4}|\d{2})/);
    const y = yearMatch ? toFourDigitYear(yearMatch[1]) : null;
    if (y) {
      const season = seasonDetected ?? (idxDetected ? indexToSeason[idxDetected] : null);
      if (season) startYear = season === "秋" ? y : y - 1;
      else warnings.push("只解析到年份，缺少季节/学期序号");
    }
  }

  const season = seasonDetected ?? (idxDetected ? indexToSeason[idxDetected] : null);
  const seasonClean = season ? String(season).trim() : null;
  const semesterIndex = seasonClean ? seasonToIndex[seasonClean] : idxDetected;

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

function normalizeMultilineText(s) {
  const raw = String(s ?? "").replace(/\u00A0/g, " ").replace(/\r\n/g, "\n");
  // trim only outer, keep internal newlines
  return raw
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function parseBool(v) {
  const s = normalizeText(v).toLowerCase();
  if (!s) return null;
  if (["是", "y", "yes", "true", "1"].includes(s)) return true;
  if (["否", "n", "no", "false", "0"].includes(s)) return false;
  return null;
}

function parseNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = normalizeText(v);
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  return null;
}

function parseStar(v) {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.round(v);
    if (n >= 1 && n <= 5) return n;
  }
  const s = normalizeText(v);
  if (!s) return null;
  const starCount = (s.match(/[☆★]/g) || []).length;
  if (starCount >= 1 && starCount <= 5) return starCount;
  const m = s.match(/[1-5]/);
  if (m) return Number(m[0]);
  return null;
}

function splitInstructors(input) {
  const s = normalizeText(input)
    .replace(/[，、；;／/|]+/g, ",")
    .replace(/\s*,\s*/g, ",");
  if (!s) return [];
  return s
    .split(",")
    .map((x) => normalizeText(x))
    .filter(Boolean);
}

function cleanInstructorToken(token) {
  // 处理“张三等”这类写法：仅去掉末尾的“等”，不影响“等等/等价”这类极少见情况
  const s = normalizeText(token);
  // 常见的“空值占位”
  if (!s || s === "/" || s === "-" || s.toLowerCase() === "null") return "";
  return s.replace(/等$/g, "");
}

function canonicalInstructors(input) {
  const parts = splitInstructors(input).map(cleanInstructorToken).filter(Boolean);
  if (parts.length <= 1) return parts.join("");
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b, "zh-CN")).join("、");
}

function makeCourseKey(courseName, instructors) {
  return `${normalizeText(courseName)}__${canonicalInstructors(instructors)}`;
}

function mapRowToReview(raw, ctx) {
  const get = (...names) => {
    for (const n of names) {
      const v = raw[n];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };

  const courseName = normalizeText(get("课程名称", "课程名"));
  const instructorsRaw = normalizeText(get("任课老师", "任课教师", "教师", "老师"));
  const instructors = canonicalInstructors(instructorsRaw);
  const credits = parseNumber(get("学分"));
  const isDegreeCourse = parseBool(get("学位课"));
  const termRaw = normalizeText(get("学期", "开课学期"));
  const termParsed = normalizeTerm(termRaw);
  const term = termParsed.label;
  const courseCode = normalizeText(get("选课编号", "课程编号", "选课号", "编号"));
  const college = normalizeText(get("开课学院", "学院", "开课单位"));
  const value = parseStar(get("价值"));
  const passDifficulty = parseStar(get("及格难度"));
  const highScoreDifficulty = parseStar(get("高分难度"));
  const remark = normalizeMultilineText(get("备注", "备注（这里应该还有一列开课学院，记得帮我加上，没有数据的就暂时空着）", "备注（这里应该还有一列 开课学院，记得帮我加上，没有数据的就暂时空着）", "备注（这里应该还有一列开课学院，记得帮我加上，没有数据的就暂时空着） "));

  const problems = [];
  const warnings = [];
  if (!courseName) problems.push("缺少课程名称");
  let instructorsFinal = instructors;
  if (!instructorsFinal) {
    // 这类行仍然有价值（课程存在，但老师没填）。用占位符保留，避免整行丢失。
    instructorsFinal = "（未填写老师）";
    warnings.push("任课老师缺失，已用占位符");
  }
  if (!term) problems.push("缺少学期");
  if (!credits && credits !== 0) problems.push("缺少学分");
  if (isDegreeCourse === null) problems.push("学位课不是 是/否");
  // 星级：对“缺失/不规范”更宽容，尽量保留数据（默认 3 星）
  const valueFinal = value ?? 3;
  const passDifficultyFinal = passDifficulty ?? 3;
  const highScoreDifficultyFinal = highScoreDifficulty ?? 3;
  if (!value) warnings.push("价值星级缺失/不规范，已默认 3");
  if (!passDifficulty) warnings.push("及格难度星级缺失/不规范，已默认 3");
  if (!highScoreDifficulty) warnings.push("高分难度星级缺失/不规范，已默认 3");

  for (const w of termParsed.warnings) warnings.push(`学期：${w}`);

  if (problems.length) {
    return {
      ok: false,
      problems,
      warnings,
      ctx,
      sample: { courseName, instructorsRaw, term },
    };
  }

  return {
    ok: true,
    review: {
      id: ctx.id,
      courseCode: courseCode || undefined,
      courseName,
      instructors: instructorsFinal, // 已做“等”清洗 + 归一化排序（缺失用占位符）
      credits,
      isDegreeCourse,
      term,
      college: college || undefined,
      value: valueFinal,
      passDifficulty: passDifficultyFinal,
      highScoreDifficulty: highScoreDifficultyFinal,
      remark: remark || undefined,
    },
    warnings,
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`找不到输入文件：${INPUT}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(INPUT, { cellText: false, cellDates: true });
  const all = [];
  const errors = [];
  const warnings = [];

  let nextId = 1;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // Read with first row as headers
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (!rawRows.length) continue;

    // Normalize headers once per row by creating remapped object
    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const remapped = {};
      for (const [k, v] of Object.entries(raw)) {
        remapped[normalizeHeader(k)] = v;
      }

      const ctx = { sheetName, rowIndex: i + 2, id: nextId }; // +2: header row + 1-based
      const r = mapRowToReview(remapped, ctx);
      if (r.ok) {
        all.push(r.review);
        if (r.warnings?.length) warnings.push({ ctx, warnings: r.warnings, sample: { courseName: r.review.courseName, instructors: r.review.instructors, term: r.review.term } });
        nextId += 1;
      } else {
        errors.push(r);
      }
    }
  }

  // Basic de-dup: if same courseName+instructors+term+remark, keep first
  const seen = new Set();
  const deduped = [];
  for (const r of all) {
    const key = `${makeCourseKey(r.courseName, r.instructors)}__${normalizeText(r.term)}__${normalizeText(r.remark ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  const banner = `// This file is auto-generated by scripts/import-xlsx.mjs
// Source: src/data/reviews_MESA2021.xlsx
// DO NOT EDIT MANUALLY.
`;

  const out = `${banner}
import type { ReviewRow } from "./reviews";

export const REVIEWS: ReviewRow[] = ${JSON.stringify(deduped, null, 2)} as unknown as ReviewRow[];
`;

  fs.writeFileSync(OUTPUT, out, "utf8");

  console.log(`✅ 已生成：${path.relative(ROOT, OUTPUT)}`);
  console.log(`- 读取到评价：${all.length}`);
  console.log(`- 去重后评价：${deduped.length}`);
  console.log(`- 跳过（不规范/缺字段）：${errors.length}`);
  console.log(`- 警告（已自动修复/容错）：${warnings.length}`);

  if (errors.length) {
    console.log("\n--- 跳过示例（前 10 条）---");
    for (const e of errors.slice(0, 10)) {
      console.log(
        `sheet=${e.ctx.sheetName} row=${e.ctx.rowIndex} reasons=${e.problems.join("、")} sample=${JSON.stringify(
          e.sample,
        )}`,
      );
    }
    console.log("\n提示：可根据这些报错回头修表格，或让我增强解析规则。");
  }

  if (warnings.length) {
    console.log("\n--- 警告示例（前 10 条）---");
    for (const w of warnings.slice(0, 10)) {
      console.log(
        `sheet=${w.ctx.sheetName} row=${w.ctx.rowIndex} warnings=${w.warnings.join("、")} sample=${JSON.stringify(
          w.sample,
        )}`,
      );
    }
  }
}

main();


