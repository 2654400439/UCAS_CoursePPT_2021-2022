import type { Filters, SortKey } from "../lib/filter";

export function FiltersBar({
  filters,
  setFilters,
  facets,
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  facets: { terms: string[]; colleges: string[]; maxCredits: number };
}) {
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "value_desc", label: "价值高优先" },
    { key: "pass_asc", label: "更容易及格" },
    { key: "highscore_asc", label: "更容易高分" },
    { key: "reviews_desc", label: "评价多优先" },
    { key: "name_asc", label: "课程名 A→Z" },
  ];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-soft backdrop-blur">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-5">
          <label className="text-xs text-neutral-600">搜索</label>
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="课程名 / 老师 / 学院 / 备注…"
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 shadow-sm focus:border-neutral-300 focus:shadow"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-neutral-600">学位课</label>
          <select
            value={filters.degree}
            onChange={(e) => setFilters({ ...filters, degree: e.target.value as Filters["degree"] })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
          >
            <option value="all">全部</option>
            <option value="degree">学位课</option>
            <option value="non_degree">非学位课</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-neutral-600">学期</label>
          <select
            value={filters.term}
            onChange={(e) => setFilters({ ...filters, term: e.target.value })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
          >
            <option value="">全部</option>
            {facets.terms.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-neutral-600">开课学院</label>
          <select
            value={filters.college}
            onChange={(e) => setFilters({ ...filters, college: e.target.value })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
          >
            <option value="">全部</option>
            {facets.colleges.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-neutral-600">最低学分（≥）</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={filters.minCredits}
            onChange={(e) => setFilters({ ...filters, minCredits: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-neutral-600">排序</label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 md:flex md:items-end">
          <button
            onClick={() =>
              setFilters({
                q: "",
                degree: "all",
                term: "",
                college: "",
                minCredits: 0,
                sort: "reviews_desc",
              })
            }
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm hover:bg-neutral-50 hover:shadow active:bg-neutral-50/70"
          >
            重置筛选
          </button>
        </div>
      </div>
    </div>
  );
}


