import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const ROOT = process.cwd();

const INPUT = path.join(ROOT, "src", "data", "reviews_MESA2021.xlsx");
const OUTPUT = path.join(ROOT, "src", "data", "reviews.generated.ts");
const DATA_DIR = path.join(ROOT, "src", "data");

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

function normalizeCollegeText(s) {
  // Some sources contain stray spaces inside CN words, e.g. "数 学科学学院".
  return normalizeText(s).replace(/\s+/g, "");
}

function normalizeCourseCodeForLookup(code) {
  const c = normalizeText(code);
  if (!c) return [];
  const res = [c];
  const base = c.split("-")[0];
  if (base && base !== c) res.push(base);
  return res;
}

function buildCourseMetaMapsFromCoursesCsv() {
  const byCode = new Map();
  const byName = new Map();

  const file = path.join(DATA_DIR, "courses.csv");
  if (!fs.existsSync(file)) return { byCode, byName, file, count: 0 };

  const text = fs.readFileSync(file, "utf8");
  const lines = stripBOM(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => String(l ?? "").trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split(",");
    // courses.csv:
    // - legacy: 课程编号,课程名称,任课教师
    // - current: 课程编号,课程名称,任课教师,开课学院
    if (parts.length < 3) continue;

    const code = normalizeText(parts[0]);
    const name = normalizeText(parts[1]);
    const instructors = parts.length >= 4 ? normalizeText(parts.slice(2, -1).join(",")) : normalizeText(parts.slice(2).join(","));
    const college = parts.length >= 4 ? normalizeCollegeText(parts[parts.length - 1]) : "";

    if (!code || !name) continue;

    if (!byCode.has(code)) byCode.set(code, { instructors, college });
    if (!byName.has(name)) byName.set(name, { instructors, college });
  }

  return { byCode, byName, file, count: lines.length };
}

function fillCollegeFromCourseMeta(reviews, courseMeta) {
  let filled = 0;
  let already = 0;
  let missing = 0;

  for (const r of reviews) {
    const existing = normalizeCollegeText(r.college ?? "");
    if (existing) {
      if (r.college !== existing) r.college = existing;
      already += 1;
      continue;
    }

    let hit = null;
    for (const cc of normalizeCourseCodeForLookup(r.courseCode ?? "")) {
      const m = courseMeta.byCode.get(cc);
      if (m?.college) {
        hit = m;
        break;
      }
    }
    if (!hit) {
      const nameKey = normalizeText(r.courseName);
      const m = courseMeta.byName.get(nameKey);
      if (m?.college) hit = m;
    }

    if (hit?.college) {
      r.college = hit.college;
      filled += 1;
    } else {
      missing += 1;
    }
  }

  return { filled, already, missing };
}

function stripBOM(s) {
  const x = String(s ?? "");
  return x.charCodeAt(0) === 0xfeff ? x.slice(1) : x;
}

// Minimal RFC4180-ish CSV parser (handles quotes + commas + newlines inside quotes).
function parseCSV(text) {
  const s = stripBOM(String(text ?? "")).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      // Skip trailing completely empty lines
      if (row.some((x) => String(x ?? "") !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((x) => String(x ?? "") !== "")) rows.push(row);
  return rows;
}

function findWjPastedTSVColumnIndex(headerCells) {
  const norm = headerCells.map((h) => normalizeHeader(h));
  // Known: "2.粘贴提交内容"
  let idx = norm.findIndex((h) => h.includes("粘贴提交内容"));
  if (idx >= 0) return idx;
  idx = norm.findIndex((h) => h.includes("粘贴") && h.includes("提交"));
  if (idx >= 0) return idx;
  return -1;
}

function normalizePastedTSV(raw) {
  let s = String(raw ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Some exports may collapse row line-breaks into spaces (or even remove the delimiter),
  // so the whole TSV becomes a single long line: header + many course rows.
  // Recover by inserting '\n' before each "courseCode<TAB>" token.
  // Heuristic: courseCode is usually long alnum with optional "-<class>" suffix.
  if (s.includes("课程编码") && !s.includes("\n")) {
    const m = s.match(/([0-9A-Za-z]{10,}(?:-[0-9A-Za-z]+)?)\t/);
    if (m && typeof m.index === "number") {
      const firstIdx = m.index;
      const headerPart = s.slice(0, firstIdx).trimEnd();
      let rest = s.slice(firstIdx);
      // Insert newline before every courseCode<TAB> (including the first one), then drop leading newline.
      rest = rest.replace(/\s*([0-9A-Za-z]{10,}(?:-[0-9A-Za-z]+)?)\t/g, "\n$1\t").replace(/^\n/, "");
      s = `${headerPart}\n${rest}`;
    }
  }
  return s.trim();
}

function parseExportedTSVToReviews(tsvText, ctxBase, getNextId) {
  const warnings = [];
  const errors = [];
  const reviews = [];

  const s = normalizePastedTSV(tsvText);
  if (!s) return { reviews, warnings, errors };

  const lines = s
    .split("\n")
    .map((l) => String(l ?? "").trimEnd())
    .filter((l) => l.trim() !== "");

  if (!lines.length) return { reviews, warnings, errors };

  const splitTabs = (line) => String(line ?? "").split("\t").map((x) => String(x ?? ""));

  // Header row: should start with 课程编码\t课程名称...
  const headerCells = splitTabs(lines[0]).map((x) => normalizeText(x));
  const hasHeader = headerCells.length >= 8 && normalizeText(headerCells[0]) === "课程编码";
  const start = hasHeader ? 1 : 0;
  if (!hasHeader) warnings.push({ ctx: ctxBase, warnings: ["TSV 未识别到表头：将按固定列顺序解析"], sample: { preview: headerCells.slice(0, 5).join(" | ") } });

  for (let i = start; i < lines.length; i++) {
    const cells = splitTabs(lines[i]);
    // Fixed order (exportTSV):
    // 0 课程编码,1 课程名称,2 任课老师,3 学分,4 学位课,5 学期,6 价值,7 及格难度,8 高分难度,9 备注
    if (cells.length < 6) continue;

    const courseCode = normalizeText(cells[0]);
    const courseName = normalizeText(cells[1]);
    const instructors = normalizeText(cells[2]);
    const credits = normalizeText(cells[3]);
    const isDegreeCourse = normalizeText(cells[4]);
    const term = normalizeText(cells[5]);
    const value = normalizeText(cells[6]);
    const passDifficulty = normalizeText(cells[7]);
    const highScoreDifficulty = normalizeText(cells[8]);
    const remarkRaw = cells.slice(9).join("\t"); // be tolerant if extra tabs exist
    const remark = String(remarkRaw ?? "").replace(/\\\\n/g, "\n"); // undo export escaping

    const remapped = {
      课程编号: courseCode,
      课程名称: courseName,
      任课老师: instructors,
      学分: credits,
      学位课: isDegreeCourse,
      学期: term,
      价值: value,
      及格难度: passDifficulty,
      高分难度: highScoreDifficulty,
      备注: remark,
      开课学院: "",
    };

    const ctx = { ...ctxBase, rowIndex: i + 1, id: getNextId() };
    const r = mapRowToReview(remapped, ctx);
    if (r.ok) {
      reviews.push(r.review);
      if (r.warnings?.length) warnings.push({ ctx, warnings: r.warnings, sample: { courseName: r.review.courseName, instructors: r.review.instructors, term: r.review.term } });
    } else {
      errors.push(r);
    }
  }

  return { reviews, warnings, errors };
}

function listWjExportCsvFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const res = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules") continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".csv")) {
        // exclude internal mapping file
        if (ent.name === "courses.csv") continue;
        // questionnaire export convention: numeric prefix (e.g. 25421061_*.csv)
        if (!/^\d{6,}_/.test(ent.name)) continue;
        res.push(full);
      }
    }
  };
  walk(DATA_DIR);
  return res.sort();
}

function importWjCsvExports(getNextId) {
  const files = listWjExportCsvFiles();
  const imported = [];
  const warnings = [];
  const errors = [];

  for (const file of files) {
    const csvText = fs.readFileSync(file, "utf8");
    const rows = parseCSV(csvText);
    if (!rows.length) continue;

    const header = rows[0];
    const tsvCol = findWjPastedTSVColumnIndex(header);
    if (tsvCol < 0) {
      warnings.push({ ctx: { sheetName: `csv:${path.relative(DATA_DIR, file)}`, rowIndex: 1, id: -1 }, warnings: ["未找到“粘贴提交内容”列：跳过该 CSV 文件"], sample: { headers: header.slice(0, 8).join(",") } });
      continue;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const tsv = row?.[tsvCol];
      if (!normalizeText(tsv)) continue;
      const ctxBase = { sheetName: `csv:${path.relative(DATA_DIR, file)}`, rowIndex: i + 1 };
      const r = parseExportedTSVToReviews(tsv, ctxBase, getNextId);
      imported.push(...r.reviews);
      warnings.push(...r.warnings);
      errors.push(...r.errors);
    }
  }

  return { files, imported, warnings, errors };
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
  const college = normalizeCollegeText(get("开课学院", "学院", "开课单位"));
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
  const getNextId = () => nextId++;

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

      const ctx = { sheetName, rowIndex: i + 2, id: getNextId() }; // +2: header row + 1-based
      const r = mapRowToReview(remapped, ctx);
      if (r.ok) {
        all.push(r.review);
        if (r.warnings?.length) warnings.push({ ctx, warnings: r.warnings, sample: { courseName: r.review.courseName, instructors: r.review.instructors, term: r.review.term } });
      } else {
        errors.push(r);
      }
    }
  }

  // Import additional Tencent Questionnaire CSV exports (if any)
  const wj = importWjCsvExports(getNextId);
  for (const r of wj.imported) all.push(r);
  for (const e of wj.errors) errors.push(e);
  for (const w of wj.warnings) warnings.push(w);

  // Fill missing colleges from courses.csv mapping (best-effort)
  const courseMeta = buildCourseMetaMapsFromCoursesCsv();
  const fillStats = fillCollegeFromCourseMeta(all, courseMeta);

  // De-dup: if same course+term+ratings+remark, keep first (xlsx first, then CSV exports)
  const seen = new Set();
  const deduped = [];
  for (const r of all) {
    const key = [
      makeCourseKey(r.courseName, r.instructors),
      normalizeText(r.term),
      normalizeText(r.courseCode ?? ""),
      String(r.credits ?? ""),
      r.isDegreeCourse ? "1" : "0",
      String(r.value),
      String(r.passDifficulty),
      String(r.highScoreDifficulty),
      normalizeText(r.remark ?? ""),
    ].join("__");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  const banner = `// This file is auto-generated by scripts/import-xlsx.mjs
// Sources:
// - src/data/reviews_MESA2021.xlsx
// - src/data/<问卷导出>/**/*.csv (column contains "粘贴提交内容")
// DO NOT EDIT MANUALLY.
`;

  const out = `${banner}
import type { ReviewRow } from "./reviews";

export const REVIEWS: ReviewRow[] = ${JSON.stringify(deduped, null, 2)} as unknown as ReviewRow[];
`;

  fs.writeFileSync(OUTPUT, out, "utf8");

  console.log(`✅ 已生成：${path.relative(ROOT, OUTPUT)}`);
  console.log(`- 读取到评价（xlsx + csv）：${all.length}`);
  console.log(`- 去重后评价：${deduped.length}`);
  console.log(`- 跳过（不规范/缺字段）：${errors.length}`);
  console.log(`- 警告（已自动修复/容错）：${warnings.length}`);
  console.log(`- 开课学院补齐：新增 ${fillStats.filled} / 原本已有 ${fillStats.already} / 仍缺失 ${fillStats.missing}`);
  if (courseMeta.count) console.log(`- courses.csv 映射：${courseMeta.count} 行（${path.relative(ROOT, courseMeta.file)}）`);
  if (wj.files?.length) {
    console.log(`- 问卷 CSV 文件：${wj.files.length}`);
    console.log(`- 问卷 CSV 导入评价：${wj.imported.length}`);
  }

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


