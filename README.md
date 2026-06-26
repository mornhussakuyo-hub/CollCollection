# 全国大学宿舍情况查询

这是一个纯静态页面，数据已导出到 `data.js` 供浏览器直接读取。查询结果仅供参考，请以学校最新公开信息为准。

## 本地打开

直接用浏览器打开 `index.html` 即可使用。

## 重新生成数据

```bash
python3 scripts/extract-xlsx-data.py
```

脚本会清理原表中的明显宣传占位文本，并把 Excel 时间小数转换成 `HH:MM`。源表文件已在 `.gitignore` 中忽略，不纳入仓库提交。

## GitHub Pages 部署

可以部署到 GitHub Pages。把本目录提交到 GitHub 仓库后，在仓库设置中打开 `Settings -> Pages`，选择：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

保存后，GitHub 会发布 `index.html`、`styles.css`、`app.js` 和 `data.js`。
