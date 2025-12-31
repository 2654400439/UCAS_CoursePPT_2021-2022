/**
 * 站点配置（部署到你的旧仓库后，建议在这里填入真实地址）
 *
 * 例：
 * - GITHUB_REPO_URL: "https://github.com/<you>/<repo>"
 * - GITHUB_NEW_REVIEW_URL: "https://github.com/<you>/<repo>/issues/new?template=review.yml"
 */

export const SITE_URL = "https://2654400439.github.io/UCAS_CoursePPT_2021-2022/";

export const GITHUB_REPO_URL = "https://github.com/2654400439/UCAS_CoursePPT_2021-2022";

// Keep the GitHub Issue form URL for possible future re-enable (public + requires GitHub login).
export const GITHUB_ISSUE_REVIEW_URL =
  "https://github.com/2654400439/UCAS_CoursePPT_2021-2022/issues/new?template=review.yml";

// Current primary review submission entry: Tencent Questionnaire (more private + lower friction).
export const REVIEW_SUBMIT_URL = "https://wj.qq.com/s2/25396571/8cdc/";

/**
 * “学期结束提醒”功能（静态站默认无后端）：
 * - REMINDER_SIGNUP_URL：推荐。配置一个外部表单链接（如问卷星/腾讯文档/Google Form）用于收集邮箱
 * - REMINDER_EMAIL_COLLECT_URL：可选。配置一个支持 CORS 的收集接口（POST JSON）用于收集邮箱
 * - REMINDER_CONTACT_EMAIL：可选。配置维护者邮箱，用于 mailto 方式“发送邮件登记”（无需额外服务）
 */
export const REMINDER_EMAIL_COLLECT_URL = "";
export const REMINDER_SIGNUP_URL = "https://wj.qq.com/s2/25386146/6f8e/";
export const REMINDER_CONTACT_EMAIL = "";



