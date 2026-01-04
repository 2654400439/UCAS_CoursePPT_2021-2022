<!--
README 说明：
- 本项目是静态站（Vite + React + TS + Tailwind）
- 功能会持续迭代，README 以“当前代码”为准
-->

# 国科大课程评价（静态站）· Course Reviews for UCAS

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-online-brightgreen)](https://2654400439.github.io/UCAS_CoursePPT_2021-2022/)
[![Deploy](https://img.shields.io/github/actions/workflow/status/2654400439/UCAS_CoursePPT_2021-2022/deploy.yml?branch=main)](https://github.com/2654400439/UCAS_CoursePPT_2021-2022/actions)
[![Last Commit](https://img.shields.io/github/last-commit/2654400439/UCAS_CoursePPT_2021-2022)](https://github.com/2654400439/UCAS_CoursePPT_2021-2022/commits)
[![Stars](https://img.shields.io/github/stars/2654400439/UCAS_CoursePPT_2021-2022?style=flat)](https://github.com/2654400439/UCAS_CoursePPT_2021-2022/stargazers)
[![Issues](https://img.shields.io/github/issues/2654400439/UCAS_CoursePPT_2021-2022)](https://github.com/2654400439/UCAS_CoursePPT_2021-2022/issues)

![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)

**标签 / Tags**：`UCAS` `Course Reviews` `Vite` `React` `TypeScript` `Tailwind` `GitHub Pages` `No Backend` `Privacy Friendly`

一个用于“选课决策 + 评价汇总”的课程评价网站：支持搜索/筛选/排序，点击课程卡片查看多条评价；并提供 **批量提交** 流程（从学校系统复制“已选课程”表格 → 本站解析生成评价表格 → 填写 → 复制/导出 → 问卷提交）。

---

## 在线访问

- **网站**：[`https://2654400439.github.io/UCAS_CoursePPT_2021-2022/`](https://2654400439.github.io/UCAS_CoursePPT_2021-2022/)
- 建议在 GitHub 仓库右侧 **About → Website** 填上该链接

---

## 核心特性

- **课程聚合更符合实际**：按 `课程名 + 老师 + 学期季节（秋/春/夏）` 聚合  
  - 同一季节跨年份会合并（如 2021 春、2022 春视为同一门课）  
  - 春/秋仍视为不同课（避免混淆）
- **强筛选能力**：搜索、学位课、学期（按季节）、开课学院、最低学分、排序
- **评分汇总与可读性**：综合价值/难度均值 + 分位展示；默认强调“备注”
- **移动端优化**：缩短 header 占屏；课程详情的 sticky 汇总仅在桌面启用
- **学期末提醒（可选）**：右上角“学期末提醒”，支持跳转到外部登记表单（不在站内保存隐私）
- **批量提交（站内子页面）**：`#/submit`
  - 5 步图文引导（SEP → 选课系统 → 已选课程 → 全选复制 → 回站内粘贴解析）
  - 粘贴 TSV 自动解析为“多门课评价表格”
  - **自动预填任课老师**：基于 `src/data/courses.csv` 的映射（优先课程编号，次选课程名）
  - 支持删除/折叠单条评价，减少填写压力
  - 完成后支持 **复制提交文本（TSV）** / **下载 Excel（备选）**
  - 通过问卷链接收集（静态站更隐私友好、运维成本更低）

---

## 快速开始（本地运行）

```bash
npm install
npm run dev
```

默认端口固定为 **5173**（见 `package.json` 的 `dev` 脚本）。打开：`http://localhost:5173/`

- **首页**：`#/`
- **批量提交页**：`#/submit`

---

## 配置（重要：入口链接都在这里）

编辑 `src/config.ts`：

- **`SITE_URL`**：你部署后的站点地址
- **`GITHUB_REPO_URL`**：仓库地址
- **`REVIEW_SUBMIT_URL`**：问卷链接（批量提交最终落地入口）
- **`REMINDER_SIGNUP_URL`**：学期末提醒登记链接（可选）
- **`GITHUB_ISSUE_REVIEW_URL`**：保留的 GitHub Issue 表单入口（备用，当前不作为默认收集方式）

---

## 数据维护 / 更新流程（维护者）

### 评价数据

- 入口：`src/data/reviews.ts`（实际导出自 `src/data/reviews.generated.ts`）
- 更新方式：替换/更新 `src/data/reviews_MESA2021.xlsx` 后执行：

```bash
npm run import:xlsx
```

会生成/更新 `src/data/reviews.generated.ts`，再 `git commit && git push` 即可（Pages 会自动更新）。

### 任课老师映射（用于批量提交预填）

- 文件：`src/data/courses.csv`
- 三列：`课程编号,课程名称,任课教师`（CSV，无表头）
- 匹配策略：优先课程编号精确匹配（含去掉 `-班号` 后缀的兜底），再课程名称精确匹配

---

## 提交评价（面向同学）

### 批量评价（推荐）

1. 进入：`#/submit`
2. 跟随引导从 SEP 的“已选课程”复制表格并粘贴解析
3. 逐行补充评分与备注（老师一般已预填，可修改）
4. 全部完成后：点击 **复制提交内容** → 点击 **去问卷提交** → 粘贴提交

> 为什么不在本站直接“一键提交”？本站是静态站（无后端、无账号系统），不收集登录信息也不在站内保存隐私数据；采用问卷作为收集入口更轻量、也更隐私友好。

---

## 部署到 GitHub Pages

本项目 `vite.config.ts` 使用 `base: "./"`，适配 `username.github.io/repo-name` 子路径部署。  
已提供 GitHub Actions workflow：`.github/workflows/deploy.yml`（兼容 `main/master`）。

在 GitHub 仓库：
- Settings → Pages → Source 选择 **GitHub Actions**
- 推送后 Actions 会自动 build + deploy

---

## 项目结构（核心文件）

- **`src/App.tsx`**：首页 + hash 路由（`#/submit`）
- **`src/pages/SubmitPage.tsx`**：批量提交页面（TSV 解析 / 预填老师 / 引导 / 导出）
- **`src/lib/aggregate.ts`**：课程聚合（含学期季节维度）
- **`src/lib/filter.ts`**：筛选与 facet
- **`src/lib/term.ts`**：学期规范化/季节识别
- **`src/data/reviews.generated.ts`**：评价数据（由 xlsx 导入生成）
- **`src/data/courses.csv`**：课程编号/名称/老师映射
- **`scripts/import-xlsx.mjs`**：从 xlsx 生成数据文件

---

## 备注

- 历史内容保存在 `README_OLD.md`
- GitHub Issue 表单模板仍保留在 `.github/ISSUE_TEMPLATE/review.yml`（备用收集方式）


