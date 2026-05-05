const state = {
  firms: [],
  finance: new Map(),
  fleetRecords: [],
  fleetCategory: "All",
  thresholds: {
    tanker: 60,
    bulk: 70,
    opposite: 35,
  },
  filter: "all",
  search: "",
};

const COLORS = {
  "Tanker core": "#0f766e",
  "Dry bulk core": "#b45309",
  "Mixed / review": "#475569",
  Excluded: "#991b1b",
};

const GROUP_LABEL = {
  "Tanker core": "탱커 주력",
  "Dry bulk core": "벌커 주력",
  "Mixed / review": "혼합·검토",
  Excluded: "제외",
};

const FLEET_CATEGORIES = [
  ["All", "전체"],
  ["Dry bulk", "벌크선"],
  ["Tanker", "탱커선"],
  ["Container", "컨테이너선"],
  ["Gas carrier", "가스선"],
  ["General cargo", "일반화물선"],
  ["Offshore", "오프쇼어"],
  ["Passenger", "여객선"],
  ["Other", "기타"],
];

const $ = (id) => document.getElementById(id);

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned || cleaned.toUpperCase() === "N/A") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function fmtPct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${fmtNumber(value, 0)}%`;
}

function fmtMultiple(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${fmtNumber(value, 1)}x`;
}

function normalizeFirm(row) {
  return {
    Firm_ID: row.Firm_ID ?? row.firm_id ?? "",
    Company_Name: row.Company_Name ?? row.company_name ?? row.Company ?? "",
    RIC: row.RIC ?? row.Ticker ?? row.Symbol ?? "",
    Verdict_Fleet_Description:
      row.Verdict_Fleet_Description ??
      row["Verdict / Fleet Description"] ??
      row.Description ??
      "",
    Segment: row.Segment ?? "",
    Tanker_Pct: parseNumber(row.Tanker_Pct ?? row["Tanker_%"] ?? row.Tanker) ?? 0,
    DryBulk_Pct: parseNumber(row.DryBulk_Pct ?? row["DryBulk_%"] ?? row.DryBulk) ?? 0,
    Research_Group: row.Research_Group ?? "",
    Included: row.Included ?? "",
    Exclude_Reason: row.Exclude_Reason ?? "",
  };
}

function normalizeFinance(row) {
  const ric = row.RIC ?? row.Ticker ?? row.Symbol ?? "";
  if (!ric) return null;
  return {
    RIC: ric,
    Fiscal_Year: row.Fiscal_Year ?? row.Year ?? "",
    Currency: row.Currency ?? "",
    Market_Cap: parseNumber(row.Market_Cap ?? row.MarketCap),
    Enterprise_Value: parseNumber(row.Enterprise_Value ?? row.EV),
    Revenue: parseNumber(row.Revenue),
    EBITDA: parseNumber(row.EBITDA),
    EBIT: parseNumber(row.EBIT),
    Net_Income: parseNumber(row.Net_Income ?? row.NetIncome),
    Total_Debt: parseNumber(row.Total_Debt ?? row.Debt),
    Cash: parseNumber(row.Cash),
    Book_Equity: parseNumber(row.Book_Equity ?? row.Equity),
    Fleet_Total: parseNumber(row.Fleet_Total),
    Fleet_Tankers: parseNumber(row.Fleet_Tankers),
    Fleet_Bulkers: parseNumber(row.Fleet_Bulkers),
    DWT_Total: parseNumber(row.DWT_Total),
    Source: row.Source ?? "",
    Source_Date: row.Source_Date ?? "",
    Notes: row.Notes ?? "",
  };
}

function normalizeFleetRecord(row) {
  const company =
    row.Company_Name ??
    row.Company ??
    row.Operator ??
    row.Owner ??
    row.Registered_Owner ??
    row.Beneficial_Owner ??
    "";
  const shipType = row.Ship_Type ?? row.Vessel_Type ?? row.Type ?? row.ShipType ?? "";
  if (!company || !shipType) return null;
  return {
    Company_Name: String(company).trim(),
    RIC: row.RIC ?? row.Ticker ?? "",
    IMO: String(row.IMO ?? row.IMO_Number ?? "").trim(),
    Vessel_Name: String(row.Vessel_Name ?? row.Ship_Name ?? row.Name ?? "").trim(),
    Ship_Type: String(shipType).trim(),
    Ship_Type_Detail: String(row.Ship_Type_Detail ?? row.Type_Detail ?? "").trim(),
    Major_Type: majorShipType(shipType),
    DWT: parseNumber(row.DWT),
    GT: parseNumber(row.GT),
    Flag: row.Flag ?? "",
    Source: row.Source ?? "",
    Source_Date: row.Source_Date ?? "",
  };
}

function majorShipType(shipType) {
  const text = String(shipType).toLowerCase();
  if (text.includes("bulk") || text.includes("bulker")) return "Dry bulk";
  if (text.includes("lng") || text.includes("lpg") || text.includes("gas")) return "Gas carrier";
  if (
    text.includes("tanker") ||
    text.includes("oil") ||
    text.includes("chemical") ||
    text.includes("product")
  ) {
    return "Tanker";
  }
  if (text.includes("container")) return "Container";
  if (text.includes("general cargo") || text.includes("multi-purpose") || text.includes("multipurpose")) {
    return "General cargo";
  }
  if (text.includes("offshore") || text.includes("supply") || text.includes("platform")) return "Offshore";
  if (text.includes("passenger") || text.includes("ferry") || text.includes("cruise")) return "Passenger";
  return "Other";
}

function classify(firm) {
  const desc = `${firm.Verdict_Fleet_Description} ${firm.Exclude_Reason}`.toLowerCase();
  const tanker = firm.Tanker_Pct;
  const bulk = firm.DryBulk_Pct;

  if (
    desc.includes("exclude") ||
    desc.includes("insufficient trading data") ||
    desc.includes("combination carrier")
  ) {
    return {
      group: "Excluded",
      reason: desc.includes("insufficient trading data")
        ? "거래 데이터 부족"
        : desc.includes("combination carrier")
          ? "복합선/혼합 운항"
          : "원자료 제외 표시",
    };
  }

  if (tanker >= state.thresholds.tanker && bulk <= state.thresholds.opposite) {
    return {
      group: "Tanker core",
      reason: `탱커 ${fmtPct(tanker)}, 벌커 ${fmtPct(bulk)}`,
    };
  }

  if (bulk >= state.thresholds.bulk && tanker <= state.thresholds.opposite) {
    return {
      group: "Dry bulk core",
      reason: `벌커 ${fmtPct(bulk)}, 탱커 ${fmtPct(tanker)}`,
    };
  }

  return {
    group: "Mixed / review",
    reason: `혼합 노출: 탱커 ${fmtPct(tanker)}, 벌커 ${fmtPct(bulk)}`,
  };
}

function attachComputed(firm) {
  const decision = classify(firm);
  const finance = state.finance.get(firm.RIC) ?? null;
  const ev =
    finance?.Enterprise_Value ??
    (finance &&
    finance.Market_Cap !== null &&
    finance.Total_Debt !== null &&
    finance.Cash !== null
      ? finance.Market_Cap + finance.Total_Debt - finance.Cash
      : null);
  const evToEbitda = ev !== null && finance?.EBITDA > 0 ? ev / finance.EBITDA : null;
  const evToRevenue = ev !== null && finance?.Revenue > 0 ? ev / finance.Revenue : null;
  const pToBook =
    finance && finance.Market_Cap !== null && finance.Book_Equity > 0
      ? finance.Market_Cap / finance.Book_Equity
      : null;
  const evToDwt = ev !== null && finance?.DWT_Total > 0 ? ev / finance.DWT_Total : null;
  const evToFleet = ev !== null && finance?.Fleet_Total > 0 ? ev / finance.Fleet_Total : null;

  return {
    ...firm,
    Decision_Group: decision.group,
    Decision_Label: GROUP_LABEL[decision.group],
    Decision_Reason: decision.reason,
    Finance: finance,
    EV: ev,
    EV_EBITDA: evToEbitda,
    EV_Revenue: evToRevenue,
    P_Book: pToBook,
    EV_DWT: evToDwt,
    EV_Fleet: evToFleet,
  };
}

function filteredRows() {
  const q = state.search.trim().toLowerCase();
  return state.firms
    .map(attachComputed)
    .filter((row) => state.filter === "all" || row.Decision_Group === state.filter)
    .filter((row) => {
      if (!q) return true;
      return `${row.Company_Name} ${row.RIC} ${row.Verdict_Fleet_Description}`
        .toLowerCase()
        .includes(q);
    });
}

function groupCounts(rows) {
  const counts = {
    "Tanker core": 0,
    "Dry bulk core": 0,
    "Mixed / review": 0,
    Excluded: 0,
  };
  rows.forEach((row) => {
    counts[row.Decision_Group] += 1;
  });
  return counts;
}

function median(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function renderKpis(rows) {
  const all = state.firms.map(attachComputed);
  const counts = groupCounts(all);
  const included = counts["Tanker core"] + counts["Dry bulk core"];
  const avgPurity =
    included > 0
      ? all
          .filter((row) => row.Decision_Group === "Tanker core" || row.Decision_Group === "Dry bulk core")
          .reduce((sum, row) => sum + Math.max(row.Tanker_Pct, row.DryBulk_Pct), 0) / included
      : null;
  const financeCoverage = all.filter((row) => row.Finance).length;
  const items = [
    ["전체 표본", state.firms.length],
    ["탱커 주력", counts["Tanker core"]],
    ["벌커 주력", counts["Dry bulk core"]],
    ["혼합·제외", counts["Mixed / review"] + counts.Excluded],
    ["평균 순도", avgPurity === null ? "-" : fmtPct(avgPurity)],
  ];

  const strip = $("kpiStrip");
  const template = $("kpiTemplate");
  strip.innerHTML = "";
  items.forEach(([label, value]) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".kpi-label").textContent = label;
    node.querySelector(".kpi-value").textContent = value;
    strip.appendChild(node);
  });

  $("dataStatus").textContent = `표본 ${state.firms.length}개 · 표시 ${rows.length}개`;
  $("financeStatus").textContent = `가치평가 입력 ${financeCoverage}개`;
  $("includedLabel").textContent = `분석 포함 ${included}개`;
}

function renderValuation(rows) {
  const all = state.firms.map(attachComputed);
  const withFinance = all.filter((row) => row.Finance);
  const tanker = all.filter((row) => row.Decision_Group === "Tanker core");
  const bulk = all.filter((row) => row.Decision_Group === "Dry bulk core");
  const metrics = [
    ["탱커 EV/EBITDA 중앙값", fmtMultiple(median(tanker.map((row) => row.EV_EBITDA)))],
    ["벌커 EV/EBITDA 중앙값", fmtMultiple(median(bulk.map((row) => row.EV_EBITDA)))],
    ["탱커 P/B 중앙값", fmtMultiple(median(tanker.map((row) => row.P_Book)))],
    ["벌커 P/B 중앙값", fmtMultiple(median(bulk.map((row) => row.P_Book)))],
  ];

  $("valuationSummary").textContent = withFinance.length
    ? `${withFinance.length}개 회사 재무 입력 반영`
    : "재무 CSV를 불러오면 멀티플이 계산됩니다";

  $("valuationGrid").innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric-tile">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
}

function buildFleetSummary() {
  const byCompany = new Map();
  const seen = new Set();

  state.fleetRecords.forEach((record) => {
    const dedupeKey = record.IMO
      ? `${record.Company_Name}|${record.IMO}`
      : `${record.Company_Name}|${record.Vessel_Name}|${record.Ship_Type}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    if (!byCompany.has(record.Company_Name)) {
      byCompany.set(record.Company_Name, {
        Company_Name: record.Company_Name,
        RIC: record.RIC,
        Total: 0,
        Tanker: 0,
        "Dry bulk": 0,
        Container: 0,
        "Gas carrier": 0,
        "General cargo": 0,
        Offshore: 0,
        Passenger: 0,
        Other: 0,
        ExactTypes: new Map(),
      });
    }
    const item = byCompany.get(record.Company_Name);
    item.Total += 1;
    item[record.Major_Type] += 1;
    item.ExactTypes.set(record.Ship_Type, (item.ExactTypes.get(record.Ship_Type) ?? 0) + 1);
  });

  return Array.from(byCompany.values()).sort((a, b) => b.Total - a.Total || a.Company_Name.localeCompare(b.Company_Name));
}

function renderFleetSummary() {
  const summary = buildFleetSummary();
  const vesselCount = summary.reduce((sum, row) => sum + row.Total, 0);
  $("fleetStatus").textContent = `전세계 선대 원장 ${vesselCount}척 · 회사 ${summary.length}개`;
  $("fleetSummaryLabel").textContent = state.fleetRecords.length
    ? `${vesselCount}척 집계 · ${FLEET_CATEGORIES.find(([key]) => key === state.fleetCategory)?.[1] ?? "전체"} 기준`
    : "IMO 단위 원장을 불러오면 회사별 선종 수가 계산됩니다";

  const totals = Object.fromEntries(FLEET_CATEGORIES.map(([key]) => [key, 0]));
  summary.forEach((row) => {
    FLEET_CATEGORIES.forEach(([key]) => {
      if (key === "All") return;
      totals[key] += row[key] ?? 0;
    });
  });
  totals.All = vesselCount;

  $("fleetCategoryBar").innerHTML = FLEET_CATEGORIES.map(
    ([key, label]) => `
      <button type="button" class="${state.fleetCategory === key ? "active" : ""}" data-fleet-category="${key}">
        ${label} ${fmtNumber(totals[key] ?? 0)}
      </button>
    `,
  ).join("");

  document.querySelectorAll("[data-fleet-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.fleetCategory = button.dataset.fleetCategory;
      render();
    });
  });

  const filtered =
    state.fleetCategory === "All"
      ? summary
      : summary.filter((row) => (row[state.fleetCategory] ?? 0) > 0).sort((a, b) => {
          const selectedDiff = (b[state.fleetCategory] ?? 0) - (a[state.fleetCategory] ?? 0);
          return selectedDiff || b.Total - a.Total;
        });

  if (!state.fleetRecords.length) {
    $("fleetTable").innerHTML = `
      <tr>
        <td colspan="10" class="reason-cell">선대 템플릿에 IMO 단위 데이터를 넣고 CSV 불러오기를 누르면 회사별 선종 수가 표시됩니다.</td>
      </tr>
    `;
    return;
  }

  $("fleetTable").innerHTML = filtered
    .slice(0, 200)
    .map(
      (row) => `
      <tr>
        <td class="company-cell"><strong>${escapeHtml(row.Company_Name)}</strong><span>${escapeHtml(row.RIC ?? "")}</span></td>
        <td class="number">${fmtNumber(row.Total)}</td>
        <td class="number">${fmtNumber(row.Tanker)}</td>
        <td class="number">${fmtNumber(row["Dry bulk"])}</td>
        <td class="number">${fmtNumber(row["Gas carrier"])}</td>
        <td class="number">${fmtNumber(row.Container)}</td>
        <td class="number">${fmtNumber(row["General cargo"])}</td>
        <td class="number">${fmtNumber(row.Offshore)}</td>
        <td class="number">${fmtNumber(row.Passenger)}</td>
        <td class="number">${fmtNumber(row.Other)}</td>
      </tr>
    `,
    )
    .join("");
}

function badgeClass(group) {
  if (group === "Tanker core") return "tanker";
  if (group === "Dry bulk core") return "bulk";
  if (group === "Excluded") return "excluded";
  return "mixed";
}

function renderTable(rows) {
  $("rowCount").textContent = `${rows.length}개 표시`;
  $("firmTable").innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td><span class="badge ${badgeClass(row.Decision_Group)}">${row.Decision_Label}</span></td>
        <td class="company-cell"><strong>${escapeHtml(row.Company_Name)}</strong><span>${escapeHtml(row.RIC)}</span></td>
        <td>${escapeHtml(row.RIC)}</td>
        <td class="number">${fmtPct(row.Tanker_Pct)}</td>
        <td class="number">${fmtPct(row.DryBulk_Pct)}</td>
        <td>${escapeHtml(row.Segment)}</td>
        <td class="reason-cell">${escapeHtml(row.Decision_Reason)}<br>${escapeHtml(row.Verdict_Fleet_Description)}</td>
        <td class="number">${fmtMultiple(row.EV_EBITDA)}</td>
      </tr>
    `,
    )
    .join("");
}

function drawComposition(rows) {
  const canvas = $("compositionChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 720;
  const cssHeight = Math.max(260, Math.round(cssWidth * 0.44));
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const counts = groupCounts(state.firms.map(attachComputed));
  const labels = Object.keys(counts);
  const max = Math.max(1, ...Object.values(counts));
  const left = 132;
  const top = 24;
  const barH = 34;
  const gap = 22;
  const chartW = cssWidth - left - 42;

  ctx.font = "12px Inter, sans-serif";
  labels.forEach((label, i) => {
    const y = top + i * (barH + gap);
    const value = counts[label];
    const width = (value / max) * chartW;
    ctx.fillStyle = "#334155";
    ctx.fillText(GROUP_LABEL[label], 0, y + 22);
    ctx.fillStyle = "#e5e7eb";
    roundRect(ctx, left, y, chartW, barH, 8);
    ctx.fill();
    ctx.fillStyle = COLORS[label];
    roundRect(ctx, left, y, width, barH, 8);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "700 13px Inter, sans-serif";
    ctx.fillText(`${value}개`, left + Math.max(width + 10, 12), y + 22);
    ctx.font = "12px Inter, sans-serif";
  });
}

function drawScatter(rows) {
  const canvas = $("scatterChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 720;
  const cssHeight = Math.max(260, Math.round(cssWidth * 0.44));
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { left: 44, right: 20, top: 16, bottom: 42 };
  const w = cssWidth - pad.left - pad.right;
  const h = cssHeight - pad.top - pad.bottom;

  ctx.strokeStyle = "#d8dee7";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const x = pad.left + (w * i) / 4;
    const y = pad.top + (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + w, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#637083";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText("탱커 비중", pad.left + w - 60, cssHeight - 12);
  ctx.save();
  ctx.translate(14, pad.top + 72);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("벌커 비중", 0, 0);
  ctx.restore();

  const all = state.firms.map(attachComputed);
  all.forEach((row) => {
    const x = pad.left + (row.Tanker_Pct / 100) * w;
    const y = pad.top + h - (row.DryBulk_Pct / 100) * h;
    ctx.fillStyle = COLORS[row.Decision_Group];
    ctx.beginPath();
    ctx.arc(x, y, rows.includes(row) ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(29,78,216,.55)";
  ctx.setLineDash([5, 5]);
  const tankerX = pad.left + (state.thresholds.tanker / 100) * w;
  const bulkY = pad.top + h - (state.thresholds.bulk / 100) * h;
  ctx.beginPath();
  ctx.moveTo(tankerX, pad.top);
  ctx.lineTo(tankerX, pad.top + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad.left, bulkY);
  ctx.lineTo(pad.left + w, bulkY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function render() {
  $("tankerThresholdValue").textContent = fmtPct(state.thresholds.tanker);
  $("bulkThresholdValue").textContent = fmtPct(state.thresholds.bulk);
  $("oppositeThresholdValue").textContent = fmtPct(state.thresholds.opposite);
  const rows = filteredRows();
  renderKpis(rows);
  renderValuation(rows);
  renderFleetSummary();
  renderTable(rows);
  drawComposition(rows);
  drawScatter(rows);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function download(filename, content, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportClassification() {
  const rows = state.firms.map(attachComputed).map((row) => ({
    Firm_ID: row.Firm_ID,
    Company_Name: row.Company_Name,
    RIC: row.RIC,
    Decision_Group: row.Decision_Label,
    Tanker_Pct: row.Tanker_Pct,
    DryBulk_Pct: row.DryBulk_Pct,
    Segment: row.Segment,
    Decision_Reason: row.Decision_Reason,
    EV_EBITDA: row.EV_EBITDA,
    EV_Revenue: row.EV_Revenue,
    P_Book: row.P_Book,
  }));
  download("shipping_fleet_classification.csv", toCsv(rows));
}

function exportFleetSummary() {
  const summary = buildFleetSummary().map((row) => ({
    Company_Name: row.Company_Name,
    RIC: row.RIC,
    Total: row.Total,
    Tanker: row.Tanker,
    Dry_Bulk: row["Dry bulk"],
    Gas_Carrier: row["Gas carrier"],
    Container: row.Container,
    General_Cargo: row["General cargo"],
    Offshore: row.Offshore,
    Passenger: row.Passenger,
    Other: row.Other,
    Exact_Ship_Types: Array.from(row.ExactTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}:${count}`)
      .join("; "),
  }));
  if (!summary.length) {
    download("shipping_fleet_summary.csv", "Company_Name,Total,Tanker,Dry_Bulk,Container\n");
    return;
  }
  download("shipping_fleet_summary.csv", toCsv(summary));
}

function exportBrief() {
  const all = state.firms.map(attachComputed);
  const counts = groupCounts(all);
  const fleetSummary = buildFleetSummary();
  const fleetVesselCount = fleetSummary.reduce((sum, row) => sum + row.Total, 0);
  const lines = [
    "# 탱커 vs 벌커 상장사 표본 분류 노트",
    "",
    `- 표본 수: ${state.firms.length}`,
    `- 탱커 주력: ${counts["Tanker core"]}`,
    `- 벌커 주력: ${counts["Dry bulk core"]}`,
    `- 혼합·검토: ${counts["Mixed / review"]}`,
    `- 제외: ${counts.Excluded}`,
    `- IMO 원장 집계 선박 수: ${fleetVesselCount}`,
    `- IMO 원장 집계 회사 수: ${fleetSummary.length}`,
    "",
    "## 현재 판정 기준",
    "",
    `- 탱커 주력: Tanker_% >= ${state.thresholds.tanker}% 및 DryBulk_% <= ${state.thresholds.opposite}%`,
    `- 벌커 주력: DryBulk_% >= ${state.thresholds.bulk}% 및 Tanker_% <= ${state.thresholds.opposite}%`,
    "- 원자료 설명에 EXCLUDE, insufficient trading data, combination carrier가 있으면 제외",
    "",
    "## 연구 설계 메모",
    "",
    "- 1단계: 주력 선종 구분을 고정한다.",
    "- 2단계: 동일 기준으로 EV/EBITDA, P/B, EV/DWT, EV/Fleet을 비교한다.",
    "- 3단계: 혼합·제외 기업은 주 분석에서 제외하고 강건성 검정에 별도 사용한다.",
  ];
  download("shipping_research_note.md", lines.join("\n"), "text/markdown");
}

async function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = file.name.endsWith(".json") ? JSON.parse(text) : parseCsv(text);
  const headers = Object.keys(rows[0] ?? {});
  const isFleet = headers.some((h) =>
    ["IMO", "IMO_Number", "Ship_Type", "Vessel_Type", "ShipType"].includes(h),
  );
  const isFinance = headers.some((h) =>
    ["Market_Cap", "Enterprise_Value", "EBITDA", "Revenue", "Book_Equity"].includes(h),
  );

  if (isFleet) {
    state.fleetRecords = rows.map(normalizeFleetRecord).filter(Boolean);
    state.fleetCategory = "All";
  } else if (isFinance) {
    rows.map(normalizeFinance).forEach((row) => {
      if (row) state.finance.set(row.RIC, row);
    });
  } else {
    state.firms = rows.map(normalizeFirm).filter((row) => row.RIC && row.Company_Name);
  }

  document.querySelector(".analysis").classList.remove("flash");
  requestAnimationFrame(() => document.querySelector(".analysis").classList.add("flash"));
  render();
}

async function init() {
  const response = await fetch("./data/firms.json", { cache: "no-store" });
  state.firms = (await response.json()).map(normalizeFirm);
  $("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  $("groupFilter").addEventListener("change", (event) => {
    state.filter = event.target.value;
    render();
  });
  $("tankerThreshold").addEventListener("input", (event) => {
    state.thresholds.tanker = Number(event.target.value);
    render();
  });
  $("bulkThreshold").addEventListener("input", (event) => {
    state.thresholds.bulk = Number(event.target.value);
    render();
  });
  $("oppositeThreshold").addEventListener("input", (event) => {
    state.thresholds.opposite = Number(event.target.value);
    render();
  });
  $("fileInput").addEventListener("change", handleFile);
  $("exportCsv").addEventListener("click", exportClassification);
  $("exportFleet").addEventListener("click", exportFleetSummary);
  $("exportBrief").addEventListener("click", exportBrief);
  window.addEventListener("resize", render);
  render();
}

init().catch((error) => {
  console.error(error);
  $("dataStatus").textContent = "데이터 로드 실패";
});
