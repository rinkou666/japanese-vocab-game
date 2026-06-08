# 日本語語彙マッチ

可直接部署的静态网页游戏。

当前词库与关卡：

- N5：1120 条词汇，56 个关卡
- N4：1209 条词汇，对应第57至117关（最后一关 9 词）
- 解锁顺序：完成第56关后进入 N4 第57关

## 本地预览

在本目录启动静态服务器：

```bash
python3 -m http.server 8787
```

然后访问 `http://127.0.0.1:8787/`。

## 目录

- `index.html`：页面结构
- `css/styles.css`：全部界面样式
- `data/n5.js`：N5词表
- `data/n4.js`：N4词表
- `js/app.js`：地图、游戏与结算交互
- `js/stages.js`：词汇标准化和关卡生成
- `js/storage.js`：浏览器进度保存
- `assets/`：后续图片、图标和音效

## 部署

这是纯静态项目，可直接上传至 Cloudflare Pages、Netlify、Vercel 或 GitHub Pages。
