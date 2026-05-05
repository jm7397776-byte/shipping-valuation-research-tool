#!/usr/bin/env python3
"""Prepare normalized data files for the shipping valuation dashboard."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import pandas as pd


OUTPUT_COLUMNS = [
    "Firm_ID",
    "Company_Name",
    "RIC",
    "Verdict_Fleet_Description",
    "Segment",
    "Tanker_Pct",
    "DryBulk_Pct",
    "Research_Group",
    "Included",
    "Exclude_Reason",
]

FINANCIAL_COLUMNS = [
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


def classify(row: pd.Series) -> tuple[str, bool, str]:
    desc = str(row.get("Verdict / Fleet Description", "")).lower()
    segment = str(row.get("Segment", "")).lower()
    tanker = float(row.get("Tanker_%", 0) or 0)
    bulk = float(row.get("DryBulk_%", 0) or 0)

    if "exclude" in desc or "insufficient trading data" in desc or "combination carrier" in desc:
        if "insufficient trading data" in desc:
            return "Excluded", False, "insufficient trading data"
        if "combination carrier" in desc:
            return "Excluded", False, "combination carrier"
        return "Excluded", False, "mixed fleet / exclusion note"

    if "tanker" in segment and tanker >= 60:
        return "Tanker treatment", True, ""

    if "dry bulk" in segment and bulk >= 70:
        return "Dry bulk control", True, ""

    return "Review", False, "classification threshold not met"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to source workbook")
    parser.add_argument("--output-dir", default="data", help="Directory for generated files")
    args = parser.parse_args()

    source = Path(args.input).expanduser()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_excel(source, sheet_name="Firm_Master", header=2)
    df = df.dropna(how="all")
    df["Firm_ID"] = df["Firm_ID"].astype(int)
    df["Tanker_%"] = pd.to_numeric(df["Tanker_%"], errors="coerce").fillna(0)
    df["DryBulk_%"] = pd.to_numeric(df["DryBulk_%"], errors="coerce").fillna(0)

    records = []
    for _, row in df.iterrows():
        group, included, reason = classify(row)
        records.append(
            {
                "Firm_ID": int(row["Firm_ID"]),
                "Company_Name": str(row["Company_Name"]).strip(),
                "RIC": str(row["RIC"]).strip(),
                "Verdict_Fleet_Description": str(row["Verdict / Fleet Description"]).strip(),
                "Segment": str(row["Segment"]).strip(),
                "Tanker_Pct": float(row["Tanker_%"]),
                "DryBulk_Pct": float(row["DryBulk_%"]),
                "Research_Group": group,
                "Included": "Yes" if included else "No",
                "Exclude_Reason": reason,
            }
        )

    with (output_dir / "firms.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(records)

    with (output_dir / "firms.json").open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    with (output_dir / "valuation_inputs_template.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FINANCIAL_COLUMNS)
        writer.writeheader()
        for record in records:
            writer.writerow({"RIC": record["RIC"]})

    print(f"Prepared {len(records)} firms in {output_dir}")


if __name__ == "__main__":
    main()
