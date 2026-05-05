const state = {
  firms: [],
  finance: new Map(),
  fleetRecords: [],
  officialFleet: [],
  openSourceTools: [],
  researchBlueprint: { topics: [], data_sources: [], workflow: [] },
  activeTopic: "fleet_mix",
  fleetCategory: "All",
  preview: null,
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

function normalizeFleetSummaryRow(row) {
  const company = row.Company_Name ?? row.Company ?? "";
  if (!company) return null;
  const item = {
    Company_Name: String(company).trim(),
    RIC: row.RIC ?? row.Ticker ?? "",
    Total: parseNumber(row.Total) ?? 0,
    Tanker: parseNumber(row.Tanker) ?? 0,
    "Dry bulk": parseNumber(row.Dry_Bulk ?? row["Dry bulk"] ?? row.DryBulk) ?? 0,
    Container: parseNumber(row.Container) ?? 0,
    "Gas carrier": parseNumber(row.Gas_Carrier ?? row["Gas carrier"] ?? row.Gas) ?? 0,
    "General cargo": parseNumber(row.General_Cargo ?? row["General cargo"]) ?? 0,
    Offshore: parseNumber(row.Offshore) ?? 0,
    Passenger: parseNumber(row.Passenger) ?? 0,
    Other: parseNumber(row.Other) ?? 0,
    Owned_Count: parseNumber(row.Owned_Count),
    Chartered_Count: parseNumber(row.Chartered_Count),
    Basis: row.Basis ?? "",
    As_Of: row.As_Of ?? row.Source_Date ?? "",
    Source_Name: row.Source_Name ?? row.Source ?? "",
    Source_URL: row.Source_URL ?? "",
    Source_Status: row.Source_Status ?? "",
    Notes: row.Notes ?? "",
    ExactTypes: new Map(),
  };
  if (!item.Total) {
    item.Total =
      item.Tanker +
      item["Dry bulk"] +
      item.Container +
      item["Gas carrier"] +
      item["General cargo"] +
      item.Offshore +
      item.Passenger +
      item.Other;
  }
  return item.Total ? item : null;
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

function buildRawFleetSummary() {
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

function buildFleetSummary() {
  if (state.fleetRecords.length) return buildRawFleetSummary();
  return [...state.officialFleet].sort(
    (a, b) => b.Total - a.Total || a.Company_Name.localeCompare(b.Company_Name),
  );
}

function renderFleetSummary() {
  const summary = buildFleetSummary();
  const vesselCount = summary.reduce((sum, row) => sum + row.Total, 0);
  const sourceMode = state.fleetRecords.length ? "업로드 원장" : "공식 출처";
  $("fleetStatus").textContent = `${sourceMode} 선대 ${vesselCount}척 · 회사 ${summary.length}개`;
  $("fleetSummaryLabel").textContent = summary.length
    ? `${sourceMode} ${vesselCount}척 · ${FLEET_CATEGORIES.find(([key]) => key === state.fleetCategory)?.[1] ?? "전체"} 기준`
    : "공식 출처 기반 선대 자료를 로드하지 못했습니다";

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

  if (!summary.length) {
    $("fleetTable").innerHTML = `
      <tr>
        <td colspan="11" class="reason-cell">공식자료 선대 수를 불러오지 못했습니다. 선대 템플릿에 IMO 단위 데이터를 넣고 CSV 불러오기를 누르면 회사별 선종 수가 계산됩니다.</td>
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
        <td class="source-cell">${renderSourceLink(row)}</td>
      </tr>
    `,
    )
    .join("");
}

function renderSourceLink(row) {
  const label = row.Source_Status ? `${row.Source_Status}` : row.Source_Name || "보기";
  const meta = [row.Basis, row.As_Of].filter(Boolean).join(" · ");
  const source = row.Source_URL
    ? `<a href="${escapeHtml(row.Source_URL)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
    : escapeHtml(label);
  return `${source}${meta ? `<span>${escapeHtml(meta)}</span>` : ""}`;
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
        <td><button class="row-action" type="button" data-dataroom="${escapeHtml(row.RIC)}">자료실</button></td>
      </tr>
    `,
    )
    .join("");
  document.querySelectorAll("[data-dataroom]").forEach((button) => {
    button.addEventListener("click", () => showCompanyDataroom(button.dataset.dataroom));
  });
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
  renderThesisAssistant();
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

function classificationRows() {
  return state.firms.map(attachComputed).map((row) => ({
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
}

function exportClassification() {
  showPreview({
    title: "분류 CSV 미리보기",
    filename: "shipping_fleet_classification.csv",
    content: toCsv(classificationRows()),
    type: "csv",
  });
}

function fleetSummaryRows() {
  return buildFleetSummary().map((row) => ({
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
    Owned_Count: row.Owned_Count,
    Chartered_Count: row.Chartered_Count,
    Basis: row.Basis,
    As_Of: row.As_Of,
    Source_Name: row.Source_Name,
    Source_URL: row.Source_URL,
    Source_Status: row.Source_Status,
    Notes: row.Notes,
    Exact_Ship_Types: Array.from(row.ExactTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}:${count}`)
      .join("; "),
  }));
}

function exportFleetSummary() {
  const rows = fleetSummaryRows();
  showPreview({
    title: "선대 요약 미리보기",
    filename: "shipping_fleet_summary.csv",
    content: rows.length ? toCsv(rows) : "Company_Name,Total,Tanker,Dry_Bulk,Container\n",
    type: "csv",
  });
}

function buildBriefText() {
  const all = state.firms.map(attachComputed);
  const counts = groupCounts(all);
  const fleetSummary = buildFleetSummary();
  const fleetVesselCount = fleetSummary.reduce((sum, row) => sum + row.Total, 0);
  const sourceMode = state.fleetRecords.length ? "업로드 원장" : "공식 출처 기반 공개자료";
  const lines = [
    "# 탱커 vs 벌커 상장사 분류 및 기업가치평가 연구 노트",
    "",
    `- 표본 수: ${state.firms.length}`,
    `- 탱커 주력: ${counts["Tanker core"]}`,
    `- 벌커 주력: ${counts["Dry bulk core"]}`,
    `- 혼합·검토: ${counts["Mixed / review"]}`,
    `- 제외: ${counts.Excluded}`,
    `- 선대 자료 기준: ${sourceMode}`,
    `- 선대 집계 선박 수: ${fleetVesselCount}`,
    `- 선대 집계 회사 수: ${fleetSummary.length}`,
    "",
    "## 현재 판정 기준",
    "",
    `- 탱커 주력: Tanker_% >= ${state.thresholds.tanker}% 및 DryBulk_% <= ${state.thresholds.opposite}%`,
    `- 벌커 주력: DryBulk_% >= ${state.thresholds.bulk}% 및 Tanker_% <= ${state.thresholds.opposite}%`,
    "- 원자료 설명에 EXCLUDE, insufficient trading data, combination carrier가 있으면 제외",
    "",
    "## 연구 주제 초안",
    "",
    "- 주제: 상장 해운사의 주력 선종 노출이 기업가치 멀티플에 미치는 영향",
    "- 가설 1: 탱커 주력사는 유가, 정제마진, 톤마일 충격에 따라 EV/EBITDA 변동성이 벌커 주력사와 다르다.",
    "- 가설 2: 벌커 주력사는 BDI, 중국 철광석 수요, 선령 구조가 P/B 할인율을 설명한다.",
    "- 가설 3: 선대 순도와 친환경·신조선 비중은 EV/DWT 또는 EV/Fleet 프리미엄을 만든다.",
    "",
    "## 분석 설계",
    "",
    "- 1단계: 공식 선대 자료 또는 IMO 원장으로 주력 선종을 고정한다.",
    "- 2단계: 감사보고서, 연차보고서, XBRL, 시장가격에서 EV, EBITDA, 순부채, 장부가를 수집한다.",
    "- 3단계: EV/EBITDA, EV/Revenue, P/B, EV/DWT, EV/Fleet을 탱커 주력과 벌커 주력으로 비교한다.",
    "- 4단계: 혼합 선대, 거래 데이터 부족, 상장폐지·관리종목은 본 분석에서 제외하고 강건성 검정에만 둔다.",
    "",
    "## 정확성 원칙",
    "",
    "- 선대 수는 출처 URL, 기준일, 산정 기준을 함께 저장한다.",
    "- 공개자료로 확인되지 않은 회사는 숫자를 임의 입력하지 않는다.",
    "- 유료 원장을 받으면 IMO 단위 원장 업로드로 재계산한다.",
  ];
  return lines.join("\n");
}

function exportBrief() {
  showPreview({
    title: "연구 노트 미리보기",
    filename: "shipping_research_note.md",
    content: buildBriefText(),
    type: "markdown",
  });
}

function renderResearchTools() {
  const checklist = [
    ["선대", "공식 fleet 페이지 또는 IMO 원장으로 선종·척수·DWT를 확정"],
    ["재무제표", "연차보고서, 20-F/10-K, 감사보고서에서 매출·EBITDA·부채·현금 수집"],
    ["시장가", "시가총액, 주가, 환율, 발행주식수로 EV 계산"],
    ["밸류에이션", "EV/EBITDA, P/B, EV/DWT, EV/Fleet 비교"],
    ["검증", "출처 URL, 기준일, owned/operated/pro-forma 기준을 함께 기록"],
  ];
  $("researchChecklist").innerHTML = checklist
    .map(
      ([label, text]) => `
        <div class="check-item">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(text)}</span>
        </div>
      `,
    )
    .join("");

  $("openSourceTools").innerHTML = state.openSourceTools
    .map(
      (tool) => `
        <a class="tool-item" href="${escapeHtml(tool.url)}" target="_blank" rel="noopener">
          <strong>${escapeHtml(tool.name)}</strong>
          <span>${escapeHtml(tool.use_case)}</span>
          <em>${escapeHtml(tool.stage)}</em>
        </a>
      `,
    )
    .join("");
}

function dataQualityMetrics() {
  const all = state.firms.map(attachComputed);
  const fleetSummary = buildFleetSummary();
  const fleetRics = new Set(fleetSummary.map((row) => row.RIC).filter(Boolean));
  const verified = fleetSummary.filter((row) => row.Source_Status === "verified").length;
  const review = fleetSummary.filter((row) => row.Source_Status && row.Source_Status !== "verified").length;
  const sampleFleetCoverage = all.filter((row) => fleetRics.has(row.RIC)).length;
  const financeCoverage = all.filter((row) => row.Finance).length;
  const vesselCount = fleetSummary.reduce((sum, row) => sum + row.Total, 0);
  return {
    all,
    fleetSummary,
    verified,
    review,
    sampleFleetCoverage,
    financeCoverage,
    vesselCount,
    sourceMode: state.fleetRecords.length ? "업로드 원장" : "공식 공개자료",
  };
}

function selectedTopic() {
  const topics = state.researchBlueprint.topics ?? [];
  return topics.find((topic) => topic.id === state.activeTopic) ?? topics[0] ?? null;
}

function researchSearchLinks(topic) {
  const query = topic?.literature_query ?? "shipping company valuation tanker dry bulk";
  const encoded = encodeURIComponent(query);
  return [
    {
      name: "OpenAlex",
      text: "API 문헌검색",
      url: `https://api.openalex.org/works?search=${encoded}&per-page=25`,
    },
    {
      name: "Crossref",
      text: "DOI·초록 검색",
      url: `https://api.crossref.org/works?query=${encoded}&rows=25`,
    },
    {
      name: "Semantic Scholar",
      text: "인용 네트워크 검색",
      url: `https://www.semanticscholar.org/search?q=${encoded}&sort=relevance`,
    },
    {
      name: "Google Scholar",
      text: "수동 확인",
      url: `https://scholar.google.com/scholar?q=${encoded}`,
    },
  ];
}

function renderThesisAssistant() {
  const blueprint = state.researchBlueprint;
  const topics = blueprint.topics ?? [];
  const topic = selectedTopic();
  const quality = dataQualityMetrics();
  if (!topic) {
    $("thesisSummary").textContent = "연구 설계 데이터를 불러오지 못했습니다";
    return;
  }

  $("thesisSummary").textContent =
    `${quality.sourceMode} 선대 ${fmtNumber(quality.vesselCount)}척 · 검증 ${quality.verified}개 · 검토 ${quality.review}개`;

  $("qualityGrid").innerHTML = [
    ["선대 수", `${fmtNumber(quality.vesselCount)}척`, `${quality.fleetSummary.length}개 상장사 공개자료`],
    [
      "표본 커버리지",
      `${quality.sampleFleetCoverage}/${state.firms.length}`,
      "기본 55개 표본 중 공식 선대 수 연결",
    ],
    ["재무 입력", `${quality.financeCoverage}/${state.firms.length}`, "CSV 입력 후 멀티플 자동 계산"],
    ["검증 상태", `${quality.verified} verified`, `${quality.review} review · 출처 재확인 필요`],
  ]
    .map(
      ([label, value, text]) => `
        <div class="quality-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <em>${escapeHtml(text)}</em>
        </div>
      `,
    )
    .join("");

  $("topicTabs").innerHTML = topics
    .map(
      (item) => `
        <button type="button" class="${item.id === topic.id ? "active" : ""}" data-topic="${escapeHtml(item.id)}">
          ${escapeHtml(item.title)}
        </button>
      `,
    )
    .join("");
  document.querySelectorAll("[data-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTopic = button.dataset.topic;
      renderThesisAssistant();
    });
  });

  $("topicDetail").innerHTML = `
    <h3>${escapeHtml(topic.title)}</h3>
    <p>${escapeHtml(topic.question)}</p>
    <div class="hypothesis-list">
      ${(topic.hypotheses ?? [])
        .map((text) => `<span>${escapeHtml(text)}</span>`)
        .join("")}
    </div>
    <div class="variable-row">
      <div>
        <strong>종속변수</strong>
        <span>${escapeHtml((topic.dependent_variables ?? []).join(", "))}</span>
      </div>
      <div>
        <strong>설명변수</strong>
        <span>${escapeHtml((topic.explanatory_variables ?? []).join(", "))}</span>
      </div>
    </div>
  `;

  $("methodList").innerHTML = [
    ...(topic.methods ?? []),
    ...(blueprint.workflow ?? []).slice(0, 3),
  ]
    .map((text) => `<div class="method-item">${escapeHtml(text)}</div>`)
    .join("");

  const literature = researchSearchLinks(topic)
    .map(
      (source) => `
        <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">
          <strong>${escapeHtml(source.name)}</strong>
          <span>${escapeHtml(source.text)}</span>
        </a>
      `,
    )
    .join("");
  const sources = (blueprint.data_sources ?? [])
    .slice(0, 8)
    .map(
      (source) => `
        <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">
          <strong>${escapeHtml(source.name)}</strong>
          <span>${escapeHtml(source.stage)} · ${escapeHtml(source.fit)}</span>
        </a>
      `,
    )
    .join("");
  $("sourceStack").innerHTML = literature + sources;
}

function buildResearchPackText() {
  const quality = dataQualityMetrics();
  const topic = selectedTopic();
  const counts = groupCounts(quality.all);
  const searchLinks = researchSearchLinks(topic);
  const lines = [
    "# 해운사 선종 구분 및 기업가치평가 논문 패키지",
    "",
    "## 현재 앱에 들어있는 것",
    "",
    "- 탱커·벌커 주력 회사 구분 로직",
    "- 공식 공개자료 기반 상장 해운사 선대 수와 출처 URL",
    "- 선종 카테고리별 회사 목록과 선종별 척수 집계",
    "- 가치평가 입력 템플릿과 EV/EBITDA, P/B, EV/DWT, EV/Fleet 계산",
    "- 회사별 공시·IR·시장가격 자료실",
    "- 오픈소스·GitHub 기반 공시, 문헌, 참고문헌, 재현문서 도구 목록",
    "",
    "## 아직 완성 데이터가 아닌 부분",
    "",
    "- 공개자료만으로 전세계 모든 상장 해운사의 정확한 회사별 선종 수를 완결했다고 단정하면 안 됩니다.",
    "- Source_Status가 review인 행은 공식 보고서 원문 또는 회사 IR에서 재확인이 필요합니다.",
    "- Clarksons, Kpler, Lloyd's List Intelligence, S&P/IHS 같은 IMO 단위 유료 원장을 받으면 선대 원장 업로드로 재계산해야 합니다.",
    "",
    "## 표본 상태",
    "",
    `- 전체 표본: ${state.firms.length}`,
    `- 탱커 주력: ${counts["Tanker core"]}`,
    `- 벌커 주력: ${counts["Dry bulk core"]}`,
    `- 혼합·검토: ${counts["Mixed / review"]}`,
    `- 제외: ${counts.Excluded}`,
    `- 선대 자료: ${quality.sourceMode} ${quality.vesselCount}척 / ${quality.fleetSummary.length}개 회사`,
    `- verified 선대 출처: ${quality.verified}개 회사`,
    `- review 선대 출처: ${quality.review}개 회사`,
    `- 재무 입력: ${quality.financeCoverage}/${state.firms.length}`,
    "",
    "## 추천 연구 주제",
    "",
    `- 제목: ${topic?.title ?? ""}`,
    `- 질문: ${topic?.question ?? ""}`,
    "",
    "## 가설",
    "",
    ...((topic?.hypotheses ?? []).map((text) => `- ${text}`)),
    "",
    "## 변수",
    "",
    `- 종속변수: ${(topic?.dependent_variables ?? []).join(", ")}`,
    `- 설명변수: ${(topic?.explanatory_variables ?? []).join(", ")}`,
    "",
    "## 분석 방법",
    "",
    ...((topic?.methods ?? []).map((text) => `- ${text}`)),
    "",
    "## 연구 워크플로우",
    "",
    ...((state.researchBlueprint.workflow ?? []).map((text) => `- ${text}`)),
    "",
    "## 문헌검색 링크",
    "",
    ...searchLinks.map((source) => `- ${source.name}: ${source.url}`),
    "",
    "## 공개 데이터·도구",
    "",
    ...((state.researchBlueprint.data_sources ?? []).map(
      (source) => `- ${source.name}: ${source.stage} / ${source.url}`,
    )),
    "",
    "## 오픈소스·GitHub",
    "",
    ...state.openSourceTools.map((tool) => `- ${tool.name}: ${tool.stage} / ${tool.url}`),
  ];
  return lines.join("\n");
}

function exportResearchPack() {
  showPreview({
    title: "논문 패키지 미리보기",
    filename: "shipping_thesis_research_pack.md",
    content: buildResearchPackText(),
    type: "markdown",
  });
}

function showPreview(payload) {
  state.preview = payload;
  $("previewTitle").textContent = payload.title;
  $("previewBody").innerHTML = renderPreviewBody(payload);
  const sourceLink = $("previewSourceLink");
  if (payload.sourceUrl) {
    sourceLink.hidden = false;
    sourceLink.href = payload.sourceUrl;
  } else {
    sourceLink.hidden = true;
    sourceLink.removeAttribute("href");
  }
  $("previewDownload").hidden = !payload.filename || !payload.content;
  $("previewModal").hidden = false;
}

function closePreview() {
  $("previewModal").hidden = true;
  state.preview = null;
}

function renderPreviewBody(payload) {
  if (payload.type === "html") return payload.html;
  if (payload.type === "csv") return renderCsvPreview(payload.content);
  return `<pre>${escapeHtml(payload.content)}</pre>`;
}

function renderCsvPreview(content) {
  const rows = parseCsv(content);
  if (!rows.length) return `<pre>${escapeHtml(content)}</pre>`;
  const headers = Object.keys(rows[0]);
  return `
    <div class="preview-count">${fmtNumber(rows.length)}개 행 · 처음 80개 행 표시</div>
    <div class="table-wrap preview-table">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .slice(0, 80)
            .map(
              (row) => `
                <tr>
                  ${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function previewStaticCsv(title, url, filename) {
  const response = await fetch(url, { cache: "no-store" });
  const content = await response.text();
  showPreview({
    title,
    filename,
    content,
    type: "csv",
    sourceUrl: url,
  });
}

function ricToYahoo(ric) {
  if (!ric) return "";
  const replacements = [
    [/\.OQ$/i, ""],
    [/\.N$/i, ""],
    [/\.A$/i, ""],
    [/\.PSX$/i, ".KA"],
    [/\.HNO$/i, ".HN"],
  ];
  let symbol = ric;
  replacements.forEach(([pattern, replacement]) => {
    symbol = symbol.replace(pattern, replacement);
  });
  return symbol;
}

function isUsListedRic(ric) {
  return /\.OQ$|\.N$|\.A$/i.test(ric);
}

function showCompanyDataroom(ric) {
  const row = state.firms.map(attachComputed).find((item) => item.RIC === ric);
  if (!row) return;
  const fleet = buildFleetSummary().find((item) => item.RIC === ric);
  const yahoo = ricToYahoo(row.RIC);
  const links = [
    {
      label: "시장가격",
      value: yahoo ? `Yahoo Finance · ${yahoo}` : "RIC 변환 필요",
      url: yahoo ? `https://finance.yahoo.com/quote/${encodeURIComponent(yahoo)}` : "",
    },
    {
      label: "SEC 감사보고서/공시",
      value: isUsListedRic(row.RIC) ? "EDGAR 20-F/10-K 검색" : "비미국 상장사는 거래소/IR 링크 확인",
      url: isUsListedRic(row.RIC)
        ? `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(row.Company_Name)}`
        : "",
    },
    {
      label: "선대 공식자료",
      value: fleet ? `${fleet.Source_Name || "공식자료"} · ${fleet.As_Of || "기준일 확인"}` : "아직 공식자료 미확인",
      url: fleet?.Source_URL ?? "",
    },
    {
      label: "IR/연차보고서 검색",
      value: "회사명 + investor relations + annual report",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${row.Company_Name} investor relations annual report fleet`)}`,
    },
  ];
  const csv = toCsv(
    links.map((link) => ({
      Company_Name: row.Company_Name,
      RIC: row.RIC,
      Item: link.label,
      Value: link.value,
      URL: link.url,
    })),
  );
  showPreview({
    title: `${row.Company_Name} 자료실`,
    filename: `${row.RIC || row.Company_Name}_research_links.csv`,
    content: csv,
    type: "html",
    html: `
      <div class="dataroom-head">
        <strong>${escapeHtml(row.Decision_Label)}</strong>
        <span>${escapeHtml(row.Decision_Reason)}</span>
      </div>
      <div class="link-list">
        ${links
          .map(
            (link) => `
              <div class="link-item">
                <strong>${escapeHtml(link.label)}</strong>
                <span>${escapeHtml(link.value)}</span>
                ${
                  link.url
                    ? `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">열기</a>`
                    : `<em>수동 확인</em>`
                }
              </div>
            `,
          )
          .join("")}
      </div>
    `,
  });
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
  const [firmsResponse, fleetResponse, toolsResponse, blueprintResponse] = await Promise.all([
    fetch("./data/firms.json", { cache: "no-store" }),
    fetch("./data/listed_fleet_counts.json", { cache: "no-store" }),
    fetch("./data/open_source_tools.json", { cache: "no-store" }),
    fetch("./data/research_blueprint.json", { cache: "no-store" }),
  ]);
  state.firms = (await firmsResponse.json()).map(normalizeFirm);
  state.officialFleet = (await fleetResponse.json()).map(normalizeFleetSummaryRow).filter(Boolean);
  state.openSourceTools = await toolsResponse.json();
  state.researchBlueprint = await blueprintResponse.json();
  state.activeTopic = state.researchBlueprint.topics?.[0]?.id ?? state.activeTopic;
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
  $("previewValuationTemplate").addEventListener("click", () =>
    previewStaticCsv(
      "가치평가 입력 템플릿",
      "./data/valuation_inputs_template.csv",
      "valuation_inputs_template.csv",
    ),
  );
  $("previewFleetTemplate").addEventListener("click", () =>
    previewStaticCsv("선대 원장 템플릿", "./data/fleet_raw_template.csv", "fleet_raw_template.csv"),
  );
  $("exportCsv").addEventListener("click", exportClassification);
  $("exportFleet").addEventListener("click", exportFleetSummary);
  $("exportBrief").addEventListener("click", exportBrief);
  $("exportResearchPack").addEventListener("click", exportResearchPack);
  $("previewDownload").addEventListener("click", () => {
    if (!state.preview) return;
    const mime = state.preview.type === "markdown" ? "text/markdown" : "text/csv";
    download(state.preview.filename, state.preview.content, mime);
  });
  document.querySelectorAll("[data-close-preview]").forEach((button) => {
    button.addEventListener("click", closePreview);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("previewModal").hidden) closePreview();
  });
  window.addEventListener("resize", render);
  renderResearchTools();
  render();
}

init().catch((error) => {
  console.error(error);
  $("dataStatus").textContent = "데이터 로드 실패";
});
