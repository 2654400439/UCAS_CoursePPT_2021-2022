import { useMemo, useState } from "react";
import type { CourseGroup } from "../lib/aggregate";
import { Badge } from "./Badge";
import { StarRating } from "./StarRating";
import { normalizeText } from "../lib/normalize";
import type { Percentiles } from "../lib/stats";

function valueAccentClass(valueAvg: number): string {
  if (valueAvg >= 4.5) return "from-emerald-400 to-emerald-600";
  if (valueAvg >= 3.8) return "from-sky-400 to-sky-600";
  if (valueAvg >= 3.0) return "from-amber-400 to-amber-600";
  return "from-rose-400 to-rose-600";
}

function PercentileBar({
  pct,
  tone = "neutral",
}: {
  pct: number | null;
  tone?: "good" | "warn" | "neutral";
}) {
  if (pct === null) return null;
  const cl =
    tone === "good"
      ? "bg-emerald-200"
      : tone === "warn"
        ? "bg-amber-200"
        : "bg-neutral-200";

  const p = Math.max(0, Math.min(100, pct));
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      <div className="relative mt-1 h-3 w-full overflow-hidden rounded-full border border-neutral-300 bg-neutral-100 shadow-inner">
        {/* ticks */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 h-full w-px bg-neutral-300"
            style={{ left: `${t}%` }}
            aria-hidden="true"
          />
        ))}

        <div className={`absolute left-0 top-0 h-full ${cl}`} style={{ width: `${p}%` }} />
        <div
          className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-neutral-800 shadow"
          style={{ left: `${p}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  pct,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  pct?: number | null;
  tone?: "good" | "warn" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1">
        <StarRating value={value} />
      </div>
      {hint ? <div className="mt-1 text-xs text-neutral-600">{hint}</div> : null}
      {pct !== undefined ? <PercentileBar pct={pct} tone={tone} /> : null}
    </div>
  );
}

function pctText(pct: number | null, tmpl: (p: number) => string): string | undefined {
  if (pct === null) return undefined;
  const p = Math.round(pct);
  return tmpl(p);
}

export function CourseCard({
  g,
  percentiles,
}: {
  g: CourseGroup;
  percentiles: Percentiles;
}) {
  const [open, setOpen] = useState(false);
  const [showDetailScores, setShowDetailScores] = useState(false);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (g.colleges.length) parts.push(g.colleges.join(" / "));
    if (g.creditsMax > 0) {
      parts.push(g.creditsMin === g.creditsMax ? `${g.creditsMax} 学分` : `${g.creditsMin}–${g.creditsMax} 学分`);
    }
    return parts.join(" · ");
  }, [g.colleges, g.creditsMin, g.creditsMax]);

  return (
    <div className="group relative rounded-2xl border border-neutral-200 bg-white shadow-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className={`pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${valueAccentClass(
          g.valueAvg,
        )}`}
        aria-hidden="true"
      />
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 rounded-2xl p-5 pl-6 text-left hover:bg-neutral-50 active:bg-neutral-50/70"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-neutral-900">{g.courseName}</h3>
            {g.isDegreeCourseAny && <Badge tone="good">学位课</Badge>}
            <Badge>{g.reviewCount} 条评价</Badge>
          </div>
          <div className="mt-1 truncate text-sm text-neutral-700">{g.instructorsCanonical}</div>
          {subtitle && <div className="mt-1 truncate text-xs text-neutral-600">{subtitle}</div>}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-neutral-600">综合价值</div>
          <div className="mt-1">
            <StarRating value={g.valueAvg} compact />
          </div>
          <div className="mt-2 text-xs text-neutral-500 transition group-hover:text-neutral-700">
            {open ? "收起" : "展开"}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-200 p-5 pt-4">
          <div className="sticky z-[1]" style={{ top: "var(--sticky-top)" }}>
            <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">综合评分（平均）</div>
                <div className="mt-1 text-xs text-neutral-600">
                  综合价值用于排序与颜色条展示；单条评价分数默认收起，重点看备注内容。
                </div>
              </div>
              <button
                onClick={() => setShowDetailScores((v) => !v)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm hover:bg-neutral-50 hover:shadow active:bg-neutral-50/70"
              >
                {showDetailScores ? "隐藏单条分数" : "显示单条分数"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Metric
                label="价值"
                value={g.valueAvg}
                hint={pctText(percentiles.valuePctHigherBetter(g.valueAvg), (p) => `超过 ${p}% 的课程`)}
                pct={percentiles.valuePctHigherBetter(g.valueAvg)}
                tone="good"
              />
              <Metric
                label="及格难度（越低越容易）"
                value={g.passDifficultyAvg}
                hint={pctText(percentiles.passEasePctHigherBetter(g.passDifficultyAvg), (p) => `比 ${p}% 的课程更容易及格`)}
                pct={percentiles.passEasePctHigherBetter(g.passDifficultyAvg)}
                tone="warn"
              />
              <Metric
                label="高分难度（越低越容易）"
                value={g.highScoreDifficultyAvg}
                hint={pctText(
                  percentiles.highScoreEasePctHigherBetter(g.highScoreDifficultyAvg),
                  (p) => `比 ${p}% 的课程更容易拿高分`,
                )}
                pct={percentiles.highScoreEasePctHigherBetter(g.highScoreDifficultyAvg)}
                tone="warn"
              />
            </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-neutral-900">评价列表</div>
              <div className="text-xs text-neutral-600">优先阅读每条“备注”，这是最有信息量的部分。</div>
            </div>
            <div className="mt-2 space-y-3">
              {g.reviews.map((r) => (
                <div key={`${g.key}_${r.id}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-neutral-900">{normalizeText(r.term)}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.isDegreeCourse && <Badge tone="good">学位课</Badge>}
                      {r.credits ? <Badge>{r.credits} 学分</Badge> : null}
                      {normalizeText(r.college ?? "") ? <Badge>{normalizeText(r.college ?? "")}</Badge> : null}
                    </div>
                  </div>

                  {String(r.remark ?? "").trim() && (
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
                      {String(r.remark ?? "").trim()}
                    </div>
                  )}

                  {showDetailScores && (
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-xs text-neutral-600">价值</div>
                        <div className="mt-1">
                          <StarRating value={r.value} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-xs text-neutral-600">及格难度</div>
                        <div className="mt-1">
                          <StarRating value={r.passDifficulty} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-xs text-neutral-600">高分难度</div>
                        <div className="mt-1">
                          <StarRating value={r.highScoreDifficulty} />
                        </div>
                      </div>
                    </div>
                  )}

                  {normalizeText(r.courseCode ?? "") && (
                    <div className="mt-3 text-xs text-neutral-500">选课编号：{normalizeText(r.courseCode ?? "")}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


