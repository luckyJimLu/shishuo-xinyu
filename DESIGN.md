---
version: alpha
name: 中国古典文学
description: 共用书库与阅读器的中国古典文学阅读站，以唐诗和世说新语为首批藏书。
colors:
  paper: "#f3ecd8"
  paper2: "#ece3cc"
  ink: "#2d241b"
  muted: "#736451"
  line: "#d8cbaa"
  primary: "#8b3b2f"
  map-water: "#6f9692"
  map-sea: "#e3e9df"
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
  map-water:
    backgroundColor: "{colors.map-water}"
  map-sea:
    backgroundColor: "{colors.map-sea}"
---

# 中国古典文学 Design System

## Overview

### Creative North Star

纸本古籍的阅读秩序：米黄纸面、宋体正文、朱色注标。保留现有视觉，不另作品牌改版。

### Product context and register

- Audience: 阅读中国古典文学的中文读者；从书库选择唐诗或散文，逐篇阅读和查注。
- Evidence: README.md 和既有 index.html。市场地域未限定；界面为简体中文，底本注文保留原字形。
- Register: product；桌面长时阅读与移动端查阅。
- Signature: 横排/从右向左竖排共用正文，注译保持次要层级。
- Anti-references: 营销落地页、卡片信息流；它们会分散正文阅读。
- Token ownership: assets/styles.css 的 :root/html.dark 是唯一运行时颜色来源；本文件记录现有映射，不生成第二套令牌。paper/ink/muted/line 分别映射同名 CSS 变量，primary 映射 --accent。

## Colors

正文使用 ink，辅助文字使用 muted；朱色 accent 用于当前篇目、注标和焦点。夜间主题沿用 html.dark 的纸面与墨色，强制颜色模式交给系统。

## Typography

宋体字体栈覆盖书名与中文正文，system-ui/微软雅黑用于目录辅助信息、筛选与工具控件；默认正文 20px，可调 15–30px，行高 2.05。正文最大行宽 44em；不使用外部字体请求。

## 名物研读与文学地图

原文保留墨色，名物开关默认关闭。地名使用 primary 的虚线，器物使用 muted 的点线，不逐字增加图标。目标词回跳使用 paper2 背景与 primary 轮廓。

研读卡在桌面占右侧约 320px，在手机以最大 70dvh 的底部弹层呈现；卡片依次显示词义、原句、语境、古今地理参考和资料来源。外部检索与站内地图操作共用 research-actions，不让原文变成链接墙。

地图延续纸面和朱色空心地点：map-water 映射 `--map-water` 水系线条，map-sea 映射 `--map-sea` 海面；夜间分别使用 #7ba9a1 与 #1b2825。陆地沿用 paper2，边线沿用 line。Natural Earth 图层只表达现代自然地理，避免纹理图或虚构疆界。

桌面左地图、右侧约 320px 的地名索引和诗文来源；手机提供地图／列表切换。未定位的地名仍可检索但不落点。地图工具和原生筛选控件沿用全站 focus-visible、字体与边线。

## Layout

藏书首页最大宽 1080px，以竖排题签书封区分诗文；书目目录最大宽 880px，篇目列表初始显示 40 篇，可继续加载。正文与首页使用同一套纸面颜色，诗歌居中分行、无首行缩进，散文保持两字缩进。首页和目录始终横排，竖排偏好仅应用于正文。

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

当前篇目用 aria-current 标记；返回藏书首页清除标记。稳定书目 ID 和篇目 ID 组成路由，同名诗作不共用地址。目录顺序与正文数据一致。阅读锚点由条目编号和条目内偏移组成，不保存过滤结果的位置。

### Forms and overlays

首页检索藏书，唐诗检索整个诗集的题目、作者及诗句，世说正文仍检索当前门；使用中文可访问名称及独立清除按钮，支持输入法组合输入。目录为非模态导航抽屉，不宣称 modal，不限制焦点；关闭时不可聚焦，Escape 关闭并返回菜单按钮。

### Iconography

沿用单字符图标，每个图标操作提供中文可访问名称；不新增图标依赖。诗文藏书的竖排书名题签是首页的唯一视觉重点，不引入背景贴图或营销插画。

### Motion

目录沿用 220ms 过渡；减少动态效果时禁用过渡和滚动动画。位置恢复使用即时滚动。

### Content and data visualization

中文文案直接描述状态与恢复动作。译文默认隐藏；缺失或待校勘内容不推测生成。进度以真实滚动范围计算并暴露百分比。

## Do's and Don'ts

- 保留正文、词义注、刘注、译文的层级。
- 两种排版共用导航、加载和恢复逻辑。
- 不让辅助数据失败阻断正文。
- 不把未复核的低置信注显示为已校定内容。

### 唐诗注译

正文仍是阅读核心，词注复用原生按钮与现有词义浮层；名物重叠时交由统一研读卡。逐行白话译文沿用 `.translation` 的小字号、次级墨色和细朱线，不新增成片卡片。篇末 `.study-sources` 以细分隔线和折叠标题承载整理说明；颜色映射 `primary` 到运行时 `--accent`，正文与背景继续使用既有变量。说明、背景和篇末翻页文字均继承正文文字方向；竖排时沿阅读器横向续排，不设置独立横排栏或纵向滚动区，长链接允许换行。

书目总览与检索结果使用单列主目录，不同时展示阅读侧栏；侧栏仅服务正文内的篇目切换。桌面隐藏侧栏后主目录按既有最大宽度居中，手机隐藏目录按钮并保留主区域列表导航。

世说完整译文沿用同一细朱线与次级墨色；疑义与资料复用原生 `.study-sources` 折叠区，仅开启“译”后显示，保持纸面阅读层级。

唐诗“创作背景与诗中情绪”以 `.poem-context` 作为共享资料折叠区的命名变体，与 `.study-sources` 共用纸面、边线、字号、链接及竖排几何；内部以小标题区分背景、解读和资料，不新增卡片或工具栏开关。

顶部主页图标是返回藏书首页的统一入口；书目总览、阅读侧栏、地图及错误页不再重复显示返回首页的文字链接。目录与篇目翻页仍保留各自导航。

### 渐进呈现与安静的工具栏

目录默认保留题目、作者与诗体，原句预览只在检索时出现。书目页仅提供一个主阅读动作：有进度时继续，否则从首篇开始。筛选使用朱色下划线，工具栏以透明按钮和组间细线区分操作，避免连续方框争夺正文注意力。窄桌面隐藏阅读页品牌全称，手机将检索独立成行，确保所有操作落在屏宽内。

背景与情绪保持一级折叠，整理说明及参考资料使用其内的二级折叠，所有文字继续继承正文方向。地图移除装饰性眉题，缩减手机页头与筛选间距，让地图更早进入首屏。
