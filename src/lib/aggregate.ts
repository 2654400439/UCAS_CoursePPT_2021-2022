import type { ReviewRow, Star } from "../data/reviews";
import { canonicalInstructors, makeCourseKey, normalizeText } from "./normalize";
import { termSortKey } from "./term";

export type CourseGroup = {
  key: string;
  courseName: string;
  instructorsCanonical: string;
  colleges: string[];
  terms: string[];
  creditsMin: number;
  creditsMax: number;
  isDegreeCourseAny: boolean;
  reviewCount: number;
  valueAvg: number;
  passDifficultyAvg: number;
  highScoreDifficultyAvg: number;
  reviews: ReviewRow[];
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function clampStar(n: number): Star {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return Math.round(n) as Star;
}

export function aggregateCourses(rows: ReviewRow[]): CourseGroup[] {
  const byKey = new Map<string, ReviewRow[]>();
  for (const r of rows) {
    const courseName = normalizeText(r.courseName);
    const key = makeCourseKey(courseName, r.instructors);
    const list = byKey.get(key) ?? [];
    list.push({ ...r, courseName });
    byKey.set(key, list);
  }

  const groups: CourseGroup[] = [];
  for (const [key, reviews] of byKey.entries()) {
    const courseName = reviews[0]?.courseName ?? "";
    const instructorsCanonical = canonicalInstructors(reviews[0]?.instructors ?? "");

    const colleges = [...new Set(reviews.map((r) => normalizeText(r.college ?? "")).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "zh-CN"),
    );
    const terms = [...new Set(reviews.map((r) => normalizeText(r.term)))].filter(Boolean);
    const credits = reviews.map((r) => r.credits).filter((x) => Number.isFinite(x));

    // Stable sort inside group: newest-ish term first, then id desc
    const reviewsSorted = [...reviews].sort((a, b) => {
      const sa = termSortKey(a.term) ?? -1;
      const sb = termSortKey(b.term) ?? -1;
      if (sa !== sb) return sb - sa;
      const ta = normalizeText(a.term);
      const tb = normalizeText(b.term);
      if (ta !== tb) return tb.localeCompare(ta, "zh-CN");
      return (b.id ?? 0) - (a.id ?? 0);
    });

    groups.push({
      key,
      courseName,
      instructorsCanonical,
      colleges,
      terms,
      creditsMin: credits.length ? Math.min(...credits) : 0,
      creditsMax: credits.length ? Math.max(...credits) : 0,
      isDegreeCourseAny: reviews.some((r) => r.isDegreeCourse),
      reviewCount: reviews.length,
      valueAvg: avg(reviews.map((r) => r.value)),
      passDifficultyAvg: avg(reviews.map((r) => r.passDifficulty)),
      highScoreDifficultyAvg: avg(reviews.map((r) => r.highScoreDifficulty)),
      reviews: reviewsSorted,
    });
  }

  // Default order: value high -> review count -> name
  groups.sort((a, b) => {
    if (a.valueAvg !== b.valueAvg) return b.valueAvg - a.valueAvg;
    if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
    return a.courseName.localeCompare(b.courseName, "zh-CN");
  });

  return groups;
}


