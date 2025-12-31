import type { CourseGroup } from "./aggregate";
import { normalizeText } from "./normalize";
import { normalizeTerm, termSortKey, type TermSeason } from "./term";

export type SortKey =
  | "value_desc"
  | "pass_asc"
  | "highscore_asc"
  | "reviews_desc"
  | "name_asc";

export type Filters = {
  q: string;
  degree: "all" | "degree" | "non_degree";
  /** 秋/春/夏/未知（空字符串表示不过滤） */
  termSeason: "" | TermSeason;
  college: string; // exact match or ""
  minCredits: number; // 0 means no limit
  sort: SortKey;
};

export function defaultFilters(): Filters {
  return {
    q: "",
    degree: "all",
    termSeason: "",
    college: "",
    minCredits: 0,
    sort: "reviews_desc",
  };
}

export function getFacetValues(groups: CourseGroup[]) {
  const termSeasons = new Set<TermSeason>();
  const colleges = new Set<string>();
  let maxCredits = 0;
  let latestTermSort = -1;
  let latestTermLabel = "";
  for (const g of groups) {
    termSeasons.add(g.termSeason);
    for (const c of g.colleges) colleges.add(normalizeText(c));
    maxCredits = Math.max(maxCredits, g.creditsMax);

    for (const r of g.reviews) {
      const sk = termSortKey(r.term) ?? -1;
      if (sk > latestTermSort) {
        latestTermSort = sk;
        latestTermLabel = normalizeTerm(r.term).label || normalizeText(r.term);
      }
    }
  }

  const seasonOrder: Record<TermSeason, number> = { 秋: 1, 春: 2, 夏: 3, 未知: 99 };
  const termSeasonList = [...termSeasons].filter(Boolean);
  termSeasonList.sort((a, b) => (seasonOrder[a] ?? 99) - (seasonOrder[b] ?? 99));

  return {
    termSeasons: termSeasonList,
    colleges: [...colleges].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN")),
    maxCredits,
    latestTermLabel: normalizeText(latestTermLabel),
  };
}

function matchQuery(g: CourseGroup, q: string): boolean {
  const qq = normalizeText(q);
  if (!qq) return true;
  const hay = normalizeText(
    [
      g.courseName,
      g.instructorsCanonical,
      g.colleges.join(" "),
      g.reviews.map((r) => r.remark ?? "").join(" "),
    ].join(" "),
  );
  return hay.includes(qq);
}

export function applyFilters(groups: CourseGroup[], f: Filters): CourseGroup[] {
  const res = groups.filter((g) => {
    if (!matchQuery(g, f.q)) return false;
    if (f.degree === "degree" && !g.isDegreeCourseAny) return false;
    if (f.degree === "non_degree" && g.isDegreeCourseAny) return false;
    if (f.termSeason && g.termSeason !== f.termSeason) return false;
    if (f.college && !g.colleges.some((c) => normalizeText(c) === normalizeText(f.college))) return false;
    if (f.minCredits > 0 && g.creditsMax < f.minCredits) return false;
    return true;
  });

  res.sort((a, b) => {
    switch (f.sort) {
      case "value_desc":
        if (a.valueAvg !== b.valueAvg) return b.valueAvg - a.valueAvg;
        return b.reviewCount - a.reviewCount;
      case "pass_asc":
        if (a.passDifficultyAvg !== b.passDifficultyAvg) return a.passDifficultyAvg - b.passDifficultyAvg;
        return b.valueAvg - a.valueAvg;
      case "highscore_asc":
        if (a.highScoreDifficultyAvg !== b.highScoreDifficultyAvg)
          return a.highScoreDifficultyAvg - b.highScoreDifficultyAvg;
        return b.valueAvg - a.valueAvg;
      case "reviews_desc":
        if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
        return b.valueAvg - a.valueAvg;
      case "name_asc":
        return a.courseName.localeCompare(b.courseName, "zh-CN");
      default:
        return 0;
    }
  });

  return res;
}


