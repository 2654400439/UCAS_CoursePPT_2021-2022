export function normalizeText(input: string): string {
  return input
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
}

export function splitInstructors(input: string): string[] {
  const s = normalizeText(input)
    .replace(/[，、；;／/|]+/g, ",")
    .replace(/\s*,\s*/g, ",");
  if (!s) return [];
  return s
    .split(",")
    .map((x) => normalizeText(x))
    .filter(Boolean);
}

export function canonicalInstructors(input: string): string {
  const parts = splitInstructors(input);
  if (parts.length <= 1) return parts.join("");
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b, "zh-CN")).join("、");
}

export function makeCourseKey(courseName: string, instructors: string): string {
  const cn = normalizeText(courseName);
  const ci = canonicalInstructors(instructors);
  return `${cn}__${ci}`;
}


