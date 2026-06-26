const data = window.DORM_DATA || { fields: [], rows: [] };
const fieldIndex = Object.fromEntries(data.fields.map((field, index) => [field, index]));

const provinceSelect = document.querySelector("#provinceSelect");
const citySelect = document.querySelector("#citySelect");
const schoolInput = document.querySelector("#schoolInput");
const resetButton = document.querySelector("#resetButton");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#resultCount");
const activeFilters = document.querySelector("#activeFilters");
const recordCount = document.querySelector("#recordCount");

const MISSING_TEXT = "缺少数据";
const ALL_MISSING_TEXT = "缺失所有数据";
const FOREIGN_REGIONS = new Set(["马来西亚"]);
const primaryFields = ["上床下桌", "几人间", "宿舍空调", "独立卫浴", "洗衣机", "夜间断电", "夜间断网", "校园网速度"];
const moreFields = [
  "洗澡热水时段",
  "教室空调",
  "通宵自习室",
  "宿舍限电瓦数",
  "校园网价格",
  "大一带电脑",
  "查寝情况",
  "晚归门禁时间",
  "早晚自习",
  "晨跑要求",
  "跑步打卡要求",
  "地铁",
  "⭐市区距离",
  "学校交通便利",
  "点外卖",
  "食堂价格感受",
  "超市价格感受",
  "收发快递",
  "共享单车",
];

const valueOf = (row, field) => row[fieldIndex[field]] || "";
const displayValue = (value) => value || MISSING_TEXT;
const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
const dedupedRows = uniqueRows(data.rows);
const schoolGroups = buildSchoolGroups(dedupedRows);

function option(value, label = value) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function canonicalSchoolName(name) {
  return name.replace(/[（(][^）)]*校区[^）)]*[）)]/g, "").trim();
}

function campusFromSchoolName(name) {
  const match = name.match(/[（(]([^）)]*校区[^）)]*)[）)]/);
  return match ? match[1].trim() : "";
}

function displayProvince(row) {
  const province = valueOf(row, "省份");
  return FOREIGN_REGIONS.has(province) ? "外国" : province;
}

function displayCity(row) {
  const province = valueOf(row, "省份");
  const city = valueOf(row, "城市");
  return FOREIGN_REGIONS.has(province) ? [province, city].filter(Boolean).join(" / ") : city;
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.join("\u001f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSchoolGroups(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const schoolName = valueOf(row, "院校名称");
    const canonicalName = canonicalSchoolName(schoolName) || schoolName;
    if (!groups.has(canonicalName)) {
      groups.set(canonicalName, { name: canonicalName, rows: [], rowKeys: new Map() });
    }

    const group = groups.get(canonicalName);
    const rowKey = [valueOf(row, "省份"), valueOf(row, "城市"), valueOf(row, "院校地址")].join("\u001f");
    const existingIndex = group.rowKeys.get(rowKey);
    if (existingIndex === undefined) {
      group.rowKeys.set(rowKey, group.rows.length);
      group.rows.push(row);
    } else {
      group.rows[existingIndex] = mergeRows(group.rows[existingIndex], row);
    }
  });

  return [...groups.values()]
    .map(({ name, rows }) => ({ name, rows }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function mergeRows(baseRow, nextRow) {
  return data.fields.map((_, index) => {
    const baseValue = baseRow[index] || "";
    const nextValue = nextRow[index] || "";
    if (!baseValue) return nextValue;
    if (!nextValue || nextValue === baseValue) return baseValue;

    return unique(`${baseValue}；${nextValue}`.split(/[;；]/).map((value) => value.trim())).join("；");
  });
}

function highlight(value, query) {
  const safeValue = escapeHtml(value || "");
  if (!query) return safeValue;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safeValue.replace(new RegExp(escapedQuery, "gi"), (match) => `<mark>${match}</mark>`);
}

function populateProvinces() {
  unique(dedupedRows.map(displayProvince)).forEach((province) => {
    provinceSelect.appendChild(option(province));
  });
}

function populateCities() {
  const province = provinceSelect.value;
  citySelect.replaceChildren(option("", province ? "全部城市" : "请先选择省份"));
  citySelect.disabled = !province;

  if (!province) return;

  const cities = unique(
    dedupedRows.filter((row) => displayProvince(row) === province).map(displayCity),
  );
  cities.forEach((city) => citySelect.appendChild(option(city)));
}

function currentMatches() {
  const province = provinceSelect.value;
  const city = citySelect.value;
  const query = schoolInput.value.trim();

  return schoolGroups.filter((group) => {
    return group.rows.some((row) => {
      const byProvince = !province || displayProvince(row) === province;
      const byCity = !city || displayCity(row) === city;
      const bySchool = !query || valueOf(row, "院校名称").includes(query) || group.name.includes(query);
      return byProvince && byCity && bySchool;
    });
  });
}

function describeFilters() {
  const filters = [];
  if (provinceSelect.value) filters.push(`省份：${provinceSelect.value}`);
  if (citySelect.value) filters.push(`城市：${citySelect.value}`);
  if (schoolInput.value.trim()) filters.push(`学校名称包含：${schoolInput.value.trim()}`);
  return filters.length ? filters.join(" / ") : "未选择筛选条件";
}

function hasActiveFilter() {
  return Boolean(provinceSelect.value || citySelect.value || schoolInput.value.trim());
}

function hasAnyDetailData(row) {
  return [...primaryFields, ...moreFields].some((field) => valueOf(row, field));
}

function renderDetailItems(row) {
  if (!hasAnyDetailData(row)) {
    return `<div class="all-missing">${ALL_MISSING_TEXT}</div>`;
  }

  return [...primaryFields, ...moreFields]
    .map((field) => {
      const value = valueOf(row, field);
      const missingClass = value ? "" : " is-missing";
      return `<div class="item${missingClass}"><b>${escapeHtml(field.replace("⭐", ""))}</b><span>${escapeHtml(displayValue(value))}</span></div>`;
    })
    .join("");
}

function renderCampusSummary(group) {
  const campuses = unique(
    group.rows.flatMap((row) => {
      const campusField = valueOf(row, "⭐存在多校区")
        .split(/[;；]/)
        .map((item) => item.trim());
      return [...campusField, campusFromSchoolName(valueOf(row, "院校名称"))];
    }),
  );

  const value = campuses.length ? campuses.join("；") : MISSING_TEXT;
  return `<div class="campus${campuses.length ? "" : " is-missing"}"><strong>校区：</strong>${escapeHtml(value)}</div>`;
}

function renderGroupMeta(group) {
  const fields = ["省份", "城市", "层次", "性质", "城市类"];
  return fields
    .map((field) => {
      const values = group.rows.map((row) => {
        if (field === "省份") return displayProvince(row);
        if (field === "城市") return displayCity(row);
        return valueOf(row, field);
      });
      const value = unique(values).join(" / ");
      return `<span class="tag${value ? "" : " is-missing"}"><b>${escapeHtml(field.replace("城市类", "城市等级"))}</b>${escapeHtml(displayValue(value))}</span>`;
    })
    .join("");
}

function renderRecord(row, groupSize, query) {
  const schoolName = valueOf(row, "院校名称");
  const address = valueOf(row, "院校地址");
  const details = renderDetailItems(row);

  return `
    <section class="record">
      ${
        groupSize > 1
          ? `<div class="record-title">
              <strong>${highlight(schoolName, query)}</strong>
              <span>${escapeHtml(displayProvince(row))} / ${escapeHtml(displayCity(row))}</span>
            </div>`
          : ""
      }
      <p class="address${address ? "" : " is-missing"}"><strong>地址：</strong>${escapeHtml(displayValue(address))}</p>
      ${details ? `<div class="details">${details}</div>` : ""}
    </section>
  `;
}

function renderCard(group) {
  const query = schoolInput.value.trim();
  const campusSummary = renderCampusSummary(group);

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="school">${highlight(group.name, query)}</h2>
          <div class="meta">${renderGroupMeta(group)}</div>
        </div>
        ${campusSummary}
      </div>
      ${group.rows.map((row) => renderRecord(row, group.rows.length, query)).join("")}
    </article>
  `;
}

function render() {
  if (!hasActiveFilter()) {
    resultCount.textContent = "等待查询";
    activeFilters.textContent = `${schoolGroups.length} 所学校`;
    results.innerHTML = '<div class="empty">选择省份、城市或输入学校名称后显示查询结果。</div>';
    return;
  }

  const matches = currentMatches();
  resultCount.textContent = `${matches.length} 所学校`;
  activeFilters.textContent = describeFilters();

  if (!matches.length) {
    results.innerHTML = '<div class="empty">没有找到匹配记录，请调整省份、城市或学校名称。</div>';
    return;
  }

  results.innerHTML = matches.map(renderCard).join("");
}

function reset() {
  provinceSelect.value = "";
  schoolInput.value = "";
  populateCities();
  render();
}

recordCount.textContent = `${schoolGroups.length} 所学校`;
populateProvinces();
populateCities();
render();

provinceSelect.addEventListener("change", () => {
  populateCities();
  render();
});
citySelect.addEventListener("change", render);
schoolInput.addEventListener("input", render);
resetButton.addEventListener("click", reset);
