# 言葉の旅

可直接部署的静态网页游戏。

当前词库与关卡：

- N5：1120 条词汇，56 个关卡
- N4：1209 条词汇，对应第57至117关（最后一关 9 词）
- N3：1669 条词汇，对应第118至201关（最后一关 9 词）
- N2：2128 条词汇，对应第202至308关（最后一关 8 词）
- 解锁顺序：完成前一关并至少获得1颗星，才能进入下一关
- 本次词表重排后使用全新进度，旧版浏览器进度会自动删除

“我的”页面显示308关主线进度、今日与累计数据。隐藏关卡进度暂按30关展示，后续接入实际隐藏关卡数据。

## 更新词表

原始 Excel 保存在本地的 `source/日语单词词汇表.xlsx`，该目录已设置为不上传 Git。

更新 Excel 后，在项目目录运行：

```bash
python3 tools/convert_vocab.py
```

工具会检查空字段、等级和重复词，并重新生成各等级对应的词表数据文件。

在生成新等级关卡前，先运行检查：

```bash
python3 tools/audit_vocab.py N2
```

检查结果保存在 `reports/`。工具只生成报告，不会修改原始Excel。

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
- `data/n3.js`：N3词表
- `data/n2.js`：N2词表
- `source/`：本地原始 Excel（不会上传 Git）
- `tools/convert_vocab.py`：Excel 词表转换工具
- `js/app.js`：地图、游戏与结算交互
- `js/stages.js`：词汇标准化和关卡生成
- `js/storage.js`：浏览器进度保存
- `assets/`：后续图片、图标和音效

## 部署

这是纯静态项目，可直接上传至 Cloudflare Pages、Netlify、Vercel 或 GitHub Pages。
