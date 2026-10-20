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
- 「原文 / 注释 / 译文」分层阅读；译文默认隐藏
- 刘孝标原注可折叠阅读
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

输出目录：`dist/`。

## GitHub Pages

仓库内置 `.github/workflows/pages.yml`。首次使用时，在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。之后每次 push 到 `main` 都会自动构建并发布。

## 正文来源与校勘说明

《世说新语》为公版古籍。本仓当前结构化正文初始化自公开古籍 JSON 语料，并以中国哲学书电子化计划（CTP）《世说新语》相关版本作为后续校勘参考。

- CTP: https://ctext.org/shi-shuo-xin-yu/zhs
- 数据初始化参考: https://github.com/hanzhaodeng/chinese-ancient-text
- 阅读器交互设计参考: https://github.com/hoveychen/guwen-reader

> 电子文本可能存在异体字、OCR 或整理误差。重要引文建议回查影印本；后续校勘记录应独立保存，不直接覆盖原始版本。

## 刘孝标注数据层

阅读器使用 `data/liuxiaobiao-notes.json` 保存与正文逐则对齐的刘孝标原注。底本来自 Kanripo / `kr-shadow/KR3` 的《世說新語-劉宋-劉義慶》，许可证为 **CC0-1.0**。

导入器已经从只处理「德行第一」升级为面向 **全书三十六门** 的顺序模糊对齐流程：

```bash
npm run import:liu-notes
```

导入时会：

1. 下载 CC0 Kanripo 底本；
2. 分离正文与括号内刘孝标注文；
3. 将当前简体正文逐则与古籍底本顺序对齐；
4. 修复底本双栏转写 `/` 造成的阅读顺序；
5. 生成 `data/liuxiaobiao-notes.json`；
6. 生成 `data/liuxiaobiao-alignment-report.json`，记录每门匹配数量、低置信条目和失败条目。

匹配分为两级阈值：低于最低阈值的条目不会强行绑定注文；介于最低阈值与复核阈值之间的条目进入人工校勘报告。这样可以避免因为简繁体、异体字、版本缺文等差异把刘注错误挂到相邻正文。

阅读器中开启「注」后，词义小注仍显示朱砂「注」标识；有刘孝标原注的条目会额外显示可展开的「刘孝标注」。顶部「译」独立控制现代译文，默认关闭。

## 下一阶段

- 根据 `liuxiaobiao-alignment-report.json` 人工复核低置信条目
- 建立人物索引、字号/别名映射和人物关系
- 增加全文搜索索引
- 增加书签、摘录与阅读笔记
- 建立独立校勘层，记录版本异文而不破坏正文底本
