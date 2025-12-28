import { useMemo, useState } from "react";
import { REVIEWS } from "./data/reviews";
import { aggregateCourses } from "./lib/aggregate";
import { applyFilters, defaultFilters, getFacetValues } from "./lib/filter";
import { FiltersBar } from "./components/FiltersBar";
import { CourseCard } from "./components/CourseCard";
import { Badge } from "./components/Badge";
import { buildPercentiles } from "./lib/stats";

function ValueLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
      <span className="font-medium text-neutral-700">颜色条=综合价值</span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-6 rounded-full bg-gradient-to-r from-rose-400 to-rose-600" aria-hidden="true" />
        <span>偏低</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-600" aria-hidden="true" />
        <span>中等</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-6 rounded-full bg-gradient-to-r from-sky-400 to-sky-600" aria-hidden="true" />
        <span>较高</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" aria-hidden="true" />
        <span>很高</span>
      </span>
    </div>
  );
}

export default function App() {
  const groups = useMemo(() => aggregateCourses(REVIEWS), []);
  const facets = useMemo(() => getFacetValues(groups), [groups]);
  const latestTerm = facets.terms[0] ?? "";
  const percentiles = useMemo(() => buildPercentiles(groups), [groups]);

  const [filters, setFilters] = useState(defaultFilters());
  const filtered = useMemo(() => applyFilters(groups, filters), [groups, filters]);

  return (
    <div className="min-h-screen bg-neutral-50 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(59,130,246,.12),transparent_55%),radial-gradient(900px_circle_at_80%_-10%,rgba(236,72,153,.10),transparent_55%)]">
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
                国科大课程评价
              </div>
              <div className="mt-1 text-sm text-neutral-700">
                帮你在选课前快速了解：这门课<strong className="font-semibold">值不值得</strong>、<strong className="font-semibold">难不难</strong>、以及学长学姐的真实备注。
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                用法：上方搜索/筛选 → 点击课程卡片展开 → 先看综合评分，再看每条备注。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{groups.length} 门课</Badge>
              <Badge>{REVIEWS.length} 条评价</Badge>
              {latestTerm ? <Badge>最新学期：{latestTerm}</Badge> : null}
              <a
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
                href="https://github.com/"
                target="_blank"
                rel="noreferrer"
                title="后续你可以改成你的仓库地址"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-3">
            <ValueLegend />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <FiltersBar filters={filters} setFilters={setFilters} facets={facets} />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-neutral-700">
            当前结果：<span className="font-semibold text-neutral-900">{filtered.length}</span> 门课
          </div>
          <div className="text-xs text-neutral-500">
            提示：点击课程卡片可展开查看该课在不同学期/不同同学的评价。
          </div>
        </div>

        <div className="space-y-4">
          {filtered.map((g) => (
            <CourseCard key={g.key} g={g} percentiles={percentiles} stickyTopClass="top-24" />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-700 shadow-soft">
            没有匹配结果。试试清空筛选或换个关键词。
          </div>
        )}

        <footer className="mt-10 border-t border-neutral-200 py-8 text-xs text-neutral-500">
          <div className="leading-relaxed">
            说明：本站为静态展示，用于帮助选课决策；评价具有主观性，仅供参考。
            <br />
            后续接入在线表格时，可把数据源替换为远程 JSON/CSV（不涉及登录与提交）。
          </div>
        </footer>
      </main>
    </div>
  );
}


