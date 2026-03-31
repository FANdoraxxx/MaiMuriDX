# MaiMuriDX 嵌入播放器 API 手册

本手册列出将 MaiMuriDX 播放器嵌入到你自己网页所需的**全部文件、函数、属性、事件和皮肤接口**。

> 此播放器组件**只负责渲染和播放**；难度选择、文件加载、播放控制等 UI 全部由你的网页代码来驱动。

---

## 一、需要引入的文件

按以下**顺序**在你的页面中加载（后面的文件依赖前面的文件）：

| 顺序 | 文件路径 | 作用 |
|:----:|----------|------|
| 1 | `js/core.js` | 常量（画布尺寸、节拍计算、判定圈距离等）和数学工具（坐标变换、Pad 定义） |
| 2 | `js/slide_data.js` | 全部滑键（Slide / Wifi）形状的 SVG 路径数据 |
| 3 | `js/parser.js` | simai 格式（maidata.txt）解析器，输出 Note 对象列表 |
| 4 | `js/renderer.js` | HTML5 Canvas 2D 渲染引擎，绘制所有 Note 类型；包含皮肤切换逻辑 |
| 5 | `player.js` | **嵌入 API 主文件**，暴露 `createMaiPlayer()` 工厂函数 |

最小 HTML 模板：

```html
<!-- 播放器画布（尺寸固定 540×540） -->
<canvas id="unity-canvas" width="540" height="540"></canvas>

<!-- 按顺序加载脚本 -->
<script src="js/core.js"></script>
<script src="js/slide_data.js"></script>
<script src="js/parser.js"></script>
<script src="js/renderer.js"></script>
<script src="player.js"></script>

<script>
  // 初始化播放器
  const player = await createMaiPlayer('unity-canvas', { showTimer: true });
  // 加载谱面文字
  await player.loadChart(maidataText, '5');
  // 开始播放
  player.play();
</script>
```

---

## 二、工厂函数 `createMaiPlayer()`

```js
const player = await createMaiPlayer(canvasIdOrElement, options);
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `canvasIdOrElement` | `string \| HTMLCanvasElement` | ✅ | `<canvas>` 元素的 `id` 字符串，或元素本身 |
| `options.showTimer` | `boolean` | ❌ | `true` 时在画布左上角叠加显示当前时间（默认 `false`） |
| `options.skin` | `Object` | ❌ | 初始皮肤配置，格式与 `setSkin()` 相同（见第五节） |

**返回值**：`Promise<MaiPlayer>`（`await` 之后即可调用所有方法）

---

## 三、`MaiPlayer` 方法

### 3.1 谱面加载

#### `player.loadChart(maidataText, difficulty?)`

解析并加载一首谱面。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `maidataText` | `string` | ✅ | maidata.txt 的完整文字内容（含 `&title=` 等头部）或纯谱面字符串 |
| `difficulty` | `string \| number` | ❌ | 难度槽位 `'1'`–`'7'`（1=Easy … 6=Re:Master, 7=Utage）；省略时自动选最高难度 |

**返回值**：`Promise<void>`（resolve 时第一帧已绘制，并触发 `chartloaded` 事件）

```js
await player.loadChart(text, '5');   // 加载 Master
await player.loadChart(text);        // 自动选最高难度
```

---

#### `player.setDifficulty(difficulty)`

在**已加载**的 maidata 中切换到另一个难度，无需重新传入文字。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `difficulty` | `string \| number` | ✅ | 目标难度槽位 `'1'`–`'7'` |

**返回值**：`Promise<void>`

```js
await player.setDifficulty('4');  // 切换到 Expert
```

---

### 3.2 播放控制

| 方法 | 说明 |
|------|------|
| `player.play()` | 开始播放 / 从暂停位置继续播放 |
| `player.pause()` | 暂停播放（保留当前位置） |
| `player.reset()` | 停止并倒回起始位置（谱面第一个 Note 前 3 秒） |

---

### 3.3 进度跳转

#### `player.seekToSeconds(seconds)`

跳转到指定的秒数位置（可在播放中调用，会继续播放）。

```js
player.seekToSeconds(30.5);   // 跳到第 30.5 秒
```

#### `player.seekToTicks(ticks)`

按"节拍刻度"跳转（1 秒 = 180 ticks）。

```js
player.seekToTicks(5400);     // 跳到第 30 秒（30 × 180）
```

---

### 3.4 皮肤设置

#### `player.setSkin(skinConfig)`

替换一个或多个 Note 的外观贴图（详见第五节）。

**返回值**：`Promise<void>`（所有图片加载完成后 resolve）

```js
await player.setSkin({ tap: '/img/tap.png', tapEach: '/img/each.png' });
```

---

### 3.5 MaiCreator 兼容接口

#### `player.SendMessage(objectName, method, value)`

与原版 Unity WebGL 一致的消息接口，便于直接移植现有的调用代码。

| 参数 | 类型 | 说明 |
|------|------|------|
| `objectName` | `string` | 被忽略，传任意字符串（如 `'Player'`）即可 |
| `method` | `string` | 指令名称（见下表） |
| `value` | `string` | 指令的参数（字符串形式） |

**返回值**：`MaiPlayer` 本身（可链式调用）

支持的 method / value 组合：

| method | value 格式 | 等价的直接调用 |
|--------|-----------|---------------|
| `'LoadChart'` | JSON `{ text, difficulty? }` 或纯 maidata 文字 | `loadChart(text, diff)` |
| `'Play'` | `''` | `play()` |
| `'Pause'` | `''` | `pause()` |
| `'Reset'` | `''` | `reset()` |
| `'SeekTo'` | 秒数字符串，如 `'30.5'` | `seekToSeconds(30.5)` |
| `'SeekToTicks'` | ticks 字符串，如 `'5400'` | `seekToTicks(5400)` |
| `'SetDifficulty'` | 难度字符串，如 `'5'` | `setDifficulty('5')` |
| `'SetSkin'` | JSON 皮肤配置字符串 | `setSkin({…})` |

```js
player.SendMessage('Player', 'Play', '');
player.SendMessage('Player', 'SeekTo', '30.5');
player.SendMessage('Player', 'SetSkin', JSON.stringify({ tap: '/img/tap.png' }));
player.SendMessage('Player', 'LoadChart',
  JSON.stringify({ text: maidataText, difficulty: '5' }));
```

---

## 四、`MaiPlayer` 只读属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `player.currentTicks` | `number` | 当前播放位置（ticks，180 ticks = 1 秒），暂停时也有值 |
| `player.currentSeconds` | `number` | 当前播放位置（秒） |
| `player.isPlaying` | `boolean` | 是否正在播放 |
| `player.noteCount` | `number` | 当前已加载谱面的 Note 总数 |
| `player.durationTicks` | `number` | 谱面总长度（ticks），未加载时为 `0` |
| `player.durationSeconds` | `number` | 谱面总长度（秒） |

---

## 五、事件

`MaiPlayer` 继承自 `EventTarget`，使用 `addEventListener` 监听：

```js
player.addEventListener('事件名', (e) => { /* e.detail 见下表 */ });
```

| 事件名 | 触发时机 | `e.detail` 内容 |
|--------|---------|-----------------|
| `'ready'` | 播放器初始化完成，画布已绘制 | `null` |
| `'chartloaded'` | 谱面解析完成，第一帧已绘制 | `{ title, artist, difficulties, noteCount, durationTicks }` |
| `'play'` | 播放开始 / 从暂停恢复 | `null` |
| `'pause'` | 播放暂停 | `null` |
| `'reset'` | 已倒回起始位置 | `null` |
| `'ended'` | 谱面播放到末尾自动停止 | `null` |
| `'timeupdate'` | 每个动画帧触发（约 60 fps） | `{ ticks: number, seconds: number }` |
| `'error'` | 解析或播放出错 | `{ message: string }` |

`chartloaded` 事件的 `e.detail` 字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 曲目标题（来自 `&title=`） |
| `artist` | `string` | 艺术家（来自 `&artist=`） |
| `difficulties` | `string[]` | 可用难度列表，如 `['1','2','5']` |
| `noteCount` | `number` | 当前难度的 Note 总数 |
| `durationTicks` | `number` | 谱面时长（ticks） |

---

## 六、皮肤（Skin）接口

调用 `setSkin()` 时传入一个对象，键为 Note 类型槽位，值为图片来源。

### 支持的皮肤槽位

| 槽位键 | 替换的元素 | 图片尺寸建议 |
|--------|-----------|------------|
| `tap` | 普通 Tap Note 圆圈 | 64×64 或 128×128 |
| `tapEach` | Each Tap Note（黄色） | 64×64 |
| `tapBreak` | Break Tap Note（橙红色） | 64×64 |
| `tapStar` | Slide 头 / Star Tap Note（蓝色） | 64×64 |
| `hold` | Hold Note 头部圆圈 | 64×64 |
| `holdTrail` | Hold Note 连接轨道（纵向平铺） | 任意宽度，高度决定一块瓦片的长度 |
| `touch` | Touch Note（绿色环形） | 64×64 |
| `touchHold` | TouchHold Note（绿色持续环） | 64×64 |
| `slideStar` | Slide 引导星（随方向旋转） | 48×48 |
| `wifiStar` | Wifi 引导星 | 48×48 |

> 未设置（值为 `null`）的槽位保留内置的程序化绘制效果。

### 值的类型

每个槽位可以接受：

| 值类型 | 说明 |
|--------|------|
| `string` | 图片 URL（相对或绝对路径均可，包括 `blob:` / `data:` URL） |
| `HTMLImageElement` | 已经加载完毕的 `<img>` 元素 |
| `ImageBitmap` | 通过 `createImageBitmap()` 创建的位图 |
| `null` | 清除该槽位皮肤，还原为内置绘制 |

### 示例

```js
// 方式一：传 URL 字符串（异步加载）
await player.setSkin({
  tap:      '/skins/tap.png',
  tapEach:  '/skins/each.png',
  tapBreak: '/skins/break.png',
  tapStar:  '/skins/star.png',
  hold:     '/skins/hold.png',
  slideStar: '/skins/slide_star.png',
});

// 方式二：传已创建的 Image 对象
const img = new Image();
img.src = '/skins/tap.png';
await new Promise(r => img.onload = r);
await player.setSkin({ tap: img });

// 方式三：通过 SendMessage（值为 JSON 字符串）
player.SendMessage('Player', 'SetSkin',
  JSON.stringify({ tap: '/skins/tap.png', tapEach: '/skins/each.png' }));

// 方式四：清除单个皮肤（还原内置）
await player.setSkin({ tap: null });
```

---

## 七、完整最小嵌入示例

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>

<!-- 1. 画布（你自己决定放在哪、加什么 CSS） -->
<canvas id="unity-canvas" width="540" height="540" style="border:1px solid #333;"></canvas>

<!-- 2. 你自己的控制 UI，随意布局 -->
<button id="btnPlay">播放</button>
<button id="btnPause">暂停</button>
<button id="btnReset">重置</button>
<input type="range" id="seekBar" min="0" max="1" step="0.001" value="0">
<select id="diffSel"></select>

<!-- 3. 引擎脚本（顺序不能变） -->
<script src="js/core.js"></script>
<script src="js/slide_data.js"></script>
<script src="js/parser.js"></script>
<script src="js/renderer.js"></script>
<script src="player.js"></script>

<script>
(async () => {
  // ---- 初始化播放器 ----
  const player = await createMaiPlayer('unity-canvas', {
    showTimer: true,                        // 叠加时间显示
    skin: { tap: '/skins/tap.png' }         // 初始皮肤（可选）
  });

  // ---- 事件监听 ----
  player.addEventListener('chartloaded', (e) => {
    const { title, artist, difficulties, noteCount, durationTicks } = e.detail;
    console.log(`已加载: ${title} — ${noteCount} notes`);

    // 填充难度下拉框
    const sel = document.getElementById('diffSel');
    sel.innerHTML = '';
    difficulties.forEach(d => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = d;
      sel.appendChild(opt);
    });
    sel.value = difficulties[difficulties.length - 1];

    // 设置进度条最大值
    document.getElementById('seekBar').max = durationTicks;
  });

  player.addEventListener('timeupdate', (e) => {
    document.getElementById('seekBar').value = Math.max(0, e.detail.ticks);
  });

  player.addEventListener('ended', () => console.log('播放完毕'));
  player.addEventListener('error', (e) => console.error(e.detail.message));

  // ---- 按钮绑定 ----
  document.getElementById('btnPlay').onclick  = () => player.play();
  document.getElementById('btnPause').onclick = () => player.pause();
  document.getElementById('btnReset').onclick = () => player.reset();

  document.getElementById('seekBar').addEventListener('change', (e) => {
    player.seekToTicks(+e.target.value);
  });

  document.getElementById('diffSel').addEventListener('change', (e) => {
    player.setDifficulty(e.target.value);
  });

  // ---- 加载谱面（示例：从 fetch 获取） ----
  const response = await fetch('/path/to/maidata.txt');
  const text = await response.text();
  await player.loadChart(text);   // 自动选最高难度
})();
</script>

</body>
</html>
```

---

## 八、难度槽位对照表

| 槽位值 | 难度名称 |
|:------:|---------|
| `'1'` | Easy |
| `'2'` | Basic |
| `'3'` | Advanced |
| `'4'` | Expert |
| `'5'` | Master |
| `'6'` | Re:Master |
| `'7'` | Utage（宴会場） |

---

## 九、时间单位说明

播放器内部使用**节拍刻度（ticks）**而非秒：

```
1 秒 = 180 ticks（JUDGE_TPS）
ticks = seconds × 180
seconds = ticks / 180
```

谱面开始前有 **3 秒（540 ticks）** 的预备段，此时 `currentTicks` 为负值（从 `-540` 开始计数）。

---

## 十、注意事项

1. **无音频同步**：播放器是纯视觉渲染，不含音频播放；音乐同步需要你在网页端自行实现（例如用 Web Audio API 或 `<audio>` 元素）。
2. **画布尺寸固定**：渲染引擎按 540×540 设计，如需缩放请用 CSS `transform: scale()` 或 `width/height` 样式，不要直接修改 `canvas.width/height`。
3. **脚本加载顺序**：`player.js` 必须在其余四个脚本之后加载。
4. **跨域图片**：使用 URL 字符串设置皮肤时，图片服务器需要允许跨域（`Access-Control-Allow-Origin`），否则 Canvas 会被污染。
5. **`setSkin()` 可随时调用**：包括播放中途，下一帧立即生效。
