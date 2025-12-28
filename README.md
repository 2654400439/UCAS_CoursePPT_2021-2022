# 国科大课程评价（静态站点）

一个用于“只读展示”的课程评价聚合网站：按 **课程名 + 老师** 自动合并多条评价，支持搜索/筛选/排序，点击课程卡片可折叠展开查看每条评价详情。

## 本地运行

```bash
npm install
npm run dev
```

然后打开终端提示的本地地址（一般是 `http://localhost:5173`）。

## 录入/更新数据

当前数据在 `src/data/reviews.ts` 的 `REVIEWS` 数组中（示例只有几条，你可以替换成 50 条真实数据）。

字段说明（缺失的可留空）：
- `courseCode`: 选课编号（不作为聚合 key）
- `courseName`: 课程名称（必填）
- `instructors`: 任课老师（必填，支持 `、`/`,`/`，` 等分隔）
- `credits`: 学分（必填）
- `isDegreeCourse`: 是否学位课
- `term`: 学期（必填）
- `college`: 开课学院（可空）
- `value` / `passDifficulty` / `highScoreDifficulty`: 1-5 星
- `remark`: 备注（纯文本，可换行）

## GitHub Pages 部署

本项目 `vite.config.ts` 使用 `base: "./"`，适配 `username.github.io/repo-name` 子路径部署。

推荐方式：使用 GitHub Actions 自动部署（已提供 `.github/workflows/deploy.yml`）。

你需要在仓库里开启：
- Settings → Pages → **Build and deployment** → Source 选择 **GitHub Actions**

构建命令：

```bash
npm run build
```

产物在 `dist/`。


