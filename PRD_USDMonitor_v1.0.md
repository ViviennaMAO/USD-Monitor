# USD Valuation Model Dashboard — PRD v1.0

> **项目代号**: USDMonitor
> **版本**: v1.0
> **日期**: 2026-03-21
> **参考**: Macro Sniper USD Valuation Model (`usd-model-dashboard.html`)

---

## 1. 项目概述

### 1.1 背景

构建一个**美元估值因子看板**，基于宏观经济学框架对美元指数 (DXY) 进行多维度估值评分，输出综合信号（看多/中性/看空）。区别于黄金因子看板的 XGBoost 机器学习方法，USD 看板采用**因子打分模型**（Score-based），更贴近宏观基本面逻辑。

### 1.2 核心公式

```
γ (USD Score) = r_f + π_risk − cy + σ_alert
```

| 分项 | 名称 | 权重 | 含义 |
|------|------|------|------|
| **r_f** | Rate Differential Support | ~35% | 利率差异支撑：Fed 相对全球主要央行的利率优势 |
| **π_risk** | Risk Premium | ~25% | 风险溢价：期限溢价 + 市场波动率，区分全球避险 vs 美国特有风险 |
| **cy** | Convenience Yield | ~25% | 便利收益：美元储备地位侵蚀（黄金、去美元化）抵消 |
| **σ_alert** | Volatility Alert Factors | ~15% | 波动率预警：期权偏斜 + 利差残差错位 + 复合共振信号 |

### 1.3 信号阈值

| 评分区间 | 信号 | 含义 |
|----------|------|------|
| > 65 | **BULLISH (看多)** | 利率差 + 避险主导，USD 偏强 |
| 35 ~ 65 | **NEUTRAL (中性)** | 多空拉锯，混合信号 |
| < 35 | **BEARISH (看空)** | 去美元化 + 利率收敛，USD 偏弱 |

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 14 (App Router) | TypeScript, React 18 |
| UI | Tailwind CSS 3 | 深色主题，与 GoldMonitor 统一设计语言 |
| 图表 | Recharts + Canvas (Gauge) | 折线图、柱状图、仪表盘 |
| 数据获取 | SWR | 客户端轮询 |
| 后端数据 | Python Pipeline | 每日定时从 FRED/Yahoo 拉取，输出 JSON |
| 部署 | Vercel + GitHub Actions | 自动部署 + 每日数据更新 |

### 2.2 目录结构

```
USDMonitor/
├── usd-dashboard/                     # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # 主页面
│   │   │   ├── layout.tsx             # 根布局
│   │   │   ├── globals.css            # 全局样式
│   │   │   └── api/                   # API 路由
│   │   │       ├── score/route.ts     # 综合评分 + 信号
│   │   │       ├── components/route.ts # r_f, π_risk, cy 详情
│   │   │       ├── vol-alert/route.ts # σ_alert 波动率预警因子
│   │   │       ├── dxy/route.ts       # DXY 价格 + 历史
│   │   │       ├── fx-pairs/route.ts  # 汇率对数据
│   │   │       ├── cftc/route.ts      # CFTC 持仓
│   │   │       ├── yield/route.ts     # 收益率分解
│   │   │       └── history/route.ts   # 信号历史
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx         # 顶部导航：公式 + DXY + 信号
│   │   │   │   └── Footer.tsx         # 底部状态栏
│   │   │   ├── gauge/
│   │   │   │   └── ScoreGauge.tsx     # 仪表盘组件（Canvas）
│   │   │   ├── cards/
│   │   │   │   ├── DxyStatsGrid.tsx   # DXY 统计卡片网格
│   │   │   │   ├── ComponentCard.tsx  # 三分项卡片（r_f / π_risk / cy）
│   │   │   │   ├── VolAlertCard.tsx  # 波动率预警卡片（σ_alert）
│   │   │   │   ├── FxPairCard.tsx     # 汇率对卡片
│   │   │   │   └── HedgeCard.tsx      # 对冲传导卡片
│   │   │   ├── charts/
│   │   │   │   ├── ScoreHistory.tsx   # 评分历史折线（叠加 DXY）
│   │   │   │   ├── YieldDecomp.tsx    # 10Y 收益率分解
│   │   │   │   ├── CftcBars.tsx       # CFTC 持仓柱状图
│   │   │   │   └── FxTrendChart.tsx   # 汇率趋势图
│   │   │   └── ui/
│   │   │       ├── Badge.tsx          # 信号徽章
│   │   │       ├── SubBar.tsx         # 子因子进度条
│   │   │       └── DataRow.tsx        # 数据行组件
│   │   ├── lib/
│   │   │   ├── useUsdData.ts          # SWR Hooks
│   │   │   └── readPipelineJson.ts    # 读取 pipeline JSON
│   │   ├── data/
│   │   │   └── mockData.ts           # 开发用 mock 数据
│   │   └── types/
│   │       └── index.ts              # TypeScript 类型定义
│   ├── pipeline/                      # Python 后端
│   │   ├── requirements.txt
│   │   ├── config.py
│   │   ├── fetch_data.py             # FRED + Yahoo 数据拉取
│   │   ├── scoring.py                # 三分项评分引擎 (r_f, π_risk, cy)
│   │   ├── vol_alert.py              # σ_alert 12因子波动率预警引擎
│   │   ├── run_daily.py              # 每日运行入口
│   │   └── output/                   # JSON 输出
│   │       ├── score.json
│   │       ├── components.json
│   │       ├── vol_alert.json        # 波动率预警因子数据
│   │       ├── dxy.json
│   │       ├── fx_pairs.json
│   │       ├── cftc.json
│   │       ├── yield_decomp.json
│   │       └── signal_history.json
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
```

---

## 3. 页面模块设计

### 3.1 Header（顶部导航栏）

| 元素 | 内容 | 说明 |
|------|------|------|
| 返回按钮 | ← Daily Dashboard | 预留入口（可选） |
| 公式 | `γ = r_f + π_risk − cy` | 金色字体，品牌标识 |
| 副标题 | USD Valuation Model · v1.0 | |
| 日期 | 2026-03-21 · 16:00 ET Close | 数据日期 |
| DXY 价格 | 103.2 | 大字号，实时/日更新 |
| 信号徽章 | BULLISH / NEUTRAL / BEARISH | 颜色编码 |
| 评分 | Score: 58/100 | |

### 3.2 Top Row — 仪表盘 + DXY 统计

#### 3.2.1 Score Gauge（仪表盘）

- **类型**: 270° 环形仪表盘 (Canvas / Recharts PieChart)
- **三色区间**: 红色 (0-35)、琥珀色 (35-65)、绿色 (65-100)
- **中心显示**: 评分数字 + "综合评分" + 信号文字
- **底部图例**: `<35 看空 | 35-65 中性 | >65 看多`

#### 3.2.2 DXY Stats Grid（7 卡片网格）

| 卡片 | 数据源 | 显示 |
|------|--------|------|
| DXY 现价 | Yahoo/Stooq | 103.2, +0.3% 日涨 |
| 率差支撑 r_f | 计算 | 72/100, Fed领先ECB +1.50% |
| 风险溢价 π_risk | 计算 | 45/100, 混合信号 · VIX 18.5 |
| 便利收益 cy | 计算 | 55/100, 黄金上行 · 去美元化 |
| 波动率预警 σ_alert | 计算 | 68/100, RR+残差共振 |
| 对冲传导效率 | 计算 | 62/100, 中等传导 |
| 实际利率 | FRED | 1.85%, 10Y − BEI |

#### 3.2.3 Score History Chart（评分历史）

- **双轴折线图**: USD Score (左轴) + DXY (右轴, 虚线)
- **时间范围**: 30 日
- **Score 填充区域**: 琥珀色半透明

### 3.3 Three Components Row — 三大分项卡片

每个分项卡片结构一致：

```
┌─────────────────────────────────────┐
│  r_f                    72/100      │
│  Rate Differential      USD 看多    │
│  利率差异支撑                        │
│─────────────────────────────────────│
│  ▎ Fed vs ECB (57%)     ████░ +1.50%│
│  ▎ Fed vs BOJ (14%)     █████ +4.25%│
│  ▎ Fed vs BOE (12%)     ██░░░ +0.25%│
│  ▎ 实际利率 (10Y-BEI)   ███░░ 1.85% │
│  ▎ 利率路径 (2Y vs Fed) ████░ 鹰派   │
│─────────────────────────────────────│
│  Fed Funds Rate         4.50%       │
│  ECB Main Rate          3.00%       │
│  BOJ Call Rate          0.25%       │
│  ...                                │
└─────────────────────────────────────┘
```

#### 3.3.1 r_f — 利率差异支撑

**子因子 (Sub-factors)**:
| 子因子 | 数据源 | 权重 |
|--------|--------|------|
| Fed vs ECB 利差 | FRED: FEDFUNDS, ECB Main | DXY 57% 权重 |
| Fed vs BOJ 利差 | FRED: FEDFUNDS, BOJ Rate | DXY 14% 权重 |
| Fed vs BOE 利差 | FRED: FEDFUNDS, BOE Rate | DXY 12% 权重 |
| 实际利率 | FRED: DFII10 (TIPS 10Y) | 结构性支撑 |
| 利率路径 | FRED: DGS2 vs FEDFUNDS | 市场预期 vs 现行政策 |

**底部数据行**: Fed Funds, ECB Main, BOJ Call, BOE Bank, €STR, SONIA, 2Y Treasury

#### 3.3.2 π_risk — 风险溢价

**子因子**:
| 子因子 | 数据源 | 说明 |
|--------|--------|------|
| 期限溢价 10Y | NY Fed ACM 模型 (或近似) | bps |
| VIX | Yahoo: ^VIX | 正常化 12-40 |

**风险类型分类框 (2×1 Grid)**:
- **全球风险 → USD 看多**: VIX↑ + TP↓ = 飞向安全 (Flight to Safety)
- **美国特有风险 → USD 看空**: VIX↑ + TP↑ = 财政恐惧 (Fiscal Fear)
- 当前激活哪一种用绿/红边框高亮

**底部数据行**: 10Y TP (ACM), 2Y TP, VIX, MOVE, TP 正常化范围, 当前 TP 分位

**注释框**: 当前信号解读

#### 3.3.3 cy — 便利收益

**子因子**:
| 子因子 | 数据源 | 说明 |
|--------|--------|------|
| 黄金走势 | Yahoo/Stooq: XAUUSD | 上行 = USD 拖累 |
| SOFR-IORB 利差 | FRED: SOFR, IORB | 资金市场健康度 |
| DXY 残差溢价 | 计算 | DXY 实际 vs 利率隐含值 |

**底部数据行**: 黄金价格, 黄金30d趋势, SOFR, IORB, SOFR-IORB, DXY利率隐含值, DXY超额溢价

**注释框**: 黄金与美元结构性关系解读

### 3.4 σ_alert — 波动率预警因子模块

独立的第四大分项，放在三大分项卡片下方。包含 **3 层共 12 个因子**：直接美元波动率因子 (2个)、跨资产传导因子 (5个)、交叉复合因子 (5个)。

**模块布局**: 全宽展示，分为上中下三层

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  σ_alert                                         72/100    🟠 预警          │
│  USD Volatility Alert · 美元波动率预警因子                                   │
│  推升 5 因子 ████████████████░░░░ vs 压制 3 因子 █████████░░░░░░░░░░░       │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  ═══ 一、直接美元波动率因子 ═══                                               │
│                                                                              │
│  ┌─ F1: 3M 25D Risk Reversal ─┐  ┌─ F2: 汇率-利差残差 ────────────────────┐ │
│  │    +0.80  (2Y分位: 97%)     │  │    +1.2 pts  残差方向: 偏贵            │ │
│  │  ████████████░░ 多头拥挤     │  │  ████████░░░░ 均值回归压力: 高         │ │
│  └─────────────────────────────┘  └────────────────────────────────────────┘ │
│                                                                              │
│  ═══ 二、跨资产波动率因子 ═══                                                 │
│                                                                              │
│  ┌─ F3 ────────┐ ┌─ F4 ────────┐ ┌─ F5 ──────────┐ ┌─ F6 ──┐ ┌─ F7 ──┐   │
│  │ OVX 101.97  │ │ VVIX/VIX   │ │ VIX  24.21    │ │VXHYG │ │ GVZ  │   │
│  │ 52W: 75%    │ │ 4.82 偏高   │ │ VXN  26.32    │ │ 9.07  │ │30.56 │   │
│  │ 🔴 推升      │ │ 🔴 推升     │ │ Gap: +2.11    │ │-27.6% │ │-8.8% │   │
│  │             │ │             │ │ 🟡 潜在推升    │ │🟢 压制 │ │🟢 压制│   │
│  └─────────────┘ └─────────────┘ └───────────────┘ └───────┘ └──────┘   │
│                                                                              │
│  ═══ 三、交叉复合信号 ═══                                                     │
│                                                                              │
│  ┌─ F8 ───────────┐ ┌─ F9 ───────────┐ ┌─ F10 ──────────┐                  │
│  │ RR×残差共振     │ │ OVX×TIPS滞胀   │ │ VVIX/VIX×RR    │                  │
│  │ +1.42σ 🟠共振   │ │ 极端 🔴滞胀     │ │ +3.86 🟠尾部   │                  │
│  └─────────────────┘ └─────────────────┘ └────────────────┘                  │
│  ┌─ F11 ──────────┐ ┌─ F12 ──────────┐                                      │
│  │ VXN-VIX溢出    │ │ VXHYG×CDS修复  │                                      │
│  │ +2.11 🟡关注    │ │ 收窄 🟢压制     │                                      │
│  └─────────────────┘ └────────────────┘                                      │
│──────────────────────────────────────────────────────────────────────────────│
│  ⚡ 综合判断：推升因子(RR极端、OVX极高、VVIX/VIX偏高、滞胀共振)的极端程度    │
│  超过压制因子(VXHYG骤降、GVZ回落)，整体偏向波动率扩张方向。                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

#### 一、直接美元波动率因子

##### F1 — 3M 25D Risk Reversal (风险逆转)

**本质**: 最核心的美元波动率偏斜因子。衡量期权市场对美元看涨与看跌的隐含波动率之差，直接反映市场对美元方向性波动的**不对称定价**。

| 属性 | 说明 |
|------|------|
| 定义 | 25-Delta Call IV − 25-Delta Put IV (3个月期限) |
| 当前读数 | ~+0.80, 近两年极端高位 |
| 正值含义 | 市场为美元上行风险支付更高溢价（看涨偏斜 → 多头拥挤） |
| 负值含义 | 市场为美元下行风险支付更高溢价（看跌偏斜 → 空头拥挤） |
| 极端阈值 | \|RR\| > 0.6σ (2年滚动) → 多头/空头拥挤 |
| 数据源 | Bloomberg / 衍生品数据商 (v1.0 用近似构造) |
| 替代构造 | (DXY ATM IV − EUR/USD ATM IV) 的偏度近似 |
| 波动率作用 | 🔴 **推升** — RR 极端高位，市场为美元上行支付显著溢价 |

**显示元素**:
- 当前 RR 值（大字号）
- 2 年历史分位数 (百分位条)
- 方向偏斜可视化条 (中轴=0，左=看跌，右=看涨)
- 信号标签: 多头拥挤 / 空头拥挤 / 中性

##### F2 — 汇率-利差残差 (现金保护溢价)

**本质**: DXY 对美-非美 2Y 利差回归后的**残差项**。残差为正说明美元定价中包含非利差驱动的溢价成分（避险需求、流动性溢价、仓位效应）。残差越大，未来均值回归时波动越剧烈，是美元波动率扩张的**领先指标**。

| 属性 | 说明 |
|------|------|
| 计算方法 | `residual = DXY_actual − (α + β × spread_2Y_weighted)` |
| 回归窗口 | 252 日滚动 OLS |
| 正残差 | 美元相对利差定价**偏贵** → 均值回归压力大 → 波动放大 |
| 负残差 | 美元相对利差定价**偏便宜** → 可能均值回归做多 |
| 核心逻辑 | 残差越大 → 均值回归时波动越剧烈 → 预判波动率变化**方向** |
| 数据源 | FRED: DTWEXBGS (DXY), DGS2, 各国 2Y 利率 |
| 波动率作用 | 🔴 **推升** — 残差为正且较大，错位程度高 |

**显示元素**:
- 残差值（±pts，大字号）
- 残差方向标签: 偏贵 / 偏便宜 / 中性
- 残差绝对值的历史分位数
- 均值回归压力指示: 低 / 中 / 高

---

#### 二、跨资产波动率因子（与美元波动率存在传导关系）

##### F3 — OVX (原油波动率)

**本质**: 能源波动率。美元作为大宗商品计价货币，OVX 极端高位会通过避险通道推升美元的隐含波动率需求。

| 属性 | 说明 |
|------|------|
| 当前读数 | 101.97, 52周分位 75%, 极高水平 |
| 传导逻辑 | OVX↑ + 实际利率高企(TIPS 1Y 4.72%) → 滞胀隐忧 → 美元方向不确定性↑ → 波动率↑ |
| 数据源 | Yahoo: ^OVX (CBOE Oil Volatility Index) |
| 波动率作用 | 🔴 **推升** — 能源波动率逆势维持高位 |

**显示元素**: 当前值、52周分位条、与TIPS实际利率的滞胀联动指示

##### F4 — VVIX/VIX 比值 (波动率的波动率溢价)

**本质**: 衡量"波动率的波动率"相对于波动率本身的溢价。机构悄然对冲尾部风险时，VVIX/VIX 偏高——表面平静下防御性需求存在。美元作为避险资产，VVIX/VIX 偏高时美元的尾部波动风险溢价也会**被动抬升**。

| 属性 | 说明 |
|------|------|
| 当前读数 | 4.82, 偏高 |
| 正常范围 | 3.5 ~ 5.0 |
| >5.0 含义 | 市场对突发波动的定价显著偏高 → 尾部风险溢价上升 |
| 数据源 | Yahoo/CBOE: ^VVIX, ^VIX 计算比值 |
| 波动率作用 | 🔴 **推升** — 机构在对冲尾部风险 |

**显示元素**: 比值（大字号）、正常范围参考线、尾部风险溢价标签

##### F5 — VIX vs VXN 分化 (股票波动率结构)

**本质**: VIX (SPX) 处于相对低位但 VXN (NASDAQ) 偏高，说明波动率集中在科技板块而非系统性层面。这种分化状态下美元波动率倾向于被压制，但一旦 VIX 补涨追赶 VXN，美元波动率会**同步放大**。

| 属性 | 说明 |
|------|------|
| VIX 当前 | 24.21, 52周分位 23% (低位) |
| VXN 当前 | 26.32, 中偏高 |
| VXN-VIX Gap | +2.11, 科技板块波动率溢价 |
| 触发条件 | VXN > 30 → 科技板块波动率向系统性传导 → VIX 补涨 → USD 波动率放大 |
| 数据源 | Yahoo: ^VIX, ^VXN |
| 波动率作用 | 🟡 **潜在推升** — 分化存在，但尚未传导 |

**显示元素**: VIX/VXN 双读数、差值、传导风险状态灯

##### F6 — VXHYG (高收益债波动率)

**本质**: 信用波动率。VXHYG 骤降意味着信用市场风险偏好修复，对应美元避险需求下降，**压低**美元波动率上行动能。

| 属性 | 说明 |
|------|------|
| 当前读数 | 9.07, 变化 -27.56% (骤降) |
| 传导逻辑 | 信用波动率↓ → 风险偏好↑ → 避险需求↓ → USD 波动率上行动能减弱 |
| 验证 | 信用周期尚未逆转，债市领先修复 |
| 数据源 | Yahoo: ^VXHYG (或 HYG options IV) |
| 波动率作用 | 🟢 **压制** — 信用风险偏好修复 |

**显示元素**: 当前值、变化幅度（高亮骤降）、信用周期状态标签

##### F7 — GVZ (黄金波动率)

**本质**: 黄金波动率回落说明贵金属市场的不确定性定价在消退。黄金和美元通常负相关，GVZ 下降意味着市场对美元避险功能的**边际依赖在减弱**。

| 属性 | 说明 |
|------|------|
| 当前读数 | 30.56, 变化 -8.83% |
| 传导逻辑 | GVZ↓ → 黄金不确定性↓ → 避险替代需求↓ → USD 波动率边际受压 |
| 数据源 | Yahoo: ^GVZ (CBOE Gold Volatility Index) |
| 波动率作用 | 🟢 **压制** — 黄金波动率回落 |

**显示元素**: 当前值、变化幅度、与美元避险需求的关联标签

---

#### 三、交叉复合因子（组合信号）

##### F8 — RR × 利差残差 (情绪-估值共振因子)

**本质**: F1 (情绪面偏斜) 与 F2 (基本面错位) 的组合。两者同时处于极端值时，预示美元波动率扩张概率**显著上升**。

| 属性 | 说明 |
|------|------|
| 计算方法 | `composite = z_score(RR) + z_score(|residual|)` |
| 替代方法 | `composite = z_score(RR) × z_score(|residual|)` (乘积形式) |
| Z-Score 窗口 | 252 日滚动标准化 |
| 共振条件 | RR > +0.5σ **且** residual > +0.5σ → 双因子共振 |
| 波动率作用 | 🔴 **推升** — 情绪面与估值面双重极端 |

**共振状态分类**:

| 状态 | 条件 | 颜色 | 含义 |
|------|------|------|------|
| 🟢 平静 | composite < 0.5σ | 绿色 | 波动率低位，无预警 |
| 🟡 关注 | 0.5σ ≤ composite < 1.0σ | 琥珀色 | 单因子偏极端 |
| 🟠 预警 | 1.0σ ≤ composite < 1.5σ | 橙色 | 双因子趋近共振 |
| 🔴 警报 | composite ≥ 1.5σ | 红色 | 双因子强共振，波动率大概率放大 |

##### F9 — OVX × TIPS 实际利率 (滞胀压力因子)

**本质**: OVX 极高 + TIPS 实际利率高企，两者同时高企构成滞胀信号。滞胀环境下美元面临方向性不确定——加息预期支撑美元但经济放缓拖累美元——这种"**方向不明但幅度会大**"的状态直接推高美元的实现波动率。

| 属性 | 说明 |
|------|------|
| 计算方法 | `stagflation = normalize(OVX, 50, 150) × normalize(TIPS_1Y, 1, 5)` |
| 当前状态 | OVX 101.97 + TIPS 1Y 4.72% → 滞胀信号极端 |
| 传导逻辑 | 高油价 + 高实际利率 → 方向模糊 + 幅度放大 → 实现波动率↑ |
| 数据源 | Yahoo: ^OVX + FRED: DFII10 (或 TIPS 1Y 近似) |
| 波动率作用 | 🔴 **推升** — 滞胀条件满足 |

**显示元素**: OVX 与 TIPS 的双轴定位图、滞胀象限标注 (4象限: 增长/通胀/滞胀/衰退)

##### F10 — VVIX/VIX × RR (尾部风险 × 方向偏斜因子)

**本质**: VVIX/VIX 偏高说明市场在买尾部保护，RR 偏高说明保护集中在**美元上行方向**。两者结合意味着机构在押注美元可能出现剧烈的单方向运动——波动率跳升的**前兆信号**。

| 属性 | 说明 |
|------|------|
| 计算方法 | `tail_directional = (VVIX/VIX) × abs(RR)` |
| 当前状态 | 4.82 × 0.80 = 3.86 (偏高) |
| 高值含义 | 机构在为美元单方向剧烈波动买保护 |
| 极端阈值 | > 4.0 → 高度警戒 |
| 波动率作用 | 🟠 **推升** — 接近警戒线 |

**显示元素**: 复合值、尾部风险方向箭头、历史分位

##### F11 — VXN-VIX 价差 × QQQ/SPY 相对表现 (科技板块溢出因子)

**本质**: VXN 比 VIX 高出约 2 个点，个股波动率 (VXAZN 35.58, VXGOG 32.57, VXAPL 30.07) 普遍显著高于 VXN 和 VIX。如果科技板块波动率向系统性波动率传导 (VXN→VIX)，美元波动率将**被动放大**。

| 属性 | 说明 |
|------|------|
| 计算方法 | `spillover = (VXN - VIX) × abs(QQQ_ret - SPY_ret) / SPY_ret` |
| 触发条件 | VXN 反弹 > 30 → 科技→系统性传导启动 |
| 当前状态 | VXN-VIX = +2.11, 尚未触发但需关注 |
| 个股波动率 | VXAZN 35.58, VXGOG 32.57, VXAPL 30.07 (远高于VIX) |
| 数据源 | Yahoo: ^VXN, ^VIX, QQQ, SPY |
| 波动率作用 | 🟡 **潜在推升** — 分化存在，等待传导 |

**显示元素**: VXN-VIX 差值条、个股波动率热力图、传导触发阈值指示

##### F12 — VXHYG × NA IG CDS (信用修复因子)

**本质**: VXHYG 骤降 + NA IG CDS 收窄，两者共同指向信用风险偏好改善。这是美元波动率的**压制因子**——信用越稳，避险需求越低，美元波动率越难维持高位。

| 属性 | 说明 |
|------|------|
| 计算方法 | `credit_calm = normalize(VXHYG_change, -30, 0) × normalize(CDS_level, 40, 80)` |
| 当前状态 | VXHYG -27.56% + NA IG CDS 59.6bps → 信用修复明显 |
| 传导逻辑 | 信用稳 → 避险需求↓ → USD 波动率上行动能被压制 |
| 数据源 | Yahoo: ^VXHYG + CDX/iTraxx 近似 |
| 波动率作用 | 🟢 **压制** — 信用周期修复 |

**显示元素**: VXHYG 变化幅度、CDS 水平、信用状态标签

---

#### 因子方向汇总

| 方向 | 因子 | 极端程度 |
|------|------|----------|
| 🔴 **推升** | F1 RR极端高位, F2 利差残差为正, F3 OVX极高, F4 VVIX/VIX偏高, F8 情绪-估值共振, F9 滞胀压力, F10 尾部×方向 | **突出** |
| 🟡 **潜在推升** | F5 VIX-VXN分化, F11 科技溢出 | 等待传导 |
| 🟢 **压制** | F6 VXHYG骤降, F7 GVZ回落, F12 信用修复 | 中等 |

> **综合判断**: 推升因子 (7个) 的极端程度超过压制因子 (3个)，整体偏向**波动率扩张方向**。潜在推升因子 (2个) 是触发级别升级的催化剂。

---

### 3.5 对冲传导 + 收益率分解（两列布局）

#### 3.5.1 对冲传导效率卡片

- **评分**: X/100
- **6 格网格**: CIP 基差偏差, 资管 EUR 多头, 资管 JPY 多头, DXY-利率背离, SOFR, €STR
- **解读框**: 传导效率含义

#### 3.5.2 10Y 收益率分解卡片

- **当前 10Y 名义收益率**: 大字号
- **驱动因素徽章**: 实际利率驱动 / 通胀预期驱动 / 期限溢价驱动
- **堆叠条形图**: 实际利率(绿) + 通胀预期(琥珀) + 期限溢价(红)
- **数据行**: 实际利率, 5Y BEI, 10Y BEI, 期限溢价, 主要驱动因素
- **注释框**: 收益率结构解读

### 3.6 汇率对 + CFTC 持仓（两列布局）

#### 3.6.1 全球汇率对

**FX 网格 (5 列)**:
| 货币对 | 说明 |
|--------|------|
| DXY Index | 美元指数 |
| EUR/USD | 欧元 (DXY 57%) |
| USD/JPY | 日元 (DXY 14%) |
| USD/CNY | 人民币 |
| USD/MXN | 墨西哥比索 |

每个卡片: 汇率、日涨跌幅、信号徽章

**底部**: 7 日汇率趋势折线图 (EUR/USD, USD/JPY, DXY)

#### 3.6.2 CFTC 持仓分析

- **双向柱状图**: 零轴居中，正值=净多头USD
- **货币**: USD Index, EUR (反向), JPY (反向), GBP (反向), CAD
- **历史柱状图**: 7 周净持仓变化
- **注释框**: 仓位拥挤度分析

### 3.7 信号历史时间线

- **7 日信号变化**: 日期 + 信号 + 变化标签 + 解读文字 + 评分
- **变化标签**: ↑ 升档, ↓ 降档, ↔ 维持
- **评分颜色**: 绿色 >65, 琥珀色 35-65, 红色 <35

---

## 4. 数据源规划

### 4.1 FRED (免费 API)

| 数据 | FRED Series ID | 频率 |
|------|---------------|------|
| Fed Funds Rate | FEDFUNDS | 月 (取最新) |
| 2Y Treasury | DGS2 | 日 |
| 10Y Treasury | DGS10 | 日 |
| TIPS 10Y (实际利率) | DFII10 | 日 |
| 10Y BEI | T10YIE | 日 |
| 5Y BEI | T5YIE | 日 |
| DXY (Trade Weighted) | DTWEXBGS | 日 |
| SOFR | SOFR | 日 |
| IORB (近似) | IORR | 日 |

### 4.2 Yahoo Finance

| 数据 | Ticker | 频率 | 用途 |
|------|--------|------|------|
| DXY 实时 | DX-Y.NYB | 日/盘中 | 主价格 |
| VIX | ^VIX | 日 | F4, F5, π_risk |
| VVIX | ^VVIX | 日 | F4 波动率的波动率 |
| VXN | ^VXN | 日 | F5 纳指波动率 |
| OVX | ^OVX | 日 | F3 原油波动率 |
| GVZ | ^GVZ | 日 | F7 黄金波动率 |
| MOVE | ^MOVE | 日 | π_risk 债券波动率 |
| EUR/USD | EURUSD=X | 日 | FX |
| USD/JPY | JPY=X | 日 | FX |
| USD/CNY | CNY=X | 日 | FX |
| USD/MXN | MXN=X | 日 | FX |
| 黄金 | GC=F | 日 | cy |
| QQQ | QQQ | 日 | F11 科技溢出 |
| SPY | SPY | 日 | F11 科技溢出 |
| EUR/USD ATM IV | EVZ / Options Chain | 日 | F1 RR 近似 |

> **注**: VXHYG (^VXHYG) 可能在 Yahoo Finance 上不可用，可用 HYG ETF 的 options chain 计算 30 日隐含波动率替代

### 4.3 波动率预警因子数据源 (12 因子)

#### 直接美元波动率因子

| 因子 | 数据 | 获取方式 | 说明 |
|------|------|----------|------|
| F1 RR | 3M 25D Risk Reversal | Bloomberg (理想) / 近似构造 | v1.0 用 DXY 隐含波动率偏度近似 |
| F1 近似 | DXY Call IV − Put IV | 从 EUR/USD vol surface 反推 | `RR ≈ (DXY_IV_25D_call − DXY_IV_25D_put)` |
| F2 残差 | DXY vs 2Y 利差回归残差 | FRED: DTWEXBGS, DGS2, 各国2Y | 252日滚动 OLS 回归 |

#### 跨资产波动率因子

| 因子 | 数据 | Ticker / Series | 频率 |
|------|------|-----------------|------|
| F3 OVX | 原油波动率 | Yahoo: ^OVX | 日 |
| F4 VVIX | 波动率的波动率 | Yahoo: ^VVIX | 日 |
| F4 VIX | 标普波动率 | Yahoo: ^VIX | 日 |
| F5 VXN | 纳斯达克波动率 | Yahoo: ^VXN | 日 |
| F6 VXHYG | 高收益债波动率 | Yahoo: ^VXHYG (或 HYG options IV) | 日 |
| F7 GVZ | 黄金波动率 | Yahoo: ^GVZ | 日 |
| F5 个股vol | VXAZN, VXGOG, VXAPL | Yahoo (参考) | 日 |

#### 交叉复合因子

| 因子 | 输入数据 | 计算方式 |
|------|----------|----------|
| F8 RR×残差 | F1 + F2 | `z_score(RR) + z_score(\|residual\|)` |
| F9 滞胀 | OVX + TIPS 1Y | `normalize(OVX) × normalize(TIPS_1Y)` |
| F10 尾部×方向 | VVIX/VIX + RR | `(VVIX/VIX) × abs(RR)` |
| F11 科技溢出 | VXN-VIX + QQQ/SPY | `gap × abs(QQQ_ret - SPY_ret) / SPY_ret` |
| F12 信用修复 | VXHYG变化 + NA IG CDS | `normalize(-ΔVXHYG) × (1 - normalize(CDS))` |

#### 额外数据需求

| 数据 | 来源 | 说明 |
|------|------|------|
| TIPS 1Y 实际利率 | FRED: DFII10 近似 | F9 滞胀因子 |
| QQQ 收益率 | Yahoo: QQQ | F11 科技溢出 |
| SPY 收益率 | Yahoo: SPY | F11 科技溢出 |
| NA IG CDS 利差 | CDX / iTraxx 近似 | F12 信用修复 (v1.0 用 FRED: BAMLC0A4CBBB) |

> **注**: 3M 25D Risk Reversal 的精确数据通常来自 Bloomberg Terminal。v1.0 采用**近似构造方案**：
> 1. 使用 EUR/USD 隐含波动率 (EVZ 或 Yahoo Options Chain) 的看涨/看跌偏度
> 2. 结合 DXY ATM IV 水平，构造方向性偏斜指标
> 3. 后续版本接入 Bloomberg / Refinitiv API 获取精确 RR 报价

### 4.4 CFTC (公开数据)

| 数据 | 来源 | 频率 |
|------|------|------|
| Traders in Financial Futures | CFTC TFF 报告 | 周二 (周五发布) |
| 资管机构净持仓 | 分货币解析 | 周 |

> **注**: CFTC 数据 v1.0 先用 mock，后续接入 CFTC Commitment of Traders API

### 4.5 其他

| 数据 | 来源 | 说明 |
|------|------|------|
| ECB Main Rate | ECB 网站 / 手动 | 季度更新 |
| BOJ Call Rate | BOJ / 手动 | 不定期 |
| BOE Bank Rate | BOE / 手动 | 季度更新 |
| 期限溢价 (ACM) | NY Fed | 月度 (v1.0 用近似计算) |

---

## 5. Python Pipeline — 评分引擎

### 5.1 r_f 评分 (0-100)

```python
def score_rf(fed, ecb, boj, boe, tips10y, dgs2, fedfunds):
    # 加权利差
    spread_eur = (fed - ecb) * 0.57    # EUR/USD 占 DXY 57%
    spread_jpy = (fed - boj) * 0.14    # USD/JPY 占 DXY 14%
    spread_gbp = (fed - boe) * 0.12    # GBP/USD 占 DXY 12%
    weighted_spread = spread_eur + spread_jpy + spread_gbp

    # 实际利率：TIPS 10Y 标准化到 0-100
    real_rate_score = normalize(tips10y, min=-1.0, max=3.0)

    # 利率路径：2Y vs Fed Funds
    path_score = normalize(dgs2 - fedfunds, min=-2.0, max=1.0)

    return 0.50 * spread_score + 0.30 * real_rate_score + 0.20 * path_score
```

### 5.2 π_risk 评分 (0-100)

```python
def score_pi_risk(vix, term_premium, move):
    # VIX 标准化 (12=最低风险, 40=最高)
    vix_score = normalize(vix, min=12, max=40)

    # 期限溢价方向
    # TP↓ + VIX↑ = 全球避险 → USD bullish
    # TP↑ + VIX↑ = 美国风险 → USD bearish
    if vix > 20 and term_premium > 100:
        risk_type = "us_specific"   # USD 看空
        tp_effect = -normalize(term_premium, 0, 350)
    else:
        risk_type = "global_risk"   # USD 看多
        tp_effect = normalize(40 - vix, 0, 28)  # VIX↑ 避险

    return 0.60 * vix_score + 0.40 * tp_effect
```

### 5.3 cy 评分 (0-100，越高越拖累 USD)

```python
def score_cy(gold_trend_30d, sofr_iorb_spread, dxy_residual):
    # 黄金 30d 趋势：上涨 = 去美元化信号
    gold_drag = normalize(gold_trend_30d, min=-10, max=20)

    # SOFR-IORB：正 = 抵押品功能健全 = USD 正面
    funding_health = normalize(sofr_iorb_spread, min=-10, max=10)

    # DXY 残差：实际 vs 利率隐含
    residual_score = normalize(dxy_residual, min=-5, max=5)

    return 0.50 * gold_drag + 0.25 * (100 - funding_health) + 0.25 * (100 - residual_score)
```

### 5.4 σ_alert 评分 (0-100) — 12 因子波动率预警引擎

```python
def score_sigma_alert(data):
    """
    美元波动率预警评分引擎

    输入 data dict 包含:
      rr_25d, rr_history_252d,           # F1: Risk Reversal
      dxy_actual, spread_2y_weighted,     # F2: 利差残差
      alpha, beta, residual_history_252d,
      ovx, ovx_52w_series,               # F3: OVX
      vvix, vix, vxn,                    # F4, F5: 波动率结构
      vxhyg, vxhyg_prev,                # F6: 高收益债波动率
      gvz, gvz_prev,                    # F7: 黄金波动率
      tips_1y,                           # F9: 滞胀因子
      qqq_ret, spy_ret,                  # F11: 科技溢出
      cds_ig,                            # F12: 信用修复
    """

    # ═══════════════════════════════════════════
    # 一、直接美元波动率因子 (权重 30%)
    # ═══════════════════════════════════════════

    # ── F1: 3M 25D Risk Reversal ──
    rr_zscore = zscore_rolling(data['rr_25d'], data['rr_history_252d'])
    rr_percentile = percentileofscore(data['rr_history_252d'], data['rr_25d'])
    f1 = normalize(abs(rr_zscore), 0, 2.5) * 100  # 极端偏斜 = 高分
    f1_direction = "push" if abs(rr_zscore) > 0.6 else "neutral"

    # ── F2: 汇率-利差残差 ──
    residual = data['dxy_actual'] - (data['alpha'] + data['beta'] * data['spread_2y_weighted'])
    res_zscore = zscore_rolling(abs(residual), data['residual_history_252d'])
    f2 = normalize(abs(res_zscore), 0, 2.5) * 100  # 错位越大 = 分越高
    f2_direction = "push" if abs(res_zscore) > 0.5 else "neutral"

    # ═══════════════════════════════════════════
    # 二、跨资产波动率因子 (权重 35%)
    # ═══════════════════════════════════════════

    # ── F3: OVX (原油波动率) ──
    ovx_pct = percentileofscore(data['ovx_52w_series'], data['ovx'])
    f3 = normalize(data['ovx'], 50, 150) * 100  # 50=低, 150=极端
    f3_direction = "push" if ovx_pct > 70 else ("suppress" if ovx_pct < 30 else "neutral")

    # ── F4: VVIX/VIX 比值 ──
    vvix_vix_ratio = data['vvix'] / data['vix']
    f4 = normalize(vvix_vix_ratio, 3.0, 6.0) * 100  # 3.0=低, 6.0=极端
    f4_direction = "push" if vvix_vix_ratio > 4.5 else "neutral"

    # ── F5: VIX vs VXN 分化 ──
    vxn_vix_gap = data['vxn'] - data['vix']
    f5 = normalize(vxn_vix_gap, 0, 6) * 100  # 差值越大, 传导风险越高
    f5_direction = "latent_push" if vxn_vix_gap > 2 else "neutral"
    f5_trigger = data['vxn'] > 30  # 传导触发条件

    # ── F6: VXHYG (高收益债波动率) ── [压制因子, 反向计分]
    vxhyg_change = (data['vxhyg'] - data['vxhyg_prev']) / data['vxhyg_prev'] * 100
    f6 = (1 - normalize(data['vxhyg'], 5, 20)) * 100  # 越低=越压制=压制分越高
    f6_direction = "suppress" if vxhyg_change < -15 else "neutral"

    # ── F7: GVZ (黄金波动率) ── [压制因子, 反向计分]
    gvz_change = (data['gvz'] - data['gvz_prev']) / data['gvz_prev'] * 100
    f7 = (1 - normalize(data['gvz'], 15, 45)) * 100  # 越低=越压制
    f7_direction = "suppress" if gvz_change < -5 else "neutral"

    # ═══════════════════════════════════════════
    # 三、交叉复合因子 (权重 35%)
    # ═══════════════════════════════════════════

    # ── F8: RR × 利差残差 (情绪-估值共振) ──
    composite_z = rr_zscore + res_zscore
    is_resonance = (rr_zscore > 0.5 and res_zscore > 0.5) or \
                   (rr_zscore < -0.5 and res_zscore < -0.5)
    f8 = normalize(abs(composite_z), 0, 3.0) * 100
    if is_resonance:
        f8 = min(100, f8 * 1.2)  # 共振加成 20%

    # ── F9: OVX × TIPS 实际利率 (滞胀压力) ──
    stagflation = normalize(data['ovx'], 50, 150) * normalize(data['tips_1y'], 1, 5)
    f9 = min(100, stagflation * 100)
    f9_direction = "push" if data['ovx'] > 80 and data['tips_1y'] > 3 else "neutral"

    # ── F10: VVIX/VIX × RR (尾部风险 × 方向偏斜) ──
    tail_directional = vvix_vix_ratio * abs(data['rr_25d'])
    f10 = normalize(tail_directional, 0, 5.0) * 100
    f10_direction = "push" if tail_directional > 4.0 else "neutral"

    # ── F11: VXN-VIX × QQQ/SPY (科技溢出) ──
    if data['spy_ret'] != 0:
        spillover = vxn_vix_gap * abs(data['qqq_ret'] - data['spy_ret']) / abs(data['spy_ret'])
    else:
        spillover = 0
    f11 = normalize(spillover, 0, 5) * 100
    f11_direction = "latent_push" if f5_trigger else "neutral"

    # ── F12: VXHYG × CDS (信用修复) ── [压制因子]
    credit_calm = normalize(-vxhyg_change, 0, 30) * (1 - normalize(data['cds_ig'], 40, 80))
    f12 = min(100, credit_calm * 100)
    f12_direction = "suppress" if vxhyg_change < -15 and data['cds_ig'] < 65 else "neutral"

    # ═══════════════════════════════════════════
    # 综合评分
    # ═══════════════════════════════════════════

    # 层级权重
    direct_score   = 0.50 * f1 + 0.50 * f2                          # 直接因子 30%
    cross_asset    = 0.30 * f3 + 0.25 * f4 + 0.20 * f5 + 0.15 * f6 + 0.10 * f7  # 跨资产 35%
    composite      = 0.30 * f8 + 0.25 * f9 + 0.20 * f10 + 0.15 * f11 + 0.10 * f12  # 交叉 35%

    # 压制因子修正: 压制因子得分高时, 降低总分
    suppress_count = sum(1 for d in [f6_direction, f7_direction, f12_direction] if d == "suppress")
    suppress_penalty = suppress_count * 5  # 每个压制因子扣 5 分

    sigma_score = 0.30 * direct_score + 0.35 * cross_asset + 0.35 * composite
    sigma_score = max(0, min(100, sigma_score - suppress_penalty))

    # 推升 vs 压制力量对比
    push_factors = sum(1 for d in [f1_direction, f2_direction, f3_direction,
                       f4_direction, f5_direction, f10_direction, f9_direction]
                       if d in ["push", "latent_push"])
    suppress_factors = sum(1 for d in [f6_direction, f7_direction, f12_direction]
                          if d == "suppress")

    # 预警级别
    if sigma_score >= 75 and push_factors >= 5:
        alert_level = "alert"      # 🔴 警报
    elif sigma_score >= 60:
        alert_level = "warning"    # 🟠 预警
    elif sigma_score >= 40:
        alert_level = "watch"      # 🟡 关注
    else:
        alert_level = "calm"       # 🟢 平静

    return sigma_score, alert_level, {
        # 直接因子
        'f1_rr': {'value': data['rr_25d'], 'zscore': rr_zscore, 'percentile': rr_percentile,
                  'score': f1, 'direction': f1_direction},
        'f2_residual': {'value': residual, 'zscore': res_zscore,
                        'score': f2, 'direction': f2_direction},
        # 跨资产因子
        'f3_ovx': {'value': data['ovx'], 'percentile': ovx_pct,
                   'score': f3, 'direction': f3_direction},
        'f4_vvix_vix': {'value': vvix_vix_ratio,
                        'score': f4, 'direction': f4_direction},
        'f5_vxn_vix': {'vix': data['vix'], 'vxn': data['vxn'], 'gap': vxn_vix_gap,
                       'trigger': f5_trigger, 'score': f5, 'direction': f5_direction},
        'f6_vxhyg': {'value': data['vxhyg'], 'change_pct': vxhyg_change,
                     'score': f6, 'direction': f6_direction},
        'f7_gvz': {'value': data['gvz'], 'change_pct': gvz_change,
                   'score': f7, 'direction': f7_direction},
        # 交叉因子
        'f8_rr_residual': {'composite_z': composite_z, 'is_resonance': is_resonance,
                           'score': f8},
        'f9_stagflation': {'ovx': data['ovx'], 'tips': data['tips_1y'],
                           'score': f9, 'direction': f9_direction},
        'f10_tail_directional': {'value': tail_directional,
                                 'score': f10, 'direction': f10_direction},
        'f11_tech_spillover': {'gap': vxn_vix_gap, 'spillover': spillover,
                               'trigger': f5_trigger, 'score': f11, 'direction': f11_direction},
        'f12_credit_repair': {'vxhyg_chg': vxhyg_change, 'cds': data['cds_ig'],
                              'score': f12, 'direction': f12_direction},
        # 汇总
        'push_count': push_factors,
        'suppress_count': suppress_factors,
        'net_direction': 'expansion' if push_factors > suppress_factors else 'compression',
    }
```

### 5.5 综合评分

```python
gamma = 0.35 * rf_score + 0.25 * pi_risk_score - 0.25 * cy_score + 0.15 * sigma_score
# 裁剪到 0-100
gamma = max(0, min(100, gamma + 50))  # 偏移使中性在50附近
```

> **σ_alert 对综合评分的影响逻辑**:
> - σ_alert 高分 = 波动率扩张预期 → 方向取决于 RR (F1) 的符号
> - RR > 0 (看涨偏斜) + 高 σ_alert → 加强 USD 看多信号
> - RR < 0 (看跌偏斜) + 高 σ_alert → 加强 USD 看空信号
> - 在综合评分中，σ_alert 的正负由 RR 方向决定：
>   `sigma_contribution = sigma_score * sign(rr_zscore) * 0.15`
> - **推升/压制力量对比** 作为辅助判断：
>   - 推升 ≥ 5 且 压制 ≤ 1 → σ_alert 权重上调至 0.20
>   - 压制 ≥ 2 且 推升 ≤ 3 → σ_alert 权重下调至 0.10

---

## 6. 响应式设计

| 断点 | 布局 |
|------|------|
| **Desktop (≥1024px)** | 原始多列布局：3列分项卡、2列对冲+收益率、5列汇率网格 |
| **Tablet (768-1023px)** | 分项卡 2+1 排列、汇率网格 3+2、CFTC 全宽 |
| **Mobile (<768px)** | 全部单列堆叠、仪表盘居中缩小、FX 网格 2 列、时间线简化 |

---

## 7. 开发阶段

### Phase 1 — 前端 UI (Mock Data)
- [ ] 项目初始化 (Next.js + Tailwind)
- [ ] Header 组件
- [ ] Score Gauge 仪表盘
- [ ] DXY Stats Grid
- [ ] 三分项卡片 (r_f, π_risk, cy)
- [ ] 波动率预警卡片 (σ_alert: RR + 残差 + 复合信号)
- [ ] 对冲传导 + 收益率分解
- [ ] 汇率对 + CFTC 持仓
- [ ] 信号历史时间线
- [ ] 全局深色主题样式
- [ ] 移动端响应式适配

### Phase 2 — Python Pipeline
- [ ] FRED 数据拉取
- [ ] Yahoo Finance 数据拉取
- [ ] 三分项评分引擎 (r_f, π_risk, cy)
- [ ] 波动率预警评分引擎 (σ_alert: RR, 残差, 复合)
- [ ] 综合评分 + 信号生成
- [ ] JSON 输出

### Phase 3 — 前后端集成
- [ ] Next.js API 路由
- [ ] SWR Hooks 替换 Mock
- [ ] GitHub Actions 每日运行
- [ ] Vercel 部署

### Phase 4 — 增强 (v1.1)
- [ ] CFTC 真实数据接入
- [ ] 央行利率自动抓取
- [ ] 期限溢价 ACM 模型接入
- [ ] 3M 25D RR 精确数据接入 (Bloomberg / Refinitiv API)
- [ ] RR vs 残差散点图可视化
- [ ] 信号历史持久化 (30日+)
- [ ] VSTAR 交易入口

---

## 8. 与 GoldMonitor 差异

| 维度 | GoldMonitor | USDMonitor |
|------|-------------|------------|
| 标的 | XAUUSD 黄金 | DXY 美元指数 |
| 方法论 | XGBoost ML + SHAP | 因子打分模型 (Score) |
| 核心公式 | 9 因子预测 | γ = r_f + π_risk − cy + σ_alert |
| 信号 | Strong Buy / Neutral / Strong Sell | Bullish / Neutral / Bearish |
| 回测 | 有 (ATR仓位管理) | 无 (纯估值模型) |
| 可视化重点 | SHAP瀑布图、IC追踪 | 仪表盘、收益率分解、CFTC持仓、波动率共振预警 |
| 数据源 | FRED + Yahoo + Stooq | FRED + Yahoo + CFTC |

---

## 9. 设计风格

- **主色**: 深蓝黑底 (`#0a0e1a`) — 与 GoldMonitor 统一暗色系
- **强调色**: 金色 (`#fbbf24`) 用于公式和评分
- **信号色**: 绿色 (看多) / 琥珀色 (中性) / 红色 (看空)
- **辅助色**: 青色 (`#06b6d4`) 用于对冲传导模块
- **字体**: Inter (正文) + JetBrains Mono (数据)
- **卡片样式**: 圆角 10px、深色背景 + 细边框、毛玻璃效果

---

## 10. 验收标准

1. 页面加载后能正确显示仪表盘、三分项卡片、汇率网格等所有模块
2. 评分仪表盘根据分数正确着色和定位
3. 三分项卡片内子因子进度条与数值一致
4. 收益率分解堆叠条形图比例正确
5. 风险类型分类框正确高亮当前激活类型
6. 移动端布局合理，无水平溢出
7. Pipeline 输出 JSON 后，前端能自动读取并展示真实数据

---

## 11. Phase 2 — 因子分析模块（Factor Analytics）

> **定位**: 在现有估值看板基础上，新增量化分析层，提供因子有效性验证、Regime 归因、相关性分析和策略净值追踪。采用与 GoldMonitor 对齐的分析页面设计语言。

### 11.1 整体页面结构

页面顶部新增**分析页 Tab 导航栏**，替换或叠加现有估值看板主内容：

| Tab | 副标题 | 内容 |
|-----|--------|------|
| **SHAP 归因** | 瀑布图 | 当日因子贡献分解（瀑布/条形） |
| **IC 追踪** | 信息系数 | 滚动 252 日 IC 时序 + Regime 着色 |
| **Regime** | 热力图 | 各因子在不同利率周期下的 IC 表现热力图 |
| **相关性** | 矩阵 | 因子两两相关性矩阵（色块） |
| **净值曲线** | 账户表现 | 策略虚拟净值 + 最大回撤 + Sharpe |

**Tab 样式**: 圆角胶囊，当前激活 Tab 背景高亮（蓝色描边），非激活半透明。

---

### 11.2 底部全局状态栏（StatusBar）

固定在页面底部，横跨全宽，深色背景 (`#0d1117`)，左右布局：

**左侧（系统状态指示）：**

| 指示项 | 格式 | 说明 |
|--------|------|------|
| 系统正常 / 异常 | `● 系统正常` | 绿点 = 正常，红点 = 异常 |
| 推理引擎 | `XGBoost 推理引擎 · 在线` | 模型服务状态 |
| 数据源 | `FRED+Yahoo · 17:02` | 最后数据更新时间 |
| WebSocket | `VSTAR WebSocket · 连接中` | 实时推送连接状态 |

**右侧（通知计数）：**

| 元素 | 格式 | 说明 |
|------|------|------|
| 警告 | `△ N 警告` | 琥珀色，N=0 时隐藏 |
| 消息 | `🔔 N 条消息` | 蓝色，点击展开通知面板 |

---

### 11.3 IC 追踪模块（IC 追踪 · 信息系数）

**定义**: IC (Information Coefficient) = 因子值与下期收益的 Spearman 秩相关系数，衡量因子预测能力。

#### 11.3.1 因子选择器

- 横向按钮组：**F1 ~ F9**（对应 σ_alert 的 9 个主要子因子）
- 选中 Tab 高亮（深色描边 + 蓝色背景）
- 点击切换后图表和指标卡片联动更新

因子编号映射（建议）：

| 编号 | 因子名 | 对应指标 |
|------|--------|----------|
| F1 | 3M 25D Risk Reversal | 期权偏斜 |
| F2 | MOVE Index | 债券波动率 |
| F3 | VIX | 股权波动率 |
| F4 | OVX | 油价波动率 |
| F5 | 地缘政治风险 | GPR 指数 / 代理指标 |
| F6 | 期限溢价 | ACM 10Y TP |
| F7 | 收益率曲线斜率 | 10Y-2Y |
| F8 | DXY 残差 | OLS 残差偏离 |
| F9 | SOFR-IORB 利差 | 隔夜货币市场 |

#### 11.3.2 指标卡片（4 个）

| 卡片 | 字段 | 说明 |
|------|------|------|
| IC (20d均值) | `ic_ma20` | 近 20 日 IC 移动平均，绿色正值/红色负值 |
| ICIR | `icir` | IC 均值 ÷ IC 标准差，>2 为强因子 |
| 当日 IC | `ic_today` | 最新一日 IC 值 |
| 因子 | `factor_name` | 当前选中因子中文名（蓝色高亮） |

#### 11.3.3 IC 时序图

- **数据**: 滚动 252 交易日（约 1 年）的每日 IC 值
- **图表类型**: ComposedChart
  - 蓝色折线（`ic_daily`）：每日 IC 原始值
  - 橙色虚线（`ic_ma20`）：20 日移动平均
  - 水平参考线（绿色虚线）：`±0.05`（显著性阈值）、`±0.10`（强显著）
- **Regime 背景着色**（三个区间用半透明色块填充时间段）:
  - 🔴 **加息期**（ReferenceArea，红色半透明）
  - 🟢 **降息期**（绿色半透明）
  - ⬜ **震荡期**（灰色半透明）
- **图例**: 右上角 — `● 加息期 ● 降息期 ● 震荡期`
- **X 轴**: 日期（MM-DD 格式）
- **Y 轴**: IC 值范围约 -0.3 ~ +0.3

#### 11.3.4 数据来源

```python
# pipeline 新增输出: ic_tracking.json
{
  "factor": "F5",
  "factor_name": "地缘政治风险",
  "ic_today": 0.1612,
  "ic_ma20": 0.1352,
  "icir": 3.015,
  "history": [
    { "date": "2025-07-10", "ic": 0.08, "ic_ma20": 0.06, "regime": "震荡期" },
    ...
  ]
}
```

---

### 11.4 SHAP 归因模块（SHAP 归因 · 瀑布图）

**定义**: 基于 SHAP (SHapley Additive exPlanations) 分解当日各因子对 γ 评分的边际贡献。

#### 11.4.1 瀑布图（Waterfall Chart）

- 起始基准值（`E[γ]` = 模型期望输出，约 50）
- 每个因子显示一条贡献条：
  - 正贡献（推升 USD）→ 绿色向右延伸
  - 负贡献（压制 USD）→ 红色向左延伸
- 末端显示当日 γ 终值
- 因子按贡献绝对值从大到小排列

#### 11.4.2 数据字段

```python
# pipeline 新增输出: shap.json
{
  "base_value": 50.0,
  "output_value": 58.3,
  "date": "2026-03-21",
  "factors": [
    { "name": "r_f", "shap_value": +4.2, "factor_value": 72 },
    { "name": "π_risk", "shap_value": +3.1, "factor_value": 65 },
    { "name": "cy", "shap_value": -2.8, "factor_value": 44 },
    { "name": "σ_alert", "shap_value": +1.8, "factor_value": 68 },
    { "name": "F5_geo_risk", "shap_value": +1.2, "factor_value": 0.16 },
    ...
  ]
}
```

---

### 11.5 Regime 热力图模块（Regime · 热力图）

**定义**: 各因子在不同利率周期（加息 / 降息 / 震荡）下的平均 IC，以颜色深浅编码表现差异。

#### 11.5.1 热力图布局

- **行**: 因子（F1-F9）
- **列**: Regime 类型（加息期 / 降息期 / 震荡期）
- **单元格颜色**:
  - 深绿 = IC > 0.15（强有效）
  - 浅绿 = IC 0.05~0.15（有效）
  - 灰白 = IC -0.05~0.05（无效）
  - 浅红 = IC < -0.05（负效）
- **单元格文本**: 显示 IC 数值（保留2位小数）

#### 11.5.2 数据结构

```python
# pipeline 新增输出: regime_ic.json
{
  "regimes": ["加息期", "降息期", "震荡期"],
  "factors": ["F1", "F2", ..., "F9"],
  "matrix": [
    [0.12, 0.08, -0.03],   # F1 在三个 Regime 的平均 IC
    [0.18, 0.15,  0.02],   # F2
    ...
  ]
}
```

---

### 11.6 相关性矩阵模块（相关性 · 矩阵）

**定义**: 因子间的 Pearson 相关系数矩阵，用于检测多重共线性风险。

#### 11.6.1 矩阵布局

- N×N 色块矩阵（N = 因子数量，F1-F9 即 9×9）
- **颜色编码**:
  - 深红 = 相关性 > 0.7（高度正相关，风险）
  - 浅红 = 0.3~0.7（中度正相关）
  - 白/灰 = -0.3~0.3（低相关，理想）
  - 浅蓝 = -0.7~-0.3（中度负相关）
  - 深蓝 = < -0.7（高度负相关）
- 对角线固定为 1.0（深色，自相关）
- 悬浮 tooltip 显示精确数值

#### 11.6.2 数据结构

```python
# pipeline 新增输出: correlation.json
{
  "labels": ["F1_rr", "F2_move", ..., "F9_sofr"],
  "matrix": [[1.0, 0.32, ...], ...]
}
```

---

### 11.7 净值曲线模块（净值曲线 · 账户表现）

**定义**: 以γ信号驱动的虚拟策略净值，用于回测评估信号质量。

#### 11.7.1 图表组成

- **主图**: 策略净值折线（初始 = 1.0）vs DXY 指数归一化价格（双Y轴）
- **副图（面积图）**: 策略回撤（drawdown，负值区间，红色填充）
- **统计卡片**（4 个，图表右上角或顶部）:

| 卡片 | 字段 | 说明 |
|------|------|------|
| 累计收益 | `total_return` | 如 +18.3% |
| 年化 Sharpe | `sharpe` | 如 1.82 |
| 最大回撤 | `max_drawdown` | 如 -7.4% |
| 胜率 | `win_rate` | 如 58.3% |

#### 11.7.2 信号映射规则

```
γ > 65 → Long DXY (做多美元)
35 < γ ≤ 65 → Flat (空仓)
γ ≤ 35 → Short DXY (做空美元)
```

#### 11.7.3 数据结构

```python
# pipeline 新增输出: nav_curve.json
{
  "total_return": 0.183,
  "sharpe": 1.82,
  "max_drawdown": -0.074,
  "win_rate": 0.583,
  "history": [
    { "date": "2025-07-10", "nav": 1.000, "dxy_norm": 1.000, "drawdown": 0.0 },
    { "date": "2025-07-11", "nav": 1.008, "dxy_norm": 1.003, "drawdown": 0.0 },
    ...
  ]
}
```

---

### 11.8 Phase 2 新增 Pipeline 输出文件

| 文件 | 对应模块 | 说明 |
|------|----------|------|
| `ic_tracking.json` | IC 追踪 | 每因子的逐日 IC 序列 + Regime 标签 |
| `shap.json` | SHAP 归因 | 当日因子 SHAP 贡献瀑布数据 |
| `regime_ic.json` | Regime 热力图 | 因子 × Regime 平均 IC 矩阵 |
| `correlation.json` | 相关性矩阵 | 因子间 Pearson 相关系数矩阵 |
| `nav_curve.json` | 净值曲线 | 策略净值历史 + 回撤序列 |

### 11.9 Phase 2 新增 API 路由

| 路由 | 文件 |
|------|------|
| `GET /api/ic-tracking?factor=F5` | `app/api/ic-tracking/route.ts` |
| `GET /api/shap` | `app/api/shap/route.ts` |
| `GET /api/regime-ic` | `app/api/regime-ic/route.ts` |
| `GET /api/correlation` | `app/api/correlation/route.ts` |
| `GET /api/nav` | `app/api/nav/route.ts` |

### 11.10 Phase 2 验收标准

1. Tab 切换流畅，各分析模块独立渲染无闪烁
2. IC 时序图 Regime 背景色块边界与实际加/降息时间点对齐
3. 因子选择器（F1-F9）切换后 IC 指标卡片与图表数据联动
4. SHAP 瀑布图各贡献条之和与 `output_value - base_value` 一致
5. 相关性矩阵对角线全为 1.0，颜色渐变合理
6. 净值曲线回撤图与净值主图时间轴对齐
7. 底部状态栏各指示项实时反映系统状态，WebSocket 断连后显示警告
8. VSTAR 交易入口按钮可点击跳转
