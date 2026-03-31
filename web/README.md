# MaiMuriDX Web Renderer

基于 [MaiMuriDX](https://github.com/FANdoraxxx/MaiMuriDX) 的浏览器端 maidata 谱面渲染器移植。

## 功能

- 在浏览器中渲染 maimai DX 的 maidata 格式谱面
- 支持所有 Note 类型：Tap、Hold、Touch、TouchHold、Slide（所有形状）、Wifi
- 无需安装 Python 或 pygame，直接在浏览器中运行
- 支持多难度选择（Easy / Basic / Advanced / Expert / Master / Re:Master / Utage）

## 使用方法

1. 在浏览器中打开 `web/index.html`（可直接双击打开，或通过 HTTP 服务器访问）
2. 点击 **"选择 maidata.txt"** 加载谱面文件，或将 maidata.txt 内容粘贴到文本框中
3. 选择想要预览的 **难度**
4. 点击 **"加载选中难度"**（加载完成后会自动加载默认最高难度）
5. 点击 **"播放"** 开始动画预览

## 渲染效果

| 元素 | 颜色 | 说明 |
|------|------|------|
| Tap | 白色 | 从中心向外扩展 |
| Each | 黄色 | 同时出现的多个 Note |
| Break | 橙红色 | Break Note |
| Slide 头 | 蓝色 | 滑键起始星型 |
| Hold | 粉红色 | 长押键及连接条 |
| Touch | 绿色 | 触摸区域 |
| Slide 轨道 | 白色半透明 | 滑键路径 |
| Slide 星 | 白色钻石形 | 沿轨道移动的引导星 |

## 技术实现

- **HTML5 Canvas 2D** 渲染引擎
- **SVG Path API**（`Path2D`, `SVGPathElement`）用于滑键轨道绘制和路径位置计算
- 完整的 simai 格式解析器（移植自 `majparse.py`）
- 所有滑键形状的 SVG 路径数据（直线、圆弧、U形、V形、L形、Wifi 等）
- 无外部依赖，纯原生 JavaScript

## 文件结构

```
web/
├── index.html          # 主页面
└── js/
    ├── core.js         # 常量和数学工具（板区定义、距离变换等）
    ├── slide_data.js   # 所有滑键 SVG 路径数据及生成函数
    ├── parser.js       # simai 格式解析器
    ├── renderer.js     # Canvas 2D 渲染器
    └── app.js          # 主应用逻辑（加载、播放控制）
```

## 注意事项

- 本工具仅为**视觉预览**，不含音频同步功能
- 渲染速度基于实际时钟，与原曲 BPM 和 first 参数同步
- 与原版 Python 渲染器的主要区别：使用程序化绘制代替精灵图，整体视觉风格有所不同
