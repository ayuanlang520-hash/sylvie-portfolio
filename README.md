# Sylvie 个人主页

## 当前阶段

第 3 阶段：已准备 Pages CMS 中文表单、素材管理和手动发布流程。账号授权及线上保存验收尚待本人完成，不能视为后台已验收。

现有根目录的 `index.html` 保留为迁移前的页面快照，也用于原有区块的回归对照。新页面请查看生成后的 `_site/`。正式发布工作流仅由后台的“发布网站”按钮或 GitHub Actions 手动触发。

## 内容入口

| 位置 | 内容 |
| --- | --- |
| `src/_data/profile.json` | 网站标题、个人介绍、导航、联系方式和页脚 |
| `src/_data/projectIntro.json` | 作品区介绍 |
| `src/content/projects/*.md` | 各作品的卡片、图片、链接与详情文字 |
| `src/content/story.md` | 个人故事，支持 Markdown 强调等格式 |
| `src/_data/journey.json` | 路径区标题和时间线 |
| `src/_data/explorations.json` | 探索方向 |
| `src/_data/cooperation.json` | 合作意愿 |
| `src/_data/beichen.json` | 北辰经历区介绍和复盘入口 |
| `src/content/beichen/*.md` | 三个案例、复盘草稿和 Skill 原文页 |
| `assets/beichen/` | PDF、Skill 原文件与历史截图的展示副本 |
| `.pages.yml` | 在线后台中文字段配置 |
| `src/content/portfolio/` | 后台新增的作品 |
| `src/content/experiences/` | 后台新增的经历及关联作品 |
| `src/content/notes/` | 后台新增的复盘和实践文章 |

作品文件开头的结构化内容是表单数据，正文是 Markdown。后续 Pages CMS 会把这些内容映射为编辑表单；本阶段还没有在线编辑入口。作品 `id` 用于保持原有锚点，`order` 决定排序。

## 开发与生成

使用 Node.js 22 或更高版本。在此仓库目录运行：

```powershell
npm ci
npm run build
npm start
```

开发预览地址为 `http://localhost:8091/`。`npm run build` 生成 `_site/`；开发服务器也使用生成后的页面。CSS、脚本和 `assets/` 直接复制到输出目录，保留原有文件名和相对路径。

正式发布源是当前 `publish-ready` 独立仓库。上级目录的 `site/` 和 `preview-v1.2/` 保留作参考，本次没有修改。后续内容更改应发生在 `src/`；根目录的迁移前快照不再作为新内容的编辑入口。

## 验证

```powershell
npm test
```

测试先构建，然后核对：

- 主页原有区块的元素结构、文字、属性与导航保留；
- 本地资源、锚点和无障碍关联；
- 样式、交互脚本及全部媒体文件的字节一致性；
- 在隔离副本中修改数据和 Markdown 后确实生成新内容，并正确处理中文和特殊字符；
- 非法链接会使构建失败，且隔离测试不改动当前预览。
- 新页面、跨页链接、中文文件名和 GitHub Pages 仓库前缀兼容；
- 三个案例的双入口、录制缺失和复盘草稿状态明确呈现。

测试副本使用项目内的临时目录，结束后删除。`_site/`、`node_modules/` 和 `.verification/` 不进入版本控制。第 2 阶段将完整主页一致断言收窄为原有区块一致，允许增加经历区块和导航。

## 阶段边界

第 3 阶段代码配置已准备，首次授权和真实保存验收尚待完成。首次发布新网站属于第 4 阶段，需本人确认。

## 登录后台

打开 https://app.pagescms.org/ ，用拥有该仓库的 GitHub 账号登录。首次安装 GitHub App 时，仅选择 `sylvie-portfolio` 仓库，再进入 `main` 分支。

“北辰学习经历”下可修改三个案例和结营复盘；“已有作品”可修改原有项目。正文使用富文本编辑器，图片和 PDF 在“图片与附件”中上传。“新增作品”“新增经历”“复盘与实践文章”分别支持添加新内容。

保存会写入 GitHub 源文件。点击“发布网站”后才构建并更新公开页面；检查不通过会停止部署。仓库公开，因此已保存的源文件可被他人访问，不应放入私密信息。

后台编辑不自动回写这台电脑的本地预览。下次本地修改前，先同步 `main` 分支，避免覆盖在后台保存的内容。

当前固定网址名称与标题分开保存。修改标题不会更改访问地址；新增内容的固定网址名称创建后请勿修改。
