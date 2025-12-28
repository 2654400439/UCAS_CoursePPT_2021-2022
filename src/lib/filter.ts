import type { CourseGroup } from "./aggregate";
import { normalizeText } from "./normalize";
import { termSortKey } from "./term";

export type SortKey =
  | "value_desc"
  | "pass_asc"
  | "highscore_asc"
  | "reviews_desc"
  | "name_asc";

export type Filters = {
  q: string;
  degree: "all" | "degree" | "non_degree";
  term: string; // exact match or ""
  college: string; // exact match or ""
  minCredits: number; // 0 means no limit
  sort: SortKey;
};

export function defaultFilters(): Filters {
  return {
    q: "",
    degree: "all",
    term: "",
    college: "",
    minCredits: 0,
    sort: "value_desc",
  };
}

export function getFacetValues(groups: CourseGroup[]) {
  const terms = new Set<string>();
  const colleges = new Set<string>();
  let maxCredits = 0;
  for (const g of groups) {
    for (const t of g.terms) terms.add(normalizeText(t));
    for (const c of g.colleges) colleges.add(normalizeText(c));
    maxCredits = Math.max(maxCredits, g.creditsMax);
  }

  const termList = [...terms].filter(Boolean);
  termList.sort((a, b) => {
    const sa = termSortKey(a) ?? -1;
    const sb = termSortKey(b) ?? -1;
    if (sa !== sb) return sb - sa; // newest first
    return b.localeCompare(a, "zh-CN");
  });

  return {
    terms: termList,
    colleges: [...colleges].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN")),
    maxCredits,
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
    if (f.term && !g.terms.some((t) => normalizeText(t) === normalizeText(f.term))) return false;
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


