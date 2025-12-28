import { useMemo, useState } from "react";
import type { CourseGroup } from "../lib/aggregate";
import { Badge } from "./Badge";
import { StarRating } from "./StarRating";
import { normalizeText } from "../lib/normalize";

function valueAccentClass(valueAvg: number): string {
  if (valueAvg >= 4.5) return "from-emerald-400 to-emerald-600";
  if (valueAvg >= 3.8) return "from-sky-400 to-sky-600";
  if (valueAvg >= 3.0) return "from-amber-400 to-amber-600";
  return "from-rose-400 to-rose-600";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1">
        <StarRating value={value} />
      </div>
    </div>
  );
}

export function CourseCard({ g }: { g: CourseGroup }) {
  const [open, setOpen] = useState(false);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (g.colleges.length) parts.push(g.colleges.join(" / "));
    if (g.creditsMax > 0) {
      parts.push(g.creditsMin === g.creditsMax ? `${g.creditsMax} 学分` : `${g.creditsMin}–${g.creditsMax} 学分`);
    }
    return parts.join(" · ");
  }, [g.colleges, g.creditsMin, g.creditsMax]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg">
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Metric label="价值" value={g.valueAvg} />
            <Metric label="及格难度（越低越容易）" value={g.passDifficultyAvg} />
            <Metric label="高分难度（越低越容易）" value={g.highScoreDifficultyAvg} />
          </div>

          <div className="mt-4">
            <div className="text-xs text-neutral-600">评价列表</div>
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

                  {String(r.remark ?? "").trim() && (
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                      {String(r.remark ?? "").trim()}
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


