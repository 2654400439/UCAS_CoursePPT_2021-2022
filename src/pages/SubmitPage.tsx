import { useEffect, useMemo, useState } from "react";
import type { Star } from "../data/reviews";
import { normalizeText } from "../lib/normalize";
import { REVIEW_SUBMIT_URL } from "../config";
import step1Img from "../data/pic/step1.png";
import step2Img from "../data/pic/step2.png";
import step3Img from "../data/pic/step3.png";
import step4Img from "../data/pic/step4.png";
import step5Img from "../data/pic/step5.png";
import step1Webp from "../data/pic/step1.webp";
import step2Webp from "../data/pic/step2.webp";
import step3Webp from "../data/pic/step3.webp";
import step4Webp from "../data/pic/step4.webp";
import step5Webp from "../data/pic/step5.webp";
import coursesCsvRaw from "../data/courses.csv?raw";

type ParsedCourseRow = {
  courseCode?: string;
  courseName: string;
  credits: number;
  isDegreeCourse: boolean;
  term: string;
};

type DraftReview = ParsedCourseRow & {
  _id: string;
  instructors: string;
  value: Star;
  passDifficulty: Star;
  highScoreDifficulty: Star;
  remark: string;
  collapsed: boolean;
};

function toStar(n: number): Star {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return Math.round(n) as Star;
}

function parseBoolCN(s: string): boolean {
  const x = normalizeText(s);
  return x === "是" || x.toLowerCase() === "yes" || x === "Y" || x === "y" || x === "1" || x === "true";
}

function parseCredits(s: string): number {
  const x = normalizeText(s).replace(/,/g, "");
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function splitLines(raw: string): string[] {
  return String(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00A0/g, " ").trimEnd());
}

function uniqJoinCN(a: string, b: string): string {
  const A = normalizeText(a);
  const B = normalizeText(b);
  if (!A) return B;
  if (!B) return A;
  if (A === B) return A;
  const parts = new Set([...A.split("、"), ...B.split("、")].map((x) => normalizeText(x)).filter(Boolean));
  return [...parts].join("、");
}

function buildInstructorMaps(csvText: string): {
  byCode: Map<string, string>;
  byName: Map<string, string>;
} {
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  const lines = splitLines(csvText).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split(",");
    // courses.csv:
    // - legacy: 课程编号,课程名称,任课教师
    // - current: 课程编号,课程名称,任课教师,开课学院
    if (parts.length < 3) continue;
    const code = normalizeText(parts[0]);
    const name = normalizeText(parts[1]);
    const instructor =
      parts.length >= 4
        ? normalizeText(parts.slice(2, -1).join(","))
        : normalizeText(parts.slice(2).join(","));
    if (!code || !name || !instructor) continue;

    const prevCode = byCode.get(code);
    byCode.set(code, prevCode ? uniqJoinCN(prevCode, instructor) : instructor);

    const prevName = byName.get(name);
    byName.set(name, prevName ? uniqJoinCN(prevName, instructor) : instructor);
  }

  return { byCode, byName };
}

function normalizeCourseCodeForLookup(code: string): string[] {
  const c = normalizeText(code);
  if (!c) return [];
  const res = [c];
  const base = c.split("-")[0];
  if (base && base !== c) res.push(base);
  return res;
}

/**
 * Parse TSV copied from UCAS course selection table.
 * Expected header includes (CN):
 * 序号, 课程编码, 课程名称, 学分, 学位课, 学期, 考试时间
 */
function parseSelectedCoursesTSV(raw: string): { rows: ParsedCourseRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = splitLines(raw).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], warnings: ["没有检测到任何内容"] };

  const cells = (line: string) => line.split("\t").map((x) => normalizeText(x));
  const header = cells(lines[0]);

  const idx = (name: string) => header.findIndex((h) => normalizeText(h) === name);
  const courseCodeIdx = idx("课程编码");
  const courseNameIdx = idx("课程名称");
  const creditsIdx = idx("学分");
  const degreeIdx = idx("学位课");
  const termIdx = idx("学期");

  const hasHeader = courseNameIdx >= 0 && creditsIdx >= 0 && termIdx >= 0;
  const startLine = hasHeader ? 1 : 0;
  if (!hasHeader) warnings.push("未识别到表头（课程名称/学分/学期）。将按列顺序尝试解析。");

  const rows: ParsedCourseRow[] = [];
  for (let i = startLine; i < lines.length; i++) {
    const row = cells(lines[i]);
    if (row.every((x) => !x)) continue;

    const get = (j: number, fallback: string = "") => (j >= 0 && j < row.length ? row[j] : fallback);

    // Fallback indices (based on typical column order):
    // 0 序号, 1 课程编码, 2 课程名称, 3 学分, 4 学位课, 5 学期, 6 考试时间
    const cc = normalizeText(get(courseCodeIdx >= 0 ? courseCodeIdx : 1));
    const cn = normalizeText(get(courseNameIdx >= 0 ? courseNameIdx : 2));
    const cr = parseCredits(get(creditsIdx >= 0 ? creditsIdx : 3));
    const dg = parseBoolCN(get(degreeIdx >= 0 ? degreeIdx : 4));
    const tm = normalizeText(get(termIdx >= 0 ? termIdx : 5));

    if (!cn) continue;
    rows.push({
      courseCode: cc || undefined,
      courseName: cn,
      credits: cr,
      isDegreeCourse: dg,
      term: tm,
    });
  }

  if (rows.length === 0) warnings.push("解析结果为空：请确认复制内容包含课程行（含课程名称/学期等列）");
  return { rows, warnings };
}

async function copyToClipboard(text: string): Promise<boolean> {
  const t = String(text ?? "");
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    // Fallback for older browsers / insecure context.
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StarSelect({
  value,
  onChange,
  label,
}: {
  value: Star;
  onChange: (v: Star) => void;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-neutral-600">{label}</span>
      <select
        className="w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-300 focus:shadow"
        value={value}
        onChange={(e) => onChange(toStar(Number(e.target.value)))}
      >
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={3}>3</option>
        <option value={4}>4</option>
        <option value={5}>5</option>
      </select>
    </label>
  );
}

export function SubmitPage() {
  const [tsv, setTsv] = useState("");
  const [parsed, setParsed] = useState<ParsedCourseRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftReview[]>([]);
  const [toast, setToast] = useState<string>("");
  const [gateMsg, setGateMsg] = useState<string>("");
  const [showGuide, setShowGuide] = useState(true);
  const [guideStep, setGuideStep] = useState(0);
  const [completionNudgeShown, setCompletionNudgeShown] = useState(false);

  const instructorMaps = useMemo(() => buildInstructorMaps(String(coursesCsvRaw ?? "")), []);

  const canParse = useMemo(() => normalizeText(tsv).length > 0, [tsv]);

  const parse = () => {
    const { rows, warnings } = parseSelectedCoursesTSV(tsv);
    setParsed(rows);
    setWarnings(warnings);
    setDrafts(
      rows.map((r, i) => ({
        ...r,
        _id: `${normalizeText(r.courseCode ?? "") || "noCode"}__${normalizeText(r.courseName)}__${normalizeText(r.term)}__${i}`,
        instructors: (() => {
          // 1) Prefer exact match by courseCode (also try stripping "-<class>" suffix)
          for (const cc of normalizeCourseCodeForLookup(r.courseCode ?? "")) {
            const hit = instructorMaps.byCode.get(cc);
            if (hit) return hit;
          }
          // 2) Fallback to exact match by courseName
          const name = normalizeText(r.courseName);
          return instructorMaps.byName.get(name) ?? "";
        })(),
        value: 4,
        passDifficulty: 3,
        highScoreDifficulty: 3,
        remark: "",
        collapsed: false,
      })),
    );
  };

  const activeDrafts = drafts;
  const completeCount = useMemo(() => {
    return activeDrafts.filter((d) => normalizeText(d.instructors) && normalizeText(d.remark)).length;
  }, [activeDrafts]);
  const allComplete = activeDrafts.length > 0 && completeCount === activeDrafts.length;
  const remainingCount = Math.max(0, activeDrafts.length - completeCount);

  useEffect(() => {
    if (!allComplete) {
      if (completionNudgeShown) setCompletionNudgeShown(false);
      return;
    }
    if (completionNudgeShown) return;
    setCompletionNudgeShown(true);
    setToast("已全部完成！下一步：点击上方“① 复制提交内容”→“② 去问卷提交”粘贴并提交。");
    window.setTimeout(() => setToast(""), 3500);
  }, [allComplete, completionNudgeShown]);

  const exportJSON = useMemo(() => {
    const rows = activeDrafts.map((d) => ({
      courseCode: d.courseCode ?? "",
      courseName: d.courseName,
      instructors: normalizeText(d.instructors),
      credits: d.credits,
      isDegreeCourse: d.isDegreeCourse,
      term: d.term,
      value: d.value,
      passDifficulty: d.passDifficulty,
      highScoreDifficulty: d.highScoreDifficulty,
      remark: d.remark,
    }));
    return JSON.stringify(rows, null, 2);
  }, [activeDrafts]);

  const exportTSV = useMemo(() => {
    const header = [
      "课程编码",
      "课程名称",
      "任课老师",
      "学分",
      "学位课",
      "学期",
      "价值(1-5)",
      "及格难度(1-5,低=易)",
      "高分难度(1-5,低=易)",
      "备注",
    ];
    const lines = [header.join("\t")];
    for (const d of activeDrafts) {
      lines.push(
        [
          d.courseCode ?? "",
          d.courseName,
          normalizeText(d.instructors),
          String(d.credits ?? ""),
          d.isDegreeCourse ? "是" : "否",
          d.term,
          String(d.value),
          String(d.passDifficulty),
          String(d.highScoreDifficulty),
          String(d.remark ?? "").replace(/\r?\n/g, "\\n"),
        ].join("\t"),
      );
    }
    return lines.join("\n");
  }, [activeDrafts]);

  async function onDownloadXlsx() {
    if (!allComplete) {
      setGateMsg(`还有 ${activeDrafts.length - completeCount} 门课未填写“任课老师”或“备注”。请先补齐后再导出。`);
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const rows = activeDrafts.map((d) => ({
        课程编码: d.courseCode ?? "",
        课程名称: d.courseName,
        任课老师: normalizeText(d.instructors),
        学分: d.credits,
        学位课: d.isDegreeCourse ? "是" : "否",
        学期: d.term,
        价值: d.value,
        及格难度: d.passDifficulty,
        高分难度: d.highScoreDifficulty,
        备注: d.remark ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "reviews");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob("ucas-course-reviews.xlsx", new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      setToast("已下载 Excel：ucas-course-reviews.xlsx");
      window.setTimeout(() => setToast(""), 2500);
    } catch {
      setToast("下载失败：请刷新页面重试（或改用“复制TSV/JSON”）");
      window.setTimeout(() => setToast(""), 3500);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl">批量填写课程评价</div>
          <div className="mt-1 text-sm text-neutral-600">
            第一步：去学校页面复制“已选课程”表格 → 粘贴到下面 → 自动生成可编辑的评价表格。
          </div>
        </div>
        <a
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
          href="#/"
        >
          返回首页
        </a>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-neutral-900">粘贴已选课程（TSV）</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              disabled={!canParse}
              onClick={parse}
            >
              解析生成表格
            </button>
            <button
              type="button"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
              onClick={() => {
                setTsv("");
                setParsed([]);
                setWarnings([]);
                setDrafts([]);
              }}
            >
              清空
            </button>
          </div>
        </div>

        <textarea
          value={tsv}
          onChange={(e) => setTsv(e.target.value)}
          placeholder={"把复制的表格直接粘贴到这里（包含表头也可以）\n例如：\n序号\t课程编码\t课程名称\t学分\t学位课\t学期\t考试时间\n1\t...\t...\t1.00\t是\t2023—2024学年(秋)第一学期\t查看"}
          className="mt-3 min-h-[140px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-900 outline-none shadow-inner focus:border-neutral-300"
        />

        {warnings.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="font-medium">提示</div>
            <ul className="mt-1 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {parsed.length > 0 ? (
        <div className="mt-6">
          <div className="rounded-2xl border border-neutral-200/80 bg-gradient-to-b from-neutral-50 to-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-full w-1 shrink-0 rounded-full bg-neutral-900/10" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">感谢你愿意分享课程体验！</div>
                <div className="mt-2 space-y-2 text-sm text-neutral-700">
              <div> - 建议：尽量客观、具体，避免人身攻击</div>
              <div>
                - 多老师请用 <span className="font-semibold">、</span> 分隔；不要写“等”（系统会做清洗，但你写得规范更好）。
              </div>
              <div>
                - <span className="font-semibold">价值</span>：这是“综合价值”评分：结合
                <span className="font-semibold">收获/课程质量/给分体验/投入产出比</span> 来评。建议也在“备注”里写一句你给这个分数的理由（最有帮助）。
              </div>
              <div>
                - <span className="font-semibold">备注</span>：例如：课程感受/上课形式/作业/考试/给分/闭坑建议/适合人群。
              </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lightweight progress hint (submit is placed at the bottom for a more natural flow) */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900">
              评价表格（{activeDrafts.length} 门课，已完成 {completeCount}）
            </div>
            {activeDrafts.length > 0 ? (
              <div className="text-xs text-neutral-600">
                {allComplete
                  ? "已全部完成：滚动到页面底部提交"
                  : `还差 ${remainingCount} 门课未填老师/备注，填完后可在页面底部提交`}
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-3">
            {drafts.map((d, idx) => (
              <div key={d._id} className="relative rounded-2xl border border-neutral-200 bg-white p-4 pl-5 shadow-soft">
                <div
                  className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-neutral-900/10"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700">
                        第 {idx + 1} 条
                      </span>
                      <div className="text-sm font-semibold text-neutral-900">{d.courseName}</div>
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      {d.term ? <span>{d.term}</span> : null}
                      {d.term ? <span className="mx-1">·</span> : null}
                      <span>{d.credits} 学分</span>
                      <span className="mx-1">·</span>
                      <span>{d.isDegreeCourse ? "学位课" : "非学位课"}</span>
                      {d.courseCode ? (
                        <>
                          <span className="mx-1">·</span>
                          <span className="text-neutral-500">编码：{d.courseCode}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
                      onClick={() =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], collapsed: !next[idx].collapsed };
                          return next;
                        })
                      }
                      title={d.collapsed ? "展开编辑" : "折叠"}
                    >
                      {d.collapsed ? "展开" : "折叠"}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                      onClick={() =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], collapsed: true };
                          return next;
                        })
                      }
                      title="确认这条评价，先折叠收起（你仍可再展开修改）"
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                      onClick={() => {
                        setDrafts((cur) => cur.filter((_, i) => i !== idx));
                        setParsed((cur) => cur.filter((_, i) => i !== idx));
                      }}
                      title="删除此课程（不评价/已评价过）"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {d.collapsed ? (
                  <div className="mt-3 text-xs text-neutral-600">
                    {normalizeText(d.instructors) ? (
                      <>
                        <span className="font-medium text-neutral-800">{normalizeText(d.instructors)}</span>
                        <span className="mx-1">·</span>
                      </>
                    ) : (
                      <span className="text-amber-700">未填老师</span>
                    )}
                    {normalizeText(d.remark) ? (
                      <span>已填写备注</span>
                    ) : (
                      <span className="ml-2 text-amber-700">未填写备注</span>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
                  <label className="md:col-span-4">
                    <div className="text-[11px] text-neutral-600">任课老师（必填）</div>
                    <input
                      value={d.instructors}
                      onChange={(e) =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], instructors: e.target.value };
                          return next;
                        })
                      }
                      placeholder="例如：刘奇旭、刘潮歌"
                      className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-300 focus:shadow"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2 md:col-span-5">
                    <StarSelect
                      label="价值"
                      value={d.value}
                      onChange={(v) =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], value: v };
                          return next;
                        })
                      }
                    />
                    <StarSelect
                      label="及格难度（低=易）"
                      value={d.passDifficulty}
                      onChange={(v) =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], passDifficulty: v };
                          return next;
                        })
                      }
                    />
                    <StarSelect
                      label="高分难度（低=易）"
                      value={d.highScoreDifficulty}
                      onChange={(v) =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], highScoreDifficulty: v };
                          return next;
                        })
                      }
                    />
                  </div>

                  <label className="md:col-span-12">
                    <div className="text-[11px] text-neutral-600">备注（最重要）</div>
                    <textarea
                      value={d.remark}
                      onChange={(e) =>
                        setDrafts((cur) => {
                          const next = [...cur];
                          next[idx] = { ...next[idx], remark: e.target.value };
                          return next;
                        })
                      }
                      placeholder="课程感受/上课形式/作业/考试/给分/避坑建议/适合人群…（可换行）"
                      className="mt-1 min-h-[90px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none shadow-inner focus:border-neutral-300"
                    />
                  </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            说明：你可以把“下载的 Excel”或“复制的 TSV/JSON”上传到你后续提供的腾讯问卷/文档收集，以完成提交闭环。
          </div>
        </div>
      ) : null}

      {activeDrafts.length > 0 ? (
        <div
          className={`mt-6 rounded-2xl border p-4 shadow-soft ${
            allComplete ? "border-emerald-200 bg-emerald-50/60" : "border-neutral-200 bg-white"
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">最后一步：提交到问卷</div>
              <div className="mt-1 text-xs text-neutral-600">
                {allComplete
                  ? "你已经把下面所有课程都填完了。现在可以复制并提交。"
                  : `请先把下面所有课程的“任课老师”和“备注”补齐（还差 ${remainingCount} 门），完成后按钮会亮起。`}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                disabled={!allComplete}
                onClick={async () => {
                  if (!allComplete) {
                    setGateMsg(`还有 ${activeDrafts.length - completeCount} 门课未填写“任课老师”或“备注”。请先补齐后再复制。`);
                    return;
                  }
                  const ok = await copyToClipboard(exportTSV);
                  setToast(ok ? "已复制提交文本。下一步：打开问卷粘贴提交。" : "复制失败：请手动全选复制");
                  window.setTimeout(() => setToast(""), 2500);
                }}
              >
                ① 复制提交内容
              </button>

              <a
                className={`rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 ${
                  allComplete ? "" : "pointer-events-none opacity-50"
                }`}
                href={REVIEW_SUBMIT_URL}
                target="_blank"
                rel="noreferrer"
                title={allComplete ? "打开问卷并粘贴提交" : "请先把表格填完再提交"}
              >
                ② 去问卷提交
              </a>

              <button
                type="button"
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                disabled={!allComplete}
                onClick={onDownloadXlsx}
                title="备选：下载 Excel，后续可在问卷里作为附件上传"
              >
                下载 Excel（备选）
              </button>
            </div>
          </div>

          <div className="mt-3 text-sm text-neutral-800">
            <span className="font-medium">提交顺序：</span>点 <span className="font-semibold">①</span> 复制 → 点{" "}
            <span className="font-semibold">②</span> 打开问卷 → 粘贴并提交。
          </div>

          <details className="mt-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-neutral-900">为什么不能在本站直接“一键提交”？</summary>
            <div className="mt-2 text-sm text-neutral-700">
              目前本站是<strong className="font-semibold">纯静态站</strong>（无后端、无账号系统），不收集登录信息，也不在站内保存隐私数据。
              <br />
              “直接提交”需要服务器接收并保存数据（还要处理反垃圾/安全/合规），维护成本会显著上升。
              <br />
              所以现阶段用<strong className="font-semibold">问卷/附件</strong>作为收集入口：对同学更方便，也能减少隐私顾虑。
            </div>
          </details>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white/95 p-3 text-center text-sm text-neutral-900 shadow-xl backdrop-blur">
          {toast}
        </div>
      ) : null}

      {gateMsg ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold text-neutral-900">还差一步</div>
            <div className="mt-2 text-sm text-neutral-700">{gateMsg}</div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                onClick={() => setGateMsg("")}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showGuide ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="border-b border-neutral-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-neutral-900">如何获取“已选课程”并复制到这里</div>
                  <div className="mt-1 text-sm text-neutral-600">跟着做一遍就行（共 5 步，看完才能关闭）</div>
                </div>
                <div className="text-sm text-neutral-600">
                  {guideStep + 1} / 5
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                <picture>
                  <source type="image/webp" srcSet={[step1Webp, step2Webp, step3Webp, step4Webp, step5Webp][guideStep]} />
                  <img
                    src={[step1Img, step2Img, step3Img, step4Img, step5Img][guideStep]}
                    alt={`引导步骤 ${guideStep + 1}`}
                    className="h-auto w-full select-none"
                    draggable={false}
                    decoding="async"
                  />
                </picture>
              </div>

              <div className="mt-4 space-y-2 text-sm text-neutral-800">
                {guideStep === 0 ? (
                  <div>
                    1）先打开 SEP：{" "}
                    <a className="font-medium text-neutral-900 underline" href="https://sep.ucas.ac.cn/" target="_blank" rel="noreferrer">
                      https://sep.ucas.ac.cn/
                    </a>{" "}
                    ，登录你的账号。
                  </div>
                ) : null}
                {guideStep === 1 ? <div>2）登录后，找到并点击“选课系统”。</div> : null}
                {guideStep === 2 ? <div>3）进入选课系统后，在左侧菜单里点“已选课程”。</div> : null}
                {guideStep === 3 ? (
                  <div>
                    4）到了“已选课程”列表页面后，按图示方式把表格内容<strong className="font-semibold">全部选中</strong>，然后复制（Ctrl+C）。
                  </div>
                ) : null}
                {guideStep === 4 ? (
                  <div>
                    5）回到本页，把复制的内容粘贴到上面的输入框，点击<strong className="font-semibold">“解析生成表格”</strong>，就能在下方快速填写评价了。
                    <span className="ml-1">全部填完后，点右上角<strong className="font-semibold">“复制提交内容”</strong>→<strong className="font-semibold">“去问卷提交”</strong>。</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                  disabled={guideStep === 0}
                  onClick={() => setGuideStep((s) => Math.max(0, s - 1))}
                >
                  上一步
                </button>

                <div className="flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-6 rounded-full ${
                        i <= guideStep ? "bg-neutral-900/60" : "bg-neutral-200"
                      }`}
                    />
                  ))}
                </div>

                {guideStep < 4 ? (
                  <button
                    type="button"
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                    onClick={() => setGuideStep((s) => Math.min(4, s + 1))}
                  >
                    下一步
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
                    onClick={() => setShowGuide(false)}
                  >
                    开始填写
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


