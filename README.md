# Shipping Fleet Classifier

탱커·벌커 상장사 표본을 `탱커 주력`, `벌커 주력`, `혼합·검토`, `제외`로 재현 가능하게 구분하는 연구용 정적 대시보드입니다.

## 바로 사용

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 기본 데이터

- `data/firms.csv`: 원 엑셀의 55개 회사 표본을 정규화한 파일
- `data/firms.json`: 대시보드가 바로 읽는 기본 데이터
- `data/valuation_inputs_template.csv`: 가치평가 입력 템플릿

## 분류 기준

기본값은 다음과 같습니다.

- 탱커 주력: `Tanker_Pct >= 60%` 그리고 `DryBulk_Pct <= 35%`
- 벌커 주력: `DryBulk_Pct >= 70%` 그리고 `Tanker_Pct <= 35%`
- 제외: 원자료 설명에 `EXCLUDE`, `insufficient trading data`, `combination carrier`가 있는 경우

대시보드에서 슬라이더로 기준을 바꾸면 모든 KPI, 차트, 판정표가 즉시 다시 계산됩니다.

## 가치평가 CSV 입력

`data/valuation_inputs_template.csv`에 아래 필드를 채우고 화면의 `CSV 불러오기`로 넣으면 됩니다.

- `RIC`
- `Fiscal_Year`
- `Currency`
- `Market_Cap`
- `Enterprise_Value`
- `Revenue`
- `EBITDA`
- `EBIT`
- `Net_Income`
- `Total_Debt`
- `Cash`
- `Book_Equity`
- `Fleet_Total`
- `Fleet_Tankers`
- `Fleet_Bulkers`
- `DWT_Total`
- `Source`
- `Source_Date`
- `Notes`

앱 계산식:

- `EV = Enterprise_Value`, 없으면 `Market_Cap + Total_Debt - Cash`
- `EV/EBITDA = EV / EBITDA`
- `EV/Revenue = EV / Revenue`
- `P/B = Market_Cap / Book_Equity`
- `EV/DWT = EV / DWT_Total`
- `EV/Fleet = EV / Fleet_Total`

## 배포

정적 파일만 쓰므로 GitHub Pages, Netlify, Vercel, 사내 웹서버에 그대로 올릴 수 있습니다.

```bash
git init
git add .
git commit -m "Add shipping fleet classifier"
```

GitHub Pages를 쓰면 링크 하나로 다른 사람이 같은 화면을 볼 수 있습니다.
