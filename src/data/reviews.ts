export type Star = 1 | 2 | 3 | 4 | 5;

export type ReviewRow = {
  /** 序号（仅用于稳定排序/调试） */
  id: number;
  /** 选课编号（可能每年不同，不作为聚合key） */
  courseCode?: string;
  courseName: string;
  instructors: string; // e.g. "刘奇旭、刘潮歌"
  credits: number;
  isDegreeCourse: boolean;
  term: string; // e.g. "2021—2022学年(秋)第一学期"
  college?: string; // 开课学院（可空）
  value: Star;
  passDifficulty: Star;
  highScoreDifficulty: Star;
  remark?: string; // 可多行纯文本
};

// 评价数据由 `src/data/reviews.generated.ts` 提供（由 xlsx 自动导入生成）。
// 如需更新：把新的 xlsx 放在 `src/data/reviews_MESA2021.xlsx`，然后运行 `npm run import:xlsx`。
export { REVIEWS } from "./reviews.generated";


