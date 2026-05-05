const state = {
  firms: [],
  finance: new Map(),
  fleetRecords: [],
  officialFleet: [],
  openSourceTools: [],
  researchBlueprint: { topics: [], data_sources: [], workflow: [] },
  activeTopic: "fleet_mix",
  activeWorkflowStep: "valuation",
  activeAnalysisMethod: "median",
  financeLoadedFrom: "",
  fleetCategory: "All",
  directoryMode: "shipType",
  activeShipType: "All",
  activeCoreGroup: "all",
  selectedCompanyKey: "",
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

const WORKFLOW_STEPS = [
  {
    id: "fleet",
    label: "선대",
    text: "공식 fleet 페이지, 연차보고서, SEC filing 또는 IMO 원장으로 회사별 선종·척수·기준일을 확정합니다.",
    need: "Company_Name, RIC, Total, 선종별 척수, owned/chartered 기준, Source_URL",
    output: "선종 분류표, 회사별 선대 요약, Source_Status",
    action: "왼쪽 선종 분류에서 회사를 고르고, 회사 대시보드의 선대·공시 출처를 확인합니다.",
  },
  {
    id: "financials",
    label: "재무제표",
    text: "연차보고서, 20-F/10-K, 감사보고서에서 매출, EBITDA, 부채, 현금, 장부자본을 모읍니다.",
    need: "Revenue, EBITDA, Total_Debt, Cash, Book_Equity, Fiscal_Year, Currency",
    output: "가치평가 입력 CSV 또는 내장 재무 스냅샷",
    action: "내장 yfinance 스냅샷을 먼저 보고, 논문용 확정값은 감사보고서 원문으로 덮어씁니다.",
  },
  {
    id: "market",
    label: "시장가",
    text: "시가총액, 기업가치, 주가, 발행주식수, 환율을 같은 기준일로 맞춰 EV를 계산합니다.",
    need: "Market_Cap, Enterprise_Value, shares outstanding, FX date",
    output: "EV, P/B, EV/Revenue",
    action: "회사별 자료실의 시장가격 링크를 열어 현재 시장값과 기준일을 확인합니다.",
  },
  {
    id: "valuation",
    label: "밸류에이션",
    text: "선종별 peer group에서 EV/EBITDA, P/B, EV/DWT, EV/Fleet을 즉시 계산해 비교합니다.",
    need: "재무 입력값 + 선대 수 + DWT 또는 Fleet_Total",
    output: "탱커·벌커·기타 선종별 멀티플 중앙값과 표본 수",
    action: "아래 실제 분석 결과에서 선택 연구 주제의 계산값을 바로 확인합니다.",
  },
  {
    id: "verification",
    label: "검증",
    text: "출처 URL, 기준일, 산정 기준, verified/review 상태를 기록해 논문 표본 신뢰도를 분리합니다.",
    need: "Source_URL, Source_Date, Basis, Source_Status, Notes",
    output: "기본 표본과 강건성 표본 구분",
    action: "Source_Status가 review인 회사는 부록 또는 민감도 분석 표본으로 둡니다.",
  },
];

const ANALYSIS_METHODS = [
  {
    id: "median",
    label: "중앙값 비교",
    text: "탱커 주력과 벌커 주력의 EV/EBITDA, P/B, EV/Fleet 중앙값을 즉시 비교합니다.",
  },
  {
    id: "tests",
    label: "그룹 차이 검정",
    text: "Mann-Whitney U와 Welch t-test 근사값으로 탱커·벌커 차이를 검정합니다.",
  },
  {
    id: "sensitivity",
    label: "60/70/80 민감도",
    text: "주력 선종 기준을 60%, 70%, 80%로 바꿨을 때 표본과 결과가 어떻게 바뀌는지 봅니다.",
  },
  {
    id: "robustness",
    label: "강건성 표본",
    text: "전체 표본, verified 선대 표본, review 제외 표본을 나눠 결과가 유지되는지 확인합니다.",
  },
  {
    id: "asset",
    label: "선대 규모 효과",
    text: "Fleet_Total, Owned_Count와 EV/Fleet, P/B의 상관·단순 회귀를 계산합니다.",
  },
  {
    id: "disclosure",
    label: "공시 품질 비교",
    text: "verified/review 출처 상태별 결측률과 멀티플 차이를 확인합니다.",
  },
];

const IMPROVEMENT_ROADMAP = [
  {
    label: "공시 재무값 자동 확정",
    text: "미국 상장사는 SEC XBRL에서 매출·EBITDA·부채·현금을 구조화하고, 비미국사는 IR 원문 링크를 표본별로 고정합니다.",
    tools: "EdgarTools, Arelle, sec-edgar-downloader",
    priority: "1순위",
  },
  {
    label: "대용량 선대 원장 분석",
    text: "Clarksons/Kpler 등 IMO 단위 CSV를 받으면 브라우저에서 SQL로 회사·선종·DWT를 집계합니다.",
    tools: "DuckDB-Wasm, Arquero",
    priority: "2순위",
  },
  {
    label: "통계 검정 정밀화",
    text: "현재 브라우저 근사값을 라이브러리 기반 검정으로 교체하고 논문 표와 같은 값을 재현합니다.",
    tools: "jStat, simple-statistics, Pyodide/SciPy",
    priority: "3순위",
  },
  {
    label: "논문 도표 자동 생성",
    text: "EV/EBITDA 박스플롯, 민감도 차트, 선대 규모 회귀 산점도를 바로 그림으로 뽑습니다.",
    tools: "Apache ECharts, Observable Plot",
    priority: "4순위",
  },
  {
    label: "운임 사이클 패널 회귀",
    text: "BDI, 탱커 운임지수, 주가수익률 CSV를 업로드하면 월별 패널 회귀와 구간 분석을 실행합니다.",
    tools: "DuckDB-Wasm, Danfo.js",
    priority: "5순위",
  },
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
  const valuation = computeValuation(finance, null);

  return {
    ...firm,
    Decision_Group: decision.group,
    Decision_Label: GROUP_LABEL[decision.group],
    Decision_Reason: decision.reason,
    Finance: finance,
    EV: valuation.EV,
    EV_EBITDA: valuation.EV_EBITDA,
    EV_Revenue: valuation.EV_Revenue,
    P_Book: valuation.P_Book,
    EV_DWT: valuation.EV_DWT,
    EV_Fleet: valuation.EV_Fleet,
  };
}

function companyKey(item) {
  return item?.RIC || item?.Company_Name || "";
}

function computeValuation(finance, fleet) {
  if (!finance) {
    return {
      finance: null,
      EV: null,
      EV_EBITDA: null,
      EV_Revenue: null,
      P_Book: null,
      EV_DWT: null,
      EV_Fleet: null,
    };
  }

  const ev =
    finance.Enterprise_Value ??
    (finance.Market_Cap !== null && finance.Total_Debt !== null && finance.Cash !== null
      ? finance.Market_Cap + finance.Total_Debt - finance.Cash
      : null);
  const fleetTotal = finance.Fleet_Total ?? fleet?.Total ?? null;
  return {
    finance,
    EV: ev,
    EV_EBITDA: ev !== null && finance.EBITDA > 0 ? ev / finance.EBITDA : null,
    EV_Revenue: ev !== null && finance.Revenue > 0 ? ev / finance.Revenue : null,
    P_Book:
      finance.Market_Cap !== null && finance.Book_Equity > 0
        ? finance.Market_Cap / finance.Book_Equity
        : null,
    EV_DWT: ev !== null && finance.DWT_Total > 0 ? ev / finance.DWT_Total : null,
    EV_Fleet: ev !== null && fleetTotal > 0 ? ev / fleetTotal : null,
  };
}

function valuationForEntry(entry) {
  const finance = entry?.finance ?? entry?.firm?.Finance ?? state.finance.get(entry?.RIC) ?? null;
  return computeValuation(finance, entry?.fleet ?? null);
}

function groupForEntry(entry) {
  if (entry?.firm?.Decision_Group) return entry.firm.Decision_Group;
  const fleet = entry?.fleet;
  if (!fleet?.Total) return "Mixed / review";
  const tankerPct = (fleet.Tanker / fleet.Total) * 100;
  const bulkPct = (fleet["Dry bulk"] / fleet.Total) * 100;
  if (tankerPct >= state.thresholds.tanker && bulkPct <= state.thresholds.opposite) return "Tanker core";
  if (bulkPct >= state.thresholds.bulk && tankerPct <= state.thresholds.opposite) return "Dry bulk core";
  return "Mixed / review";
}

function buildCompanyDirectory() {
  const directory = new Map();

  state.firms.map(attachComputed).forEach((firm) => {
    const key = companyKey(firm);
    if (!key) return;
    directory.set(key, {
      key,
      Company_Name: firm.Company_Name,
      RIC: firm.RIC,
      firm,
      fleet: null,
      finance: firm.Finance,
    });
  });

  buildFleetSummary().forEach((fleet) => {
    const key = companyKey(fleet);
    if (!key) return;
    const existing = directory.get(key);
    const finance = existing?.finance ?? state.finance.get(fleet.RIC) ?? null;
    directory.set(key, {
      key,
      Company_Name: existing?.Company_Name || fleet.Company_Name,
      RIC: existing?.RIC || fleet.RIC || "",
      firm: existing?.firm || null,
      fleet,
      finance,
    });
  });

  return Array.from(directory.values()).sort((a, b) => {
    const aFleet = a.fleet?.Total ?? 0;
    const bFleet = b.fleet?.Total ?? 0;
    return bFleet - aFleet || a.Company_Name.localeCompare(b.Company_Name);
  });
}

function directoryRows() {
  const q = state.search.trim().toLowerCase();
  const rows = buildCompanyDirectory().filter((entry) => {
    if (state.directoryMode === "shipType") {
      if (!entry.fleet) return false;
      return state.activeShipType === "All" || (entry.fleet[state.activeShipType] ?? 0) > 0;
    }
    if (!entry.firm) return false;
    return state.activeCoreGroup === "all" || entry.firm.Decision_Group === state.activeCoreGroup;
  });

  return rows.filter((entry) => {
    if (!q) return true;
    return `${entry.Company_Name} ${entry.RIC} ${entry.firm?.Verdict_Fleet_Description ?? ""}`
      .toLowerCase()
      .includes(q);
  });
}

function selectedCompany() {
  const directory = buildCompanyDirectory();
  return directory.find((entry) => entry.key === state.selectedCompanyKey) ?? null;
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
  const financeCoverage = buildCompanyDirectory().filter((entry) => valuationForEntry(entry).finance).length;
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
  $("financeStatus").textContent =
    `가치평가 입력 ${financeCoverage}개${state.financeLoadedFrom ? ` · ${state.financeLoadedFrom}` : ""}`;
  $("includedLabel").textContent = `분석 포함 ${included}개`;
}

function renderValuation(rows) {
  const valued = buildCompanyDirectory()
    .map((entry) => ({
      entry,
      group: groupForEntry(entry),
      valuation: valuationForEntry(entry),
    }))
    .filter((row) => row.valuation.finance);
  const tanker = valued.filter((row) => row.group === "Tanker core");
  const bulk = valued.filter((row) => row.group === "Dry bulk core");
  const verified = valued.filter((row) => row.entry.fleet?.Source_Status === "verified");
  const metrics = [
    ["전체 EV/EBITDA 중앙값", fmtMultiple(median(valued.map((row) => row.valuation.EV_EBITDA)))],
    ["탱커 EV/EBITDA 중앙값", fmtMultiple(median(tanker.map((row) => row.valuation.EV_EBITDA)))],
    ["벌커 EV/EBITDA 중앙값", fmtMultiple(median(bulk.map((row) => row.valuation.EV_EBITDA)))],
    ["Verified EV/Fleet 중앙값", fmtNumber(median(verified.map((row) => row.valuation.EV_Fleet)), 1)],
  ];

  $("valuationSummary").textContent = valued.length
    ? `${valued.length}개 회사 재무 스냅샷/업로드 반영 · 탱커 ${tanker.length}개 · 벌커 ${bulk.length}개`
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

function methodKeyResult(rows) {
  const tanker = rowsByGroup(rows, "Tanker core");
  const bulk = rowsByGroup(rows, "Dry bulk core");
  const tankerEbitda = metricValues(tanker, "EV_EBITDA");
  const bulkEbitda = metricValues(bulk, "EV_EBITDA");
  const tankerMedian = median(tankerEbitda);
  const bulkMedian = median(bulkEbitda);
  const pValue = permutationPValue(tankerEbitda, bulkEbitda);
  if (state.activeAnalysisMethod === "tests") {
    return `EV/EBITDA 그룹 차이 permutation p-value ${fmtP(pValue)} · 탱커 ${fmtMultiple(tankerMedian)}, 벌커 ${fmtMultiple(bulkMedian)}`;
  }
  if (state.activeAnalysisMethod === "sensitivity") {
    return "60/70/80% 기준별 표본 수와 EV/EBITDA 중앙값을 비교 중";
  }
  if (state.activeAnalysisMethod === "robustness") {
    return "전체 표본과 verified 표본을 분리해 결과 유지 여부를 확인 중";
  }
  if (state.activeAnalysisMethod === "asset") {
    const regression = linearRegression(rows.map((row) => row.fleetTotal), rows.map((row) => row.valuation.EV_Fleet));
    return `Fleet_Total vs EV/Fleet 단순회귀 표본 ${regression?.n ?? 0}개 · R² ${fmtNumber(regression?.r2, 2)}`;
  }
  if (state.activeAnalysisMethod === "disclosure") {
    const verified = rows.filter((row) => row.sourceStatus === "verified").length;
    return `공시/선대 verified ${verified}개와 review/missing ${rows.length - verified}개 비교`;
  }
  return `EV/EBITDA 중앙값: 탱커 ${fmtMultiple(tankerMedian)} / 벌커 ${fmtMultiple(bulkMedian)} · 차이 ${fmtMultiple(Number.isFinite(tankerMedian) && Number.isFinite(bulkMedian) ? tankerMedian - bulkMedian : null)}`;
}

function methodInterpretation(rows) {
  const result = methodKeyResult(rows);
  const warning = "현재 재무값은 일부 yfinance 스냅샷이므로 최종 논문 표에는 감사보고서·연차보고서 확인값으로 교체해야 합니다.";
  if (state.activeAnalysisMethod === "tests") {
    return `${result}. p-value가 낮은 지표는 주력 선종별 밸류에이션 차이 후보로 해석하고, ${warning}`;
  }
  if (state.activeAnalysisMethod === "sensitivity") {
    return `${result}. 기준을 바꿔도 방향이 유지되는지 확인해 연구 결과의 강건성을 설명할 수 있습니다. ${warning}`;
  }
  if (state.activeAnalysisMethod === "robustness") {
    return `${result}. verified 표본에서도 결론이 유지되면 공개자료 기반 연구의 신뢰도를 더 강하게 주장할 수 있습니다. ${warning}`;
  }
  if (state.activeAnalysisMethod === "asset") {
    return `${result}. 선대 규모가 멀티플 프리미엄을 설명하는지 보는 보조 검정으로 사용합니다. ${warning}`;
  }
  if (state.activeAnalysisMethod === "disclosure") {
    return `${result}. 출처 품질 차이가 결론에 미치는 편향을 논문 한계와 강건성 검정에 연결합니다. ${warning}`;
  }
  return `${result}. 이 값은 주력 선종별 peer multiple 차이를 보여주는 1차 결과로 쓸 수 있습니다. ${warning}`;
}

function renderResearchCockpit() {
  const rows = analysisDataset();
  const quality = dataQualityMetrics();
  const topic = selectedTopic();
  const entry = selectedCompany();
  const method = analysisMethodLabel(state.activeAnalysisMethod);
  const result = rows.length ? methodKeyResult(rows) : "재무 입력을 넣으면 결과가 계산됩니다";
  const nextActions = [
    "기업가치분석의 SEC/IR 링크로 핵심 회사 재무값 검증",
    "Source_Status review 회사는 부록 표본으로 분리",
    topic?.id === "cycle_sensitivity"
      ? "BDI·탱커운임·주가수익률 CSV를 추가해 패널 회귀 확장"
      : "분석 결과 표를 논문 패키지로 저장",
  ];
  $("researchCockpit").innerHTML = `
    <div class="cockpit-main">
      <span>현재 연구 질문</span>
      <strong>${escapeHtml(topic?.title ?? "연구 주제 선택")}</strong>
      <p>${escapeHtml(topic?.question ?? "")}</p>
    </div>
    <div class="cockpit-grid">
      <div>
        <span>실행 분석</span>
        <strong>${escapeHtml(method)}</strong>
        <em>${escapeHtml(result)}</em>
      </div>
      <div>
        <span>데이터 상태</span>
        <strong>${fmtNumber(quality.vesselCount)}척 · 재무 ${quality.financeCoverage}개</strong>
        <em>verified ${quality.verified}개 · review ${quality.review}개</em>
      </div>
      <div>
        <span>선택 회사</span>
        <strong>${escapeHtml(entry?.Company_Name ?? "회사 미선택")}</strong>
        <em>${escapeHtml(entry ? fleetListMeta(entry) : "왼쪽 목록에서 회사를 선택하세요")}</em>
      </div>
    </div>
    <div class="cockpit-actions">
      ${nextActions.map((text) => `<span>${escapeHtml(text)}</span>`).join("")}
      <button type="button" data-scroll-target="#actualAnalysis">분석 결과 보기</button>
      <button type="button" data-scroll-target=".research-panel">자료·도구 보기</button>
    </div>
  `;
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(button.dataset.scrollTarget)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
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
      state.directoryMode = "shipType";
      state.activeShipType = state.fleetCategory;
      state.filter = "all";
      $("groupFilter").value = "all";
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
        <td class="company-cell">
          <button class="company-name-button" type="button" data-select-company="${escapeHtml(companyKey(row))}">
            <strong>${escapeHtml(row.Company_Name)}</strong>
            <span>${escapeHtml(row.RIC ?? "")}</span>
          </button>
        </td>
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

function coreCategoryItems() {
  const counts = groupCounts(state.firms.map(attachComputed));
  return [
    ["all", "전체", state.firms.length],
    ["Tanker core", "탱커 주력", counts["Tanker core"]],
    ["Dry bulk core", "벌커 주력", counts["Dry bulk core"]],
    ["Mixed / review", "혼합·검토", counts["Mixed / review"]],
    ["Excluded", "제외", counts.Excluded],
  ];
}

function renderDirectoryWorkflow() {
  const fleetSummary = buildFleetSummary();
  const shipTotals = Object.fromEntries(FLEET_CATEGORIES.map(([key]) => [key, 0]));
  fleetSummary.forEach((row) => {
    FLEET_CATEGORIES.forEach(([key]) => {
      if (key === "All") return;
      shipTotals[key] += row[key] ?? 0;
    });
  });
  shipTotals.All = fleetSummary.reduce((sum, row) => sum + row.Total, 0);

  $("shipTypeNav").innerHTML = FLEET_CATEGORIES.map(
    ([key, label]) => `
      <button type="button" class="${state.directoryMode === "shipType" && state.activeShipType === key ? "active" : ""}" data-directory-ship="${key}">
        ${escapeHtml(label)} <span>${fmtNumber(shipTotals[key] ?? 0)}</span>
      </button>
    `,
  ).join("");

  $("coreGroupNav").innerHTML = coreCategoryItems()
    .map(
      ([key, label, count]) => `
        <button type="button" class="${state.directoryMode === "core" && state.activeCoreGroup === key ? "active" : ""}" data-directory-core="${escapeHtml(key)}">
          ${escapeHtml(label)} <span>${fmtNumber(count)}</span>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll("[data-directory-ship]").forEach((button) => {
    button.addEventListener("click", () => {
      state.directoryMode = "shipType";
      state.activeShipType = button.dataset.directoryShip;
      state.fleetCategory = state.activeShipType;
      state.filter = "all";
      $("groupFilter").value = "all";
      render();
    });
  });

  document.querySelectorAll("[data-directory-core]").forEach((button) => {
    button.addEventListener("click", () => {
      state.directoryMode = "core";
      state.activeCoreGroup = button.dataset.directoryCore;
      state.filter = state.activeCoreGroup;
      $("groupFilter").value = state.activeCoreGroup;
      render();
    });
  });

  const rows = directoryRows();
  if (!rows.length) {
    state.selectedCompanyKey = "";
  } else if (!rows.some((entry) => entry.key === state.selectedCompanyKey)) {
    state.selectedCompanyKey = rows[0].key;
  }

  const activeLabel =
    state.directoryMode === "shipType"
      ? FLEET_CATEGORIES.find(([key]) => key === state.activeShipType)?.[1] ?? "선종"
      : coreCategoryItems().find(([key]) => key === state.activeCoreGroup)?.[1] ?? "주력";
  $("directoryModeLabel").textContent = state.directoryMode === "shipType" ? "선종 기준" : "주력 기준";
  $("companyListTitle").textContent = `${activeLabel} 회사 목록`;
  $("companyListCount").textContent = `${rows.length}개`;

  $("companyList").innerHTML = rows.length
    ? rows
        .map((entry) => {
          const total = entry.fleet?.Total ?? null;
          const detail =
            state.directoryMode === "shipType"
              ? fleetListMeta(entry)
              : entry.firm?.Decision_Reason || fleetListMeta(entry);
          const badge = entry.firm?.Decision_Label ?? "선대자료";
          return `
            <button type="button" class="company-list-item ${entry.key === state.selectedCompanyKey ? "active" : ""}" data-select-company="${escapeHtml(entry.key)}">
              <strong>${escapeHtml(entry.Company_Name)}</strong>
              <span>${escapeHtml(entry.RIC || "RIC 미확인")} · ${total === null ? "선대수 미확인" : `${fmtNumber(total)}척`} · ${escapeHtml(badge)}</span>
              <em>${escapeHtml(detail)}</em>
            </button>
          `;
        })
        .join("")
    : `<div class="empty-list">검색 또는 분류 조건에 맞는 회사가 없습니다.</div>`;

}

function fleetListMeta(entry) {
  const fleet = entry.fleet;
  if (!fleet) return "공식 선대 수 미확인";
  const counts = [
    ["탱커", fleet.Tanker],
    ["벌커", fleet["Dry bulk"]],
    ["컨테이너", fleet.Container],
    ["가스", fleet["Gas carrier"]],
    ["일반화물", fleet["General cargo"]],
    ["오프쇼어", fleet.Offshore],
    ["여객", fleet.Passenger],
    ["기타", fleet.Other],
  ]
    .filter(([, value]) => value > 0)
    .map(([label, value]) => `${label} ${fmtNumber(value)}`)
    .join(" · ");
  return counts || "세부 선종 미분류";
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
        <td class="company-cell">
          <button class="company-name-button" type="button" data-select-company="${escapeHtml(companyKey(row))}">
            <strong>${escapeHtml(row.Company_Name)}</strong>
            <span>${escapeHtml(row.RIC)}</span>
          </button>
        </td>
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

function bindCompanySelection() {
  document.querySelectorAll("[data-select-company]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCompanyKey = button.dataset.selectCompany;
      render();
      document.querySelector(".company-panel")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
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
  renderDirectoryWorkflow();
  renderKpis(rows);
  renderResearchCockpit();
  renderCompanyDashboard();
  renderValuation(rows);
  renderFleetSummary();
  renderResearchTools();
  renderThesisAssistant();
  renderTable(rows);
  bindCompanySelection();
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
  $("researchChecklist").innerHTML = WORKFLOW_STEPS
    .map(
      (step) => `
        <button type="button" class="check-item ${step.id === state.activeWorkflowStep ? "active" : ""}" data-workflow-step="${escapeHtml(step.id)}">
          <strong>${escapeHtml(step.label)}</strong>
          <span>${escapeHtml(step.text)}</span>
        </button>
      `,
    )
    .join("");
  document.querySelectorAll("[data-workflow-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeWorkflowStep = button.dataset.workflowStep;
      renderResearchTools();
      $("workflowDetail")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });

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

  $("improvementRoadmap").innerHTML = IMPROVEMENT_ROADMAP.map(
    (item) => `
      <div class="improvement-item">
        <span>${escapeHtml(item.priority)}</span>
        <strong>${escapeHtml(item.label)}</strong>
        <p>${escapeHtml(item.text)}</p>
        <em>${escapeHtml(item.tools)}</em>
      </div>
    `,
  ).join("");

  renderWorkflowDetail();
}

function renderWorkflowDetail() {
  const step =
    WORKFLOW_STEPS.find((item) => item.id === state.activeWorkflowStep) ?? WORKFLOW_STEPS[0];
  const entry = selectedCompany();
  const valuation = valuationForEntry(entry);
  const companyLine = entry
    ? `${entry.Company_Name} · ${fleetListMeta(entry)} · EV/EBITDA ${fmtMultiple(valuation.EV_EBITDA)}`
    : "왼쪽 회사 목록에서 회사를 선택하면 이 단계가 회사 기준으로 바뀝니다.";
  const stepMetric =
    step.id === "fleet"
      ? `공개 선대 ${fmtNumber(dataQualityMetrics().vesselCount)}척 / ${buildFleetSummary().length}개 회사`
      : step.id === "valuation"
        ? `가치평가 입력 ${buildCompanyDirectory().filter((item) => valuationForEntry(item).finance).length}개 회사`
        : step.id === "verification"
          ? `verified ${dataQualityMetrics().verified}개 / review ${dataQualityMetrics().review}개`
          : state.financeLoadedFrom || "내장 스냅샷 또는 CSV 입력 대기";

  $("workflowDetail").innerHTML = `
    <h3>${escapeHtml(step.label)} 실행 패널</h3>
    <p>${escapeHtml(step.text)}</p>
    <div class="workflow-step-grid">
      <div>
        <strong>필요 자료</strong>
        <span>${escapeHtml(step.need)}</span>
      </div>
      <div>
        <strong>현재 계산값</strong>
        <span>${escapeHtml(stepMetric)}</span>
      </div>
      <div>
        <strong>선택 회사</strong>
        <span>${escapeHtml(companyLine)}</span>
      </div>
    </div>
    <p><strong>다음 행동:</strong> ${escapeHtml(step.action)} 결과물은 ${escapeHtml(step.output)}입니다.</p>
  `;
}

function dataQualityMetrics() {
  const all = state.firms.map(attachComputed);
  const fleetSummary = buildFleetSummary();
  const fleetRics = new Set(fleetSummary.map((row) => row.RIC).filter(Boolean));
  const verified = fleetSummary.filter((row) => row.Source_Status === "verified").length;
  const review = fleetSummary.filter((row) => row.Source_Status && row.Source_Status !== "verified").length;
  const sampleFleetCoverage = all.filter((row) => fleetRics.has(row.RIC)).length;
  const financeCoverage = buildCompanyDirectory().filter((entry) => valuationForEntry(entry).finance).length;
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

function methodIdForText(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes("mann-whitney") || lower.includes("welch") || lower.includes("검정")) return "tests";
  if (lower.includes("60/70/80") || lower.includes("민감도")) return "sensitivity";
  if (lower.includes("강건성") || lower.includes("verified") || lower.includes("review")) return "robustness";
  if (lower.includes("owned") || lower.includes("dwt") || lower.includes("fleet") || lower.includes("소유")) return "asset";
  if (lower.includes("품질") || lower.includes("누락") || lower.includes("공시")) return "disclosure";
  return "median";
}

function analysisMethodLabel(id) {
  return ANALYSIS_METHODS.find((method) => method.id === id)?.label ?? "중앙값 비교";
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

function mean(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function sampleStd(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length < 2) return null;
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

function correlation(a, b) {
  const pairs = a
    .map((value, index) => [value, b[index]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return null;
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const xDenom = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0));
  const yDenom = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0));
  return xDenom && yDenom ? numerator / (xDenom * yDenom) : null;
}

function linearRegression(a, b) {
  const pairs = a
    .map((value, index) => [value, b[index]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return null;
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const denom = pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0);
  if (!denom) return null;
  const slope = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0) / denom;
  const intercept = yMean - slope * xMean;
  const r = correlation(xs, ys);
  return { slope, intercept, r2: r === null ? null : r ** 2, n: pairs.length };
}

function groupFromPercentages(tankerPct, bulkPct, tankerThreshold, bulkThreshold, oppositeThreshold) {
  if (tankerPct >= tankerThreshold && bulkPct <= oppositeThreshold) return "Tanker core";
  if (bulkPct >= bulkThreshold && tankerPct <= oppositeThreshold) return "Dry bulk core";
  return "Mixed / review";
}

function analysisDataset() {
  return buildCompanyDirectory()
    .map((entry) => {
      const valuation = valuationForEntry(entry);
      const group = groupForEntry(entry);
      const fleet = entry.fleet;
      return {
        entry,
        valuation,
        group,
        fleetTotal: fleet?.Total ?? valuation.finance?.Fleet_Total ?? null,
        owned: fleet?.Owned_Count ?? null,
        tankerPct: fleet?.Total ? (fleet.Tanker / fleet.Total) * 100 : entry.firm?.Tanker_Pct ?? null,
        bulkPct: fleet?.Total ? (fleet["Dry bulk"] / fleet.Total) * 100 : entry.firm?.DryBulk_Pct ?? null,
        sourceStatus: fleet?.Source_Status || "missing",
        company: entry.Company_Name,
        ric: entry.RIC,
      };
    })
    .filter((row) => row.valuation.finance);
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function permutationPValue(a, b, iterations = 1200) {
  const left = a.filter((value) => Number.isFinite(value));
  const right = b.filter((value) => Number.isFinite(value));
  if (left.length < 2 || right.length < 2) return null;
  const observed = Math.abs((mean(left) ?? 0) - (mean(right) ?? 0));
  if (!Number.isFinite(observed)) return null;
  const pool = [...left, ...right];
  const n = left.length;
  const random = seededRandom(pool.length * 97 + n * 31);
  let hits = 0;
  for (let i = 0; i < iterations; i += 1) {
    const shuffled = [...pool];
    for (let j = shuffled.length - 1; j > 0; j -= 1) {
      const k = Math.floor(random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const diff = Math.abs((mean(shuffled.slice(0, n)) ?? 0) - (mean(shuffled.slice(n)) ?? 0));
    if (diff >= observed) hits += 1;
  }
  return hits / iterations;
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x));
  return sign * y;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function welchTest(a, b) {
  const left = a.filter((value) => Number.isFinite(value));
  const right = b.filter((value) => Number.isFinite(value));
  if (left.length < 2 || right.length < 2) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  const leftStd = sampleStd(left);
  const rightStd = sampleStd(right);
  const se = Math.sqrt((leftStd ** 2) / left.length + (rightStd ** 2) / right.length);
  if (!se) return null;
  const t = (leftMean - rightMean) / se;
  const numerator = ((leftStd ** 2) / left.length + (rightStd ** 2) / right.length) ** 2;
  const denominator =
    (leftStd ** 4) / (left.length ** 2 * (left.length - 1)) +
    (rightStd ** 4) / (right.length ** 2 * (right.length - 1));
  const df = denominator ? numerator / denominator : null;
  return {
    t,
    df,
    p: 2 * (1 - normalCdf(Math.abs(t))),
    leftMean,
    rightMean,
    n1: left.length,
    n2: right.length,
  };
}

function mannWhitneyUTest(a, b) {
  const left = a.filter((value) => Number.isFinite(value));
  const right = b.filter((value) => Number.isFinite(value));
  if (left.length < 2 || right.length < 2) return null;
  const pooled = [
    ...left.map((value) => ({ value, group: "left" })),
    ...right.map((value) => ({ value, group: "right" })),
  ].sort((x, y) => x.value - y.value);
  let index = 0;
  while (index < pooled.length) {
    let end = index + 1;
    while (end < pooled.length && pooled[end].value === pooled[index].value) end += 1;
    const rank = (index + 1 + end) / 2;
    for (let i = index; i < end; i += 1) pooled[i].rank = rank;
    index = end;
  }
  const rankSum = pooled.filter((item) => item.group === "left").reduce((sum, item) => sum + item.rank, 0);
  const u = rankSum - (left.length * (left.length + 1)) / 2;
  const meanU = (left.length * right.length) / 2;
  const sd = Math.sqrt((left.length * right.length * (left.length + right.length + 1)) / 12);
  const z = sd ? (u - meanU) / sd : null;
  return {
    u,
    z,
    p: z === null ? null : 2 * (1 - normalCdf(Math.abs(z))),
    n1: left.length,
    n2: right.length,
  };
}

function renderMetricResult(label, values, formatter = fmtMultiple) {
  const nums = values.filter((value) => Number.isFinite(value));
  return `
    <div class="result-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatter(median(nums))}</strong>
      <em>n=${nums.length} · 평균 ${formatter(mean(nums))} · 표준편차 ${formatter(sampleStd(nums))}</em>
    </div>
  `;
}

function rowsByGroup(rows, group, thresholds = state.thresholds) {
  return rows.filter((row) => {
    if (row.group === "Excluded") return false;
    const derived = groupFromPercentages(
      row.tankerPct ?? 0,
      row.bulkPct ?? 0,
      thresholds.tanker,
      thresholds.bulk,
      thresholds.opposite,
    );
    return derived === group;
  });
}

function metricValues(rows, key) {
  return rows.map((row) => row.valuation[key]).filter((value) => Number.isFinite(value));
}

function fmtP(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  if (value < 0.001) return "<0.001";
  return fmtNumber(value, 3);
}

function renderAnalysisTable(headers, rows) {
  return `
    <div class="analysis-table-wrap">
      <table class="analysis-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMedianComparison(rows) {
  const tanker = rowsByGroup(rows, "Tanker core");
  const bulk = rowsByGroup(rows, "Dry bulk core");
  const metrics = [
    ["EV/EBITDA", "EV_EBITDA", fmtMultiple],
    ["P/B", "P_Book", fmtMultiple],
    ["EV/Revenue", "EV_Revenue", fmtMultiple],
    ["EV/Fleet", "EV_Fleet", (value) => fmtNumber(value, 1)],
  ];
  const tableRows = metrics.map(([label, key, formatter]) => {
    const tankerMedian = median(metricValues(tanker, key));
    const bulkMedian = median(metricValues(bulk, key));
    const diff = Number.isFinite(tankerMedian) && Number.isFinite(bulkMedian) ? tankerMedian - bulkMedian : null;
    return [
      label,
      `${formatter(tankerMedian)} / n=${metricValues(tanker, key).length}`,
      `${formatter(bulkMedian)} / n=${metricValues(bulk, key).length}`,
      formatter(diff),
    ];
  });
  return renderAnalysisTable(["지표", "탱커 주력 중앙값", "벌커 주력 중앙값", "차이"], tableRows);
}

function renderGroupTests(rows) {
  const tanker = rowsByGroup(rows, "Tanker core");
  const bulk = rowsByGroup(rows, "Dry bulk core");
  const metrics = [
    ["EV/EBITDA", "EV_EBITDA"],
    ["P/B", "P_Book"],
    ["EV/Fleet", "EV_Fleet"],
  ];
  const tableRows = metrics.map(([label, key]) => {
    const left = metricValues(tanker, key);
    const right = metricValues(bulk, key);
    const welch = welchTest(left, right);
    const mann = mannWhitneyUTest(left, right);
    const permutation = permutationPValue(left, right);
    return [
      label,
      `t=${fmtNumber(welch?.t, 2)}, p=${fmtP(welch?.p)}`,
      `U=${fmtNumber(mann?.u, 1)}, p=${fmtP(mann?.p)}`,
      `p=${fmtP(permutation)}`,
    ];
  });
  return `
    ${renderAnalysisTable(["지표", "Welch t-test 근사", "Mann-Whitney U 근사", "Permutation"], tableRows)}
    <p class="analysis-note">p-value는 브라우저 내 근사 계산입니다. 논문 최종본에서는 Python/R로 동일 표본을 재검정해 수치를 확정하세요.</p>
  `;
}

function renderSensitivity(rows) {
  const tableRows = [60, 70, 80].map((threshold) => {
    const thresholds = { tanker: threshold, bulk: threshold, opposite: state.thresholds.opposite };
    const tanker = rowsByGroup(rows, "Tanker core", thresholds);
    const bulk = rowsByGroup(rows, "Dry bulk core", thresholds);
    const tankerValues = metricValues(tanker, "EV_EBITDA");
    const bulkValues = metricValues(bulk, "EV_EBITDA");
    return [
      `${threshold}%`,
      `${tanker.length}개 · ${fmtMultiple(median(tankerValues))}`,
      `${bulk.length}개 · ${fmtMultiple(median(bulkValues))}`,
      fmtP(permutationPValue(tankerValues, bulkValues)),
    ];
  });
  return renderAnalysisTable(["주력 기준", "탱커 n · EV/EBITDA", "벌커 n · EV/EBITDA", "차이 p-value"], tableRows);
}

function renderRobustness(rows) {
  const samples = [
    ["전체 재무 입력", rows],
    ["선대 verified만", rows.filter((row) => row.sourceStatus === "verified")],
    ["review/missing 제외", rows.filter((row) => row.sourceStatus === "verified")],
    ["탱커·벌커 core만", rows.filter((row) => ["Tanker core", "Dry bulk core"].includes(row.group))],
  ];
  const tableRows = samples.map(([label, sample]) => {
    const tanker = rowsByGroup(sample, "Tanker core");
    const bulk = rowsByGroup(sample, "Dry bulk core");
    return [
      label,
      `${sample.length}개`,
      `${tanker.length}개 · ${fmtMultiple(median(metricValues(tanker, "EV_EBITDA")))}`,
      `${bulk.length}개 · ${fmtMultiple(median(metricValues(bulk, "EV_EBITDA")))}`,
    ];
  });
  return renderAnalysisTable(["표본", "계산 가능", "탱커 EV/EBITDA", "벌커 EV/EBITDA"], tableRows);
}

function renderAssetEffect(rows) {
  const fleet = rows.map((row) => row.fleetTotal);
  const owned = rows.map((row) => row.owned);
  const evFleet = rows.map((row) => row.valuation.EV_Fleet);
  const pBook = rows.map((row) => row.valuation.P_Book);
  const regression = linearRegression(fleet, evFleet);
  const tableRows = [
    ["Fleet_Total vs EV/Fleet", fmtNumber(correlation(fleet, evFleet), 2), fmtNumber(regression?.slope, 2), `${regression?.n ?? 0}개`],
    ["Owned_Count vs P/B", fmtNumber(correlation(owned, pBook), 2), "-", `${owned.filter(Number.isFinite).length}개`],
    ["Fleet_Total vs P/B", fmtNumber(correlation(fleet, pBook), 2), "-", `${fleet.filter(Number.isFinite).length}개`],
  ];
  return renderAnalysisTable(["관계", "상관계수", "단순회귀 기울기", "표본"], tableRows);
}

function renderDisclosureQuality(rows) {
  const verified = rows.filter((row) => row.sourceStatus === "verified");
  const review = rows.filter((row) => row.sourceStatus !== "verified");
  const tableRows = [
    ["verified", `${verified.length}개`, fmtMultiple(median(metricValues(verified, "EV_EBITDA"))), fmtNumber(median(metricValues(verified, "EV_Fleet")), 1)],
    ["review/missing", `${review.length}개`, fmtMultiple(median(metricValues(review, "EV_EBITDA"))), fmtNumber(median(metricValues(review, "EV_Fleet")), 1)],
  ];
  return renderAnalysisTable(["출처 상태", "표본", "EV/EBITDA 중앙값", "EV/Fleet 중앙값"], tableRows);
}

function renderSelectedMethod(rows) {
  if (state.activeAnalysisMethod === "tests") return renderGroupTests(rows);
  if (state.activeAnalysisMethod === "sensitivity") return renderSensitivity(rows);
  if (state.activeAnalysisMethod === "robustness") return renderRobustness(rows);
  if (state.activeAnalysisMethod === "asset") return renderAssetEffect(rows);
  if (state.activeAnalysisMethod === "disclosure") return renderDisclosureQuality(rows);
  return renderMedianComparison(rows);
}

function renderActualAnalysis(topic) {
  const rows = analysisDataset();
  if (!rows.length) {
    return `
      <div class="analysis-result-head">
        <h3>실제 분석 결과</h3>
        <span>재무 입력이 아직 없어 계산 대기 중입니다.</span>
      </div>
    `;
  }

  const tanker = rows.filter((row) => row.group === "Tanker core");
  const bulk = rows.filter((row) => row.group === "Dry bulk core");
  const verified = rows.filter((row) => row.sourceStatus === "verified");
  const review = rows.filter((row) => row.sourceStatus !== "verified");
  const metricKey = topic?.id === "asset_quality" ? "EV_Fleet" : "EV_EBITDA";
  const tankerValues = tanker.map((row) => row.valuation[metricKey]);
  const bulkValues = bulk.map((row) => row.valuation[metricKey]);
  const pValue = permutationPValue(tankerValues, bulkValues);
  const fleetTotals = rows.map((row) => row.fleetTotal);
  const evFleetValues = rows.map((row) => row.valuation.EV_Fleet);
  const fleetCorrelation = correlation(fleetTotals, evFleetValues);
  const verifiedValues = verified.map((row) => row.valuation.EV_EBITDA);
  const reviewValues = review.map((row) => row.valuation.EV_EBITDA);

  const headline =
    topic?.id === "asset_quality"
      ? `선대 규모와 EV/Fleet 상관계수 ${fmtNumber(fleetCorrelation, 2)}`
      : topic?.id === "disclosure_quality"
        ? `verified 표본 ${verified.length}개, review/미확인 ${review.length}개 비교`
        : `탱커 ${tanker.length}개 vs 벌커 ${bulk.length}개 실제 멀티플 비교`;

  return `
    <div class="analysis-result-head">
      <h3>실제 분석 결과</h3>
      <span>${escapeHtml(headline)}</span>
    </div>
    <div class="analysis-method-tabs">
      ${ANALYSIS_METHODS.map(
        (method) => `
          <button type="button" class="${method.id === state.activeAnalysisMethod ? "active" : ""}" data-analysis-method="${escapeHtml(method.id)}">
            <strong>${escapeHtml(method.label)}</strong>
            <span>${escapeHtml(method.text)}</span>
          </button>
        `,
      ).join("")}
    </div>
    <div class="analysis-execution">
      ${renderSelectedMethod(rows)}
    </div>
    <div class="analysis-interpretation">
      <strong>논문용 해석 초안</strong>
      <p>${escapeHtml(methodInterpretation(rows))}</p>
    </div>
    <div class="analysis-result-grid">
      ${renderMetricResult("탱커 EV/EBITDA", tanker.map((row) => row.valuation.EV_EBITDA))}
      ${renderMetricResult("벌커 EV/EBITDA", bulk.map((row) => row.valuation.EV_EBITDA))}
      ${renderMetricResult("Verified EV/EBITDA", verifiedValues)}
      ${renderMetricResult("Review EV/EBITDA", reviewValues)}
    </div>
    <div class="analysis-test-row">
      <div>
        <strong>그룹 차이 검정</strong>
        <span>탱커-벌커 평균 차이 permutation p-value ${pValue === null ? "-" : fmtNumber(pValue, 3)}</span>
      </div>
      <div>
        <strong>선대 규모 효과</strong>
        <span>Fleet_Total과 EV/Fleet 상관계수 ${fmtNumber(fleetCorrelation, 2)}</span>
      </div>
      <div>
        <strong>논문 표본</strong>
        <span>현재 계산 가능 ${rows.length}개 · Source verified ${verified.length}개</span>
      </div>
    </div>
  `;
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
    .map((text) => {
      const methodId = methodIdForText(text);
      return `
        <button type="button" class="method-item method-action" data-analysis-method="${escapeHtml(methodId)}">
          <span>${escapeHtml(text)}</span>
          <em>실행: ${escapeHtml(analysisMethodLabel(methodId))}</em>
        </button>
      `;
    })
    .join("");

  $("actualAnalysis").innerHTML = renderActualAnalysis(topic);
  document.querySelectorAll("[data-analysis-method]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAnalysisMethod = button.dataset.analysisMethod;
      renderThesisAssistant();
      $("actualAnalysis")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });

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

function companyLinks(entry) {
  const name = entry?.Company_Name ?? "";
  const ric = entry?.RIC ?? "";
  const fleet = entry?.fleet ?? null;
  const yahoo = ricToYahoo(ric);
  const secSearch = `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(name)}`;
  return [
    {
      label: "시장가격",
      value: yahoo ? `Yahoo Finance · ${yahoo}` : "RIC 변환 필요",
      url: yahoo ? `https://finance.yahoo.com/quote/${encodeURIComponent(yahoo)}` : "",
    },
    {
      label: "SEC 감사보고서/공시",
      value: isUsListedRic(ric)
        ? "EDGAR 20-F/10-K/10-Q 검색"
        : "SEC에 없을 수 있음 · 그래도 EDGAR 이름 검색",
      url: secSearch,
    },
    {
      label: "선대 공식자료",
      value: fleet ? `${fleet.Source_Name || "공식자료"} · ${fleet.As_Of || "기준일 확인"}` : "공식 선대 수 미확인",
      url: fleet?.Source_URL ?? "",
    },
    {
      label: "IR/연차보고서 검색",
      value: "회사명 + investor relations + annual report + fleet",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${name} investor relations annual report fleet`)}`,
    },
  ];
}

function companyFilingLinks(entry) {
  const name = entry?.Company_Name ?? "";
  const ric = entry?.RIC ?? "";
  const yahoo = ricToYahoo(ric);
  return [
    {
      label: "SEC/EDGAR",
      status: isUsListedRic(ric) ? "미국 공시 검색" : "비미국사는 없을 수 있음",
      url: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(name)}`,
    },
    {
      label: "IR/Annual Report",
      status: "회사 공시 원문 검색",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${name} annual report investor relations financial statements`)}`,
    },
    {
      label: "Yahoo 원천",
      status: yahoo ? `현재 스냅샷 ${yahoo}` : "RIC 변환 필요",
      url: yahoo ? `https://finance.yahoo.com/quote/${encodeURIComponent(yahoo)}` : "",
    },
  ];
}

function financeReliability(entry) {
  const valuation = valuationForEntry(entry);
  const finance = valuation.finance;
  const fleet = entry?.fleet ?? null;
  const isSnapshot = /yahoo finance|public snapshot|yfinance/i.test(
    `${finance?.Source ?? ""} ${finance?.Fiscal_Year ?? ""} ${finance?.Notes ?? ""}`,
  );
  const financeStatus = !finance
    ? "재무값 없음"
    : isSnapshot
      ? "시장 스냅샷 · 논문 최종값은 공시 원문으로 교체"
      : "사용자 입력 재무값";
  const fleetStatus = fleet?.Source_Status === "verified" ? "선대 verified" : fleet?.Source_Status ? `선대 ${fleet.Source_Status}` : "선대 미확인";
  return {
    financeStatus,
    fleetStatus,
    sourceDate: finance?.Source_Date ?? "",
  };
}

function valuationItems(entry) {
  const valuation = valuationForEntry(entry);
  const finance = valuation.finance;
  return [
    ["시가총액", finance?.Market_Cap, finance?.Currency],
    ["기업가치 EV", valuation.EV, finance?.Currency],
    ["매출", finance?.Revenue, finance?.Currency],
    ["EBITDA", finance?.EBITDA, finance?.Currency],
    ["EV/EBITDA", valuation.EV_EBITDA, "multiple"],
    ["P/B", valuation.P_Book, "multiple"],
    ["EV/DWT", valuation.EV_DWT, finance?.Currency],
    ["EV/Fleet", valuation.EV_Fleet, finance?.Currency],
  ];
}

function buildCompanyResearchNote(entry) {
  const firm = entry?.firm ?? null;
  const fleet = entry?.fleet ?? null;
  const valuation = valuationForEntry(entry);
  const finance = valuation.finance;
  const lines = [
    `# ${entry.Company_Name} 연구 노트`,
    "",
    `- RIC: ${entry.RIC || "미확인"}`,
    `- 주력 분류: ${firm?.Decision_Label ?? "기본 55개 표본 밖 / 별도 검토"}`,
    `- 분류 근거: ${firm?.Decision_Reason ?? "공식 선대 자료 기준으로만 확인"}`,
    `- 전체 선대: ${fleet ? `${fmtNumber(fleet.Total)}척` : "미확인"}`,
    `- 탱커: ${fleet ? fmtNumber(fleet.Tanker) : "미확인"}`,
    `- 벌커: ${fleet ? fmtNumber(fleet["Dry bulk"]) : "미확인"}`,
    `- 컨테이너: ${fleet ? fmtNumber(fleet.Container) : "미확인"}`,
    `- 가스선: ${fleet ? fmtNumber(fleet["Gas carrier"]) : "미확인"}`,
    `- 출처 상태: ${fleet?.Source_Status ?? "미확인"}`,
    `- 기준일: ${fleet?.As_Of ?? "미확인"}`,
    `- 산정 기준: ${fleet?.Basis ?? "미확인"}`,
    "",
    "## 기업가치 분석",
    "",
    `- EV/EBITDA: ${fmtMultiple(valuation.EV_EBITDA)}`,
    `- P/B: ${fmtMultiple(valuation.P_Book)}`,
    `- EV/DWT: ${fmtNumber(valuation.EV_DWT, 2)}`,
    `- EV/Fleet: ${fmtNumber(valuation.EV_Fleet, 2)}`,
    finance
      ? `- 재무 입력 출처: ${finance.Source || "출처 미기재"} ${finance.Source_Date || ""}`.trim()
      : "- 재무 입력: 아직 없음. 가치평가 입력 템플릿에 Market_Cap, Debt, Cash, EBITDA, Book_Equity, DWT_Total을 넣어야 합니다.",
    "",
    "## 논문 사용 메모",
    "",
    "- 선대 수는 출처 URL, 기준일, owned/operated/chartered 기준을 함께 인용합니다.",
    "- Source_Status가 review이면 본문 기본 표본보다 강건성 검정 또는 부록 표본으로 두는 편이 안전합니다.",
    "- 같은 선종 안에서도 선대 규모, DWT, 소유/용선 비중을 통제변수로 둡니다.",
  ];
  return lines.join("\n");
}

function buildCompanyResearchPack(entry) {
  const topic = selectedTopic();
  const note = buildCompanyResearchNote(entry);
  const links = companyLinks(entry);
  return [
    note,
    "",
    "## 선택 연구 주제 연결",
    "",
    `- 연구 주제: ${topic?.title ?? ""}`,
    `- 연구 질문: ${topic?.question ?? ""}`,
    "",
    "## 가설 적용",
    "",
    ...((topic?.hypotheses ?? []).map((text) => `- ${text}`)),
    "",
    "## 자료 링크",
    "",
    ...links.map((link) => `- ${link.label}: ${link.url || link.value}`),
    "",
    "## 이 회사로 확인할 체크포인트",
    "",
    "- 선종 분류가 회사 공식 fleet page와 일치하는가?",
    "- valuation 입력값의 회계연도와 선대 기준일이 맞는가?",
    "- EV 계산에서 부채, 현금, 리스부채, 우선주, 소수지분 처리가 일관적인가?",
    "- peer group 비교에서 탱커·벌커 혼합 회사를 제외했는가?",
  ].join("\n");
}

function renderCompanyDashboard() {
  const entry = selectedCompany();
  if (!entry) {
    $("selectedCompanyName").textContent = "회사 대시보드";
    $("selectedCompanySubtitle").textContent = "왼쪽 회사 목록에서 회사를 선택합니다";
    $("selectedCompanyStatus").textContent = "";
    $("companyDashboard").innerHTML = `<div class="empty-list">선종 분류 또는 주력 분류를 누른 뒤 회사를 선택하세요.</div>`;
    return;
  }

  const firm = entry.firm;
  const fleet = entry.fleet;
  const valuation = valuationForEntry(entry);
  const finance = valuation.finance;
  const reliability = financeReliability(entry);
  $("selectedCompanyName").textContent = entry.Company_Name;
  $("selectedCompanySubtitle").textContent = `${entry.RIC || "RIC 미확인"} · ${firm?.Decision_Label ?? "공식 선대자료"} · ${fleet?.Basis ?? "선대 기준 확인 필요"}`;
  $("selectedCompanyStatus").textContent = fleet?.Source_Status
    ? `${fleet.Source_Status} · ${fleet.As_Of || "기준일 확인"}`
    : "선대 출처 미확인";

  const fleetCounts = [
    ["전체", fleet?.Total],
    ["탱커", fleet?.Tanker],
    ["벌커", fleet?.["Dry bulk"]],
    ["컨테이너", fleet?.Container],
    ["가스", fleet?.["Gas carrier"]],
    ["일반화물", fleet?.["General cargo"]],
    ["오프쇼어", fleet?.Offshore],
    ["여객", fleet?.Passenger],
    ["기타", fleet?.Other],
  ];

  const valuationHtml = valuationItems(entry)
    .map(([label, value, unit]) => {
      const display = unit === "multiple" ? fmtMultiple(value) : value === null || value === undefined ? "-" : `${fmtNumber(value, 2)}${unit && unit !== "multiple" ? ` ${escapeHtml(unit)}` : ""}`;
      return `
        <div class="company-metric">
          <span>${escapeHtml(label)}</span>
          <strong>${display}</strong>
        </div>
      `;
    })
    .join("");

  const linksHtml = companyLinks(entry)
    .map(
      (link) => `
        <div class="company-link-row">
          <strong>${escapeHtml(link.label)}</strong>
          <span>${escapeHtml(link.value)}</span>
          ${link.url ? `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">열기</a>` : `<em>수동 확인</em>`}
        </div>
      `,
    )
    .join("");
  const filingQuickLinksHtml = companyFilingLinks(entry)
    .map(
      (link) => `
        <a class="filing-chip" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
          <strong>${escapeHtml(link.label)}</strong>
          <span>${escapeHtml(link.status)}</span>
        </a>
      `,
    )
    .join("");

  $("companyDashboard").innerHTML = `
    <div class="company-summary-grid">
      <div class="company-overview">
        <span class="badge ${firm ? badgeClass(firm.Decision_Group) : "mixed"}">${escapeHtml(firm?.Decision_Label ?? "선대자료")}</span>
        <p>${escapeHtml(firm?.Decision_Reason ?? "기본 표본에는 없지만 공식 공개자료 기반 선대 수가 연결된 상장 해운사입니다.")}</p>
        <div class="company-actions">
          <button type="button" data-company-action="links">자료실</button>
          <button type="button" data-company-action="note">연구노트</button>
          <button type="button" data-company-action="pack">논문패키지</button>
        </div>
      </div>
      <div class="fleet-count-grid">
        ${fleetCounts
          .map(
            ([label, value]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <strong>${value === null || value === undefined ? "-" : fmtNumber(value)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>

    <div class="company-detail-grid">
      <section>
        <h3>기업가치분석</h3>
        <div class="reliability-strip">
          <span>${escapeHtml(reliability.financeStatus)}</span>
          <span>${escapeHtml(reliability.fleetStatus)}</span>
          <span>${escapeHtml(reliability.sourceDate || "기준일 확인 필요")}</span>
        </div>
        <div class="company-metric-grid">${valuationHtml}</div>
        <div class="filing-chip-row">${filingQuickLinksHtml}</div>
        <p class="helper-text">${
          finance
            ? escapeHtml(`${finance.Fiscal_Year || "회계연도 미기재"} 재무 입력 반영 · ${finance.Source || "출처 미기재"} · 감사보고서 확정값은 공시 원문 확인 필요`)
            : "재무 CSV를 넣으면 EV/EBITDA, P/B, EV/DWT, EV/Fleet이 회사별로 바로 계산됩니다."
        }</p>
      </section>
      <section>
        <h3>선대·공시 출처</h3>
        <div class="company-link-list">${linksHtml}</div>
      </section>
      <section>
        <h3>논문 작성 메모</h3>
        <div class="note-box">
          <p>${escapeHtml(fleet ? `${fleet.Source_Status || "review"} 상태 자료입니다. ${fleet.Basis || "산정 기준"} 기준으로 ${fleet.As_Of || "기준일"}에 확인된 선대 수를 사용합니다.` : "선대 원장 또는 공식 fleet page 확인이 필요합니다.")}</p>
          <p>${escapeHtml(firm ? `${firm.Decision_Label} 표본으로 분류됩니다. peer group 비교에서는 같은 기준으로 재무 입력과 선대 기준일을 맞춰야 합니다.` : "기본 55개 표본 밖 회사이므로 주력 선종 분류를 별도 확정해야 합니다.")}</p>
        </div>
      </section>
    </div>
  `;

  document.querySelectorAll("[data-company-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.companyAction;
      if (action === "links") showDirectoryDataroom(entry.key);
      if (action === "note") {
        showPreview({
          title: `${entry.Company_Name} 연구노트`,
          filename: `${entry.RIC || entry.Company_Name}_research_note.md`,
          content: buildCompanyResearchNote(entry),
          type: "markdown",
        });
      }
      if (action === "pack") {
        showPreview({
          title: `${entry.Company_Name} 논문패키지`,
          filename: `${entry.RIC || entry.Company_Name}_thesis_pack.md`,
          content: buildCompanyResearchPack(entry),
          type: "markdown",
        });
      }
    });
  });
}

function showDirectoryDataroom(key) {
  const entry = buildCompanyDirectory().find((item) => item.key === key);
  if (!entry) return;
  const links = companyLinks(entry);
  const csv = toCsv(
    links.map((link) => ({
      Company_Name: entry.Company_Name,
      RIC: entry.RIC,
      Item: link.label,
      Value: link.value,
      URL: link.url,
    })),
  );
  showPreview({
    title: `${entry.Company_Name} 자료실`,
    filename: `${entry.RIC || entry.Company_Name}_research_links.csv`,
    content: csv,
    type: "html",
    html: `
      <div class="dataroom-head">
        <strong>${escapeHtml(entry.firm?.Decision_Label ?? "선대자료")}</strong>
        <span>${escapeHtml(entry.firm?.Decision_Reason ?? fleetListMeta(entry))}</span>
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

function showCompanyDataroom(ric) {
  const entry = buildCompanyDirectory().find((item) => item.RIC === ric);
  if (entry) showDirectoryDataroom(entry.key);
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
    state.financeLoadedFrom = file.name;
  } else {
    state.firms = rows.map(normalizeFirm).filter((row) => row.RIC && row.Company_Name);
  }

  document.querySelector(".analysis").classList.remove("flash");
  requestAnimationFrame(() => document.querySelector(".analysis").classList.add("flash"));
  render();
}

async function init() {
  const [firmsResponse, fleetResponse, toolsResponse, blueprintResponse, valuationResponse] = await Promise.all([
    fetch("./data/firms.json", { cache: "no-store" }),
    fetch("./data/listed_fleet_counts.json", { cache: "no-store" }),
    fetch("./data/open_source_tools.json", { cache: "no-store" }),
    fetch("./data/research_blueprint.json", { cache: "no-store" }),
    fetch("./data/valuation_inputs_generated.json", { cache: "no-store" }).catch(() => null),
  ]);
  state.firms = (await firmsResponse.json()).map(normalizeFirm);
  state.officialFleet = (await fleetResponse.json()).map(normalizeFleetSummaryRow).filter(Boolean);
  state.openSourceTools = await toolsResponse.json();
  state.researchBlueprint = await blueprintResponse.json();
  if (valuationResponse?.ok) {
    const financeRows = await valuationResponse.json();
    financeRows.map(normalizeFinance).forEach((row) => {
      if (row) state.finance.set(row.RIC, row);
    });
    state.financeLoadedFrom = "내장 재무 스냅샷";
  }
  state.activeTopic = state.researchBlueprint.topics?.[0]?.id ?? state.activeTopic;
  $("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  $("groupFilter").addEventListener("change", (event) => {
    state.filter = event.target.value;
    state.directoryMode = "core";
    state.activeCoreGroup = event.target.value;
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
  render();
}

init().catch((error) => {
  console.error(error);
  $("dataStatus").textContent = "데이터 로드 실패";
});
