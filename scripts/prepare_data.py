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
    "Primary_Ship_Type_4",
    "Gas_Pct",
    "DryBulk_4_Pct",
    "Container_Pct",
    "Tanker_4_Pct",
    "Secondary_Ship_Types",
    "Ship_Type_4_Source",
    "Ship_Type_4_Note",
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
    "Fleet_Gas_Carriers",
    "Fleet_Containers",
    "DWT_Total",
    "Source",
    "Source_Date",
    "Notes",
]

GAS_TERMS = ("lng", "lpg", "gas", "vlgc", "vlac", "ethane", "ammonia carrier")
DRY_BULK_TERMS = ("dry bulk", "bulker", "bulk carrier", "vloc")
CONTAINER_TERMS = ("container", "containership", "liner")
TANKER_TERMS = ("tanker", "vlcc", "aframax", "suezmax", "product", "crude", "chemical", "parcel")


def as_float(value: object) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    return number if number == number else 0.0


def text_has(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def infer_ship_type_4(row: pd.Series) -> dict[str, object]:
    """Split the thesis sample into Gas / Dry bulk / Container / Tanker.

    The original workbook only gives Tanker_% and DryBulk_% because the first
    research design was tanker-vs-bulker. These fields stay intact. The new
    four-way fields are a separate interpretation layer so LNG/LPG/gas carriers
    do not get shown as tanker or dry-bulk primary companies.
    """
    desc_raw = str(row.get("Verdict / Fleet Description", "")).strip()
    segment_raw = str(row.get("Segment", "")).strip()
    text = f"{desc_raw} {segment_raw}".lower()
    tanker = as_float(row.get("Tanker_%", 0))
    dry_bulk = as_float(row.get("DryBulk_%", 0))
    excluded = (
        "exclude" in text
        or "insufficient trading data" in text
        or "combination carrier" in text
        or "mixed" in text
    )

    gas_hit = text_has(text, GAS_TERMS)
    dry_hit = text_has(text, DRY_BULK_TERMS) or dry_bulk > 0
    container_hit = text_has(text, CONTAINER_TERMS)
    tanker_hit = text_has(text, TANKER_TERMS) or tanker > 0
    pure = "pure-play" in text
    predominant = "predominantly" in text

    gas_pct = 0.0
    container_pct = 0.0
    dry_bulk_4 = dry_bulk
    tanker_4 = tanker
    notes: list[str] = []

    # LNG/LPG/gas carriers were sometimes placed in the legacy tanker bucket.
    # Move those pure or near-pure gas exposures into the dedicated gas field.
    if gas_hit and tanker >= 60 and dry_bulk <= 10 and (pure or "lng" in text or "lpg" in text or "gas/" in text):
        gas_pct = tanker
        tanker_4 = 0.0
        notes.append("Gas exposure split out from legacy Tanker_% research bucket.")
    elif gas_hit and dry_bulk >= 60:
        notes.append("Gas exposure mentioned as secondary; dry-bulk remains primary because DryBulk_% is dominant.")
    elif gas_hit:
        notes.append("Gas exposure identified from LNG/LPG/gas wording; exact percentage not available in Firm_Master.")

    if container_hit and not excluded and not tanker_hit and not dry_hit and not gas_hit:
        container_pct = 100.0
    elif container_hit:
        notes.append("Container exposure mentioned as secondary or mixed; exact percentage not available in Firm_Master.")

    scores = {
        "Gas": gas_pct,
        "Dry bulk": dry_bulk_4,
        "Container": container_pct,
        "Tanker": tanker_4,
    }
    primary = max(scores, key=scores.get)
    if excluded:
        primary = "Mixed / review"
    elif scores[primary] == 0:
        if gas_hit:
            primary = "Gas"
        elif container_hit:
            primary = "Container"
        elif predominant and dry_hit:
            primary = "Dry bulk"
        elif tanker_hit:
            primary = "Tanker"
        else:
            primary = "Mixed / review"

    secondary = []
    for label, hit in [
        ("Gas", gas_hit),
        ("Dry bulk", dry_hit),
        ("Container", container_hit),
        ("Tanker", tanker_hit),
    ]:
        if hit and label != primary:
            secondary.append(label)

    source = "Firm_Master text + Tanker_%/DryBulk_%; official fleet ledger overrides when available"
    if not notes:
        notes.append("Primary type inferred from dominant percentage or pure-play description.")

    return {
        "Primary_Ship_Type_4": primary,
        "Gas_Pct": gas_pct,
        "DryBulk_4_Pct": dry_bulk_4,
        "Container_Pct": container_pct,
        "Tanker_4_Pct": tanker_4,
        "Secondary_Ship_Types": "; ".join(secondary),
        "Ship_Type_4_Source": source,
        "Ship_Type_4_Note": " ".join(notes),
    }


def classify(row: pd.Series) -> tuple[str, bool, str]:
    desc = str(row.get("Verdict / Fleet Description", "")).lower()
    segment = str(row.get("Segment", "")).lower()
    tanker = float(row.get("Tanker_%", 0) or 0)
    bulk = float(row.get("DryBulk_%", 0) or 0)
    primary = str(infer_ship_type_4(row).get("Primary_Ship_Type_4", ""))

    if "exclude" in desc or "insufficient trading data" in desc or "combination carrier" in desc:
        if "insufficient trading data" in desc:
            return "Excluded", False, "insufficient trading data"
        if "combination carrier" in desc:
            return "Excluded", False, "combination carrier"
        return "Excluded", False, "mixed fleet / exclusion note"

    if primary in {"Gas", "Container"}:
        return "Review", False, f"{primary} primary; separated from tanker-vs-dry-bulk core"

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
        ship_type_4 = infer_ship_type_4(row)
        records.append(
            {
                "Firm_ID": int(row["Firm_ID"]),
                "Company_Name": str(row["Company_Name"]).strip(),
                "RIC": str(row["RIC"]).strip(),
                "Verdict_Fleet_Description": str(row["Verdict / Fleet Description"]).strip(),
                "Segment": str(row["Segment"]).strip(),
                "Tanker_Pct": float(row["Tanker_%"]),
                "DryBulk_Pct": float(row["DryBulk_%"]),
                **ship_type_4,
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
