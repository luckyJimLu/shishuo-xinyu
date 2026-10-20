# 世说新语 · Shishuo Xinyu Reader

一个专注《世说新语》的古籍阅读器，可直接构建并部署到 GitHub Pages。

## 功能

- 三十六门完整目录与逐则阅读
- 古籍米黄纸张 / 夜间护眼主题
- 横排 / 竖排一键切换
- 字号调节
- 左侧篇目导航与正文检索
- 阅读进度、章节定位、返回顶部
- 自动记忆主题、字号、排版方式、最近篇目与阅读位置
- 移动端抽屉目录
- 零前端运行时依赖，适合 GitHub Pages

## 本地预览

```bash
npm run dev
```

然后访问 `http://localhost:4173`。

## 构建

```bash
npm run build
```

输出目录：`dist/`

## GitHub Pages

仓库内置 `.github/workflows/pages.yml`。在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

之后每次 push 到 `main` 都会自动构建并发布。

## 正文来源与校勘说明

《世说新语》为公版古籍。本仓当前结构化正文初始化自公开古籍 JSON 语料，并以中国哲学书电子化计划（CTP）《世说新语》相关版本作为后续校勘参考。CTP 页面可进行不同底本对照；建议重要引文回查影印本。

- CTP: https://ctext.org/shi-shuo-xin-yu/zhs
- 数据初始化参考: https://github.com/hanzhaodeng/chinese-ancient-text
- 阅读器交互设计参考: https://github.com/hoveychen/guwen-reader

> 注：电子文本可能存在异体字、OCR 或整理误差。后续建议新增 `data/variants/` 保存校勘记录，而不要直接丢失原始版本。

## 后续建议

1. 增加刘孝标注释层
2. 增加“原文 / 注释 / 译文”三层切换
3. 增加人物索引与人物关系
4. 增加全文搜索索引
5. 增加书签、摘录与阅读笔记
