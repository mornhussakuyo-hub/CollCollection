# 全国大学宿舍情况查询

这是一个纯静态页面，用于查询全国院校宿舍与校园生活相关信息。数据已导出到 `data.js` 供浏览器直接读取，不需要后端服务。

查询结果仅供参考，请以学校最新公开信息为准。同一学校的不同校区会显示在同一张学校结果卡片中，不会拆分为多个校区单独查询。

## 功能

- 按省份、城市逐级筛选。
- 按学校名称在全称中匹配查询。
- 缺失字段会显示为“缺少数据”。
- 支持移动端访问。

## 信息反馈

如果发现信息有误、过期或缺失，可以通过以下方式反馈：

- 提交 GitHub Issue。
- 直接提交 Pull Request 修正数据或页面。
- 直接联系 QQ：2564664062。

## 本地打开

直接用浏览器打开 `index.html` 即可使用。

## 重新生成数据

```bash
python3 scripts/extract-xlsx-data.py
```

脚本会清理原表中的明显宣传占位文本，并把 Excel 时间小数转换成 `HH:MM`。源表文件已在 `.gitignore` 中忽略，不纳入仓库提交。

## GitHub Pages 部署

可以部署到 GitHub Pages。在仓库设置中打开 `Settings -> Pages`，选择：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

保存后，GitHub 会发布 `index.html`、`styles.css`、`app.js` 和 `data.js`。

## License

MIT
