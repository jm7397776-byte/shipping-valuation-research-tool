#!/usr/bin/env python3
"""Create a public-data valuation snapshot with yfinance.

This is a convenience layer for the demo dashboard. For thesis-grade final
numbers, replace these rows with audited annual-report values and keep the same
schema.
"""

from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path
from typing import Any

import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_COLUMNS = [
    "RIC",
    "Fiscal_Year",
    "Currency",
    "Market_Cap",
    "Enterprise_Value",
    "Revenue",
    "EBITDA",
    "EBIT",
    "Net_Income",
    "Total_Debt",
    "Cash",
    "Book_Equity",
    "Fleet_Total",
    "Fleet_Tankers",
    "Fleet_Bulkers",
    "DWT_Total",
    "Source",
    "Source_Date",
    "Notes",
]


def ric_to_yahoo(ric: str) -> str:
    replacements = {
        ".OQ": "",
        ".N": "",
        ".A": "",
        ".OL": ".OL",
        ".CO": ".CO",
        ".HK": ".HK",
        ".T": ".T",
        ".TW": ".TW",
        ".KS": ".KS",
        ".NS": ".NS",
        ".BK": ".BK",
        ".JK": ".JK",
        ".DE": ".DE",
        ".L": ".L",
        ".ST": ".ST",
        ".HE": ".HE",
        ".TL": ".TL",
        ".PSX": ".KA",
        ".HNO": ".HN",
    }
    for suffix, yahoo_suffix in replacements.items():
        if ric.endswith(suffix):
            return ric[: -len(suffix)] + yahoo_suffix
    return ric


def as_number(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def main() -> None:
    firms = json.loads((DATA_DIR / "firms.json").read_text(encoding="utf-8"))
    fleets = json.loads((DATA_DIR / "listed_fleet_counts.json").read_text(encoding="utf-8"))
    by_ric: dict[str, dict[str, Any]] = {}

    for row in firms:
        if row.get("RIC"):
            by_ric[row["RIC"]] = {
                "Company_Name": row.get("Company_Name", ""),
                "fleet": {},
            }
    for row in fleets:
        ric = row.get("RIC")
        if not ric:
            continue
        item = by_ric.setdefault(ric, {"Company_Name": row.get("Company_Name", ""), "fleet": {}})
        item["fleet"] = row

    today = date.today().isoformat()
    results: list[dict[str, Any]] = []

    for ric, item in sorted(by_ric.items()):
        yahoo = ric_to_yahoo(ric)
        try:
            info = yf.Ticker(yahoo).get_info()
        except Exception as exc:  # noqa: BLE001 - public API can fail per ticker
            print(f"skip {ric} ({yahoo}): {exc}")
            continue

        market_cap = as_number(info.get("marketCap"))
        enterprise_value = as_number(info.get("enterpriseValue"))
        revenue = as_number(info.get("totalRevenue"))
        ebitda = as_number(info.get("ebitda"))
        total_debt = as_number(info.get("totalDebt"))
        cash = as_number(info.get("totalCash"))
        shares = as_number(info.get("sharesOutstanding"))
        book_value_per_share = as_number(info.get("bookValue"))
        book_equity = (
            shares * book_value_per_share
            if shares is not None and book_value_per_share is not None
            else None
        )
        fleet = item.get("fleet") or {}

        if not any([market_cap, enterprise_value, revenue, ebitda, book_equity]):
            continue

        results.append(
            {
                "RIC": ric,
                "Fiscal_Year": "TTM/public snapshot",
                "Currency": info.get("financialCurrency") or info.get("currency") or "",
                "Market_Cap": market_cap,
                "Enterprise_Value": enterprise_value,
                "Revenue": revenue,
                "EBITDA": ebitda,
                "EBIT": None,
                "Net_Income": as_number(info.get("netIncomeToCommon")),
                "Total_Debt": total_debt,
                "Cash": cash,
                "Book_Equity": book_equity,
                "Fleet_Total": fleet.get("Total"),
                "Fleet_Tankers": fleet.get("Tanker"),
                "Fleet_Bulkers": fleet.get("Dry_Bulk"),
                "DWT_Total": None,
                "Source": f"Yahoo Finance via yfinance ({yahoo})",
                "Source_Date": today,
                "Notes": "Public market snapshot for dashboard analysis; replace with annual-report inputs for thesis final model.",
            }
        )

    json_path = DATA_DIR / "valuation_inputs_generated.json"
    csv_path = DATA_DIR / "valuation_inputs_generated.csv"
    json_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(results)

    print(f"wrote {len(results)} valuation rows")


if __name__ == "__main__":
    main()
