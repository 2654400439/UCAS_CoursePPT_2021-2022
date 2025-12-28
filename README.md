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

### 你要把本项目部署到“旧仓库”（高 star 的那个）怎么做

下面按“最不容易出错”的方式一步一步来（你用 PyCharm 的 Git 工具也完全 OK）。

#### 1）把旧仓库拉到本地（或在 PyCharm 里打开）
- 确认你能正常 `pull/push` 这个旧仓库

#### 2）把当前项目代码放进旧仓库
两种方式任选一种：
- **方式 A（推荐）**：把当前项目直接作为旧仓库的根目录内容（覆盖旧 README 时代页面）
- **方式 B**：把当前项目放到子目录（不推荐，会让 GitHub Pages base 路径更绕）

如果你担心丢失旧 README 内容：可以先把旧 `README.md` 的历史保留在 Git 历史里（GitHub 上本来就能查到），或者把它改名成 `README_OLD.md`。

#### 3）配置站点里的仓库链接与“提交评价”入口
编辑 `src/config.ts`：
- `GITHUB_REPO_URL`：填你的旧仓库地址
- `GITHUB_NEW_REVIEW_URL`：填 `https://github.com/<you>/<repo>/issues/new?template=review.yml`

#### 4）开启 GitHub Pages（GitHub Actions 部署）
在 GitHub 网页上进入旧仓库：
- Settings → Pages
- Build and deployment → Source 选择 **GitHub Actions**

推送代码到远端后，Actions 会自动跑：
- Build（npm ci + npm run build）
- Deploy（把 `dist/` 发布到 Pages）

#### 5）确认部署分支
你的旧仓库可能是 `main` 或 `master`。本项目 workflow 已兼容两者：
`.github/workflows/deploy.yml` 里是 `branches: ["main", "master"]`

### 让用户“提交新评价”的收集方式（静态站推荐）
本项目已内置 GitHub Issue 表单：
- 模板文件：`.github/ISSUE_TEMPLATE/review.yml`
- 用户在网站点右上角 **提交评价** → 会打开 GitHub 表单 → 提交后生成 Issue（带 `review` 标签）

你后续的维护流程建议：
1. 定期看 Issues（label: `review`）
2. 审核/必要时沟通确认
3. 把内容录入你的 Excel（或直接录入数据源）
4. 在本项目运行 `npm run import:xlsx` 生成 `src/data/reviews.generated.ts`
5. `git commit` + `push`，Pages 自动更新

构建命令：

```bash
npm run build
```

产物在 `dist/`。


