# 阅读器交互约定

依据：README.md、当前用户确认的稳定性修复计划。视觉映射见 DESIGN.md。

## Canonical UI Map

| Capability | Canonical owner     | Source of truth  | Allowed variants                             | Verification                  |
| ---------- | ------------------- | ---------------- | -------------------------------------------- | ----------------------------- |
| Scrollbar  | index.html 全局样式 | DESIGN.md Layout | 横排纵向 / 竖排横向 / forced-colors 系统颜色 | tests/browser/reader.spec.mjs |

## 行为

- assets/reader.js 是导航、偏好、位置恢复和辅助加载的统一实现。
- 正文加载有等待、成功、失败重试；辅助数据各自失败可重试，不能阻断正文。
- URL 哈希选择章节；首页及前进后退同步标题、目录与正文。
- 阅读位置以章节、条目和条目内偏移保存在本地。搜索结果不覆盖正常阅读位置；存储被禁用时只用内存。
- 注译与字号切换保留条目，默认隐藏译文，刘注以原生 details/summary 展开。
- 窄屏目录是非模态导航抽屉；关闭时 inert，Escape 关闭并归还焦点。
- 检索仅限当前篇，不入 URL，输入法组合输入结束后再检索，清除后返回原阅读条目。
- 界面为中文，不新增账号、服务端写操作或跨设备存储。
