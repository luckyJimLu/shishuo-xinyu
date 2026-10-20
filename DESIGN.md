---
version: alpha
name: 世说新语阅读器
description: 以正文为中心、注译按需展开的中文古籍阅读工具。
colors:
  paper: "#f3ecd8"
  paper2: "#ece3cc"
  ink: "#2d241b"
  muted: "#736451"
  line: "#d8cbaa"
  primary: "#8b3b2f"
typography:
  serif:
    fontFamily: '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif'
rounded:
  DEFAULT: "8px"
spacing:
  page-max: "44em"
  sidebar: "286px"
components:
  button:
    height: "35px"
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
  search:
    height: "38px"
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  navigation:
    backgroundColor: "{colors.paper2}"
    textColor: "{colors.primary}"
  divider:
    backgroundColor: "{colors.line}"
---

# 世说新语 Design System

## Overview

### Creative North Star

纸本古籍的阅读秩序：米黄纸面、宋体正文、朱色注标。保留现有视觉，不另作品牌改版。

### Product context and register

- Audience: 阅读《世说新语》的中文读者；主要任务是逐则阅读和查注。
- Evidence: README.md 和既有 index.html。市场地域未限定；界面为简体中文，底本注文保留原字形。
- Register: product；桌面长时阅读与移动端查阅。
- Signature: 横排/从右向左竖排共用正文，注译保持次要层级。
- Anti-references: 营销落地页、卡片信息流；它们会分散正文阅读。
- Token ownership: index.html 的 :root/html.dark 是唯一运行时颜色来源；本文件记录现有映射，不生成第二套令牌。paper/ink/muted/line 分别映射同名 CSS 变量，primary 映射 --accent。

## Colors

正文使用 ink，辅助文字使用 muted；朱色 accent 用于当前篇目、注标和焦点。夜间主题沿用 html.dark 的纸面与墨色，强制颜色模式交给系统。

## Typography

宋体字体栈覆盖中文正文和控件；默认正文 20px，可调 15–30px，行高 2.05。正文最大行宽 44em；不使用外部字体请求。

## Layout

顶部工具区按实际高度预留空间，窄屏允许检索独占一行。820px 以下目录改为可关闭抽屉。reader 拥有正文滚动，横排纵向滚动，竖排横向滚动；全局滚动条使用 muted/paper2，进度条不占文流。

## Elevation & Depth

正文不加卡片。阴影仅用于抽屉和返回起点按钮，目录与正文以线条区分。

## Shapes

按钮和当前目录项延续 8px 圆角；注释以侧线、竖排以上线表示层级。

## Components

### Foundational visual states

按钮用原生语义；hover/selected 以 accent 和 paper2 区分，focus-visible 使用 accent 描边。辅助加载失败时提供文字及重试；重试期间禁用同一按钮。

### Buttons and actions

首页、目录、字号、注译、主题和横竖排为固定操作。切换控件暴露 aria-pressed，图标按钮有中文名称。

### Navigation and data display

当前篇目用 aria-current 标记；返回首页清除标记。目录顺序与正文数据一致。阅读锚点由条目编号和条目内偏移组成，不保存过滤结果的位置。

### Forms and overlays

检索仅针对当前篇，使用中文可访问名称及独立清除按钮，支持输入法组合输入。目录为非模态导航抽屉，不宣称 modal，不限制焦点；关闭时不可聚焦，Escape 关闭并返回菜单按钮。

### Iconography

沿用单字符图标，每个图标操作提供中文可访问名称；不新增图标依赖。

### Motion

目录沿用 220ms 过渡；减少动态效果时禁用过渡和滚动动画。位置恢复使用即时滚动。

### Content and data visualization

中文文案直接描述状态与恢复动作。译文默认隐藏；缺失或待校勘内容不推测生成。进度以真实滚动范围计算并暴露百分比。

## Do's and Don'ts

- 保留正文、词义注、刘注、译文的层级。
- 两种排版共用导航、加载和恢复逻辑。
- 不让辅助数据失败阻断正文。
- 不把未复核的低置信注显示为已校定内容。
