# Shipping Fleet Classifier

상장 해운사를 선종 보유 기준과 주력 선종 기준으로 나눠 보고, 회사를 누르면 선대 수·기업가치평가·연구노트·논문패키지를 한 화면에서 확인하는 연구용 정적 대시보드입니다.

## 바로 사용

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 기본 데이터

- `data/firms.csv`: 원 엑셀의 55개 회사 표본을 정규화한 파일
- `data/firms.json`: 대시보드가 바로 읽는 기본 데이터
- `data/valuation_inputs_template.csv`: 가치평가 입력 템플릿
- `data/valuation_inputs_generated.json`: yfinance 공개 시장 데이터로 만든 기본 가치평가 스냅샷
- `data/listed_fleet_counts.json`: 공식 공개자료로 확인한 상장 해운사 선대 수
- `data/open_source_tools.json`: 가치평가·공시 수집에 쓸 오픈소스/GitHub 도구 목록
- `data/research_blueprint.json`: 논문 주제, 가설, 변수, 방법론, 공개 데이터 출처 목록

## 화면 사용 흐름

1. 왼쪽 `선종 분류`에서 벌크선, 탱커선, 컨테이너선, 가스선, 일반화물선, 오프쇼어, 여객선, 기타 중 하나를 누릅니다.
2. 아래 회사 목록에 해당 선종을 1척 이상 보유한 상장 해운사가 표시됩니다.
3. 왼쪽 `주력 분류`에서 `탱커 주력`, `벌커 주력`, `혼합·검토`, `제외`를 누르면 55개 판정표 기준 회사 목록으로 전환됩니다.
4. 회사 이름을 누르면 오른쪽 회사 대시보드에 회사 정보, 선종별 척수, 기업가치분석, 출처 링크, 연구노트, 논문패키지가 표시됩니다.
5. 상단 버튼과 회사별 `자료실`, `연구노트`, `논문패키지`는 먼저 앱 안에서 미리보기로 열리고, 필요한 경우에만 다운로드합니다.

## 분류 기준

기본값은 다음과 같습니다.

- 탱커 주력: `Tanker_Pct >= 60%` 그리고 `DryBulk_Pct <= 35%`
- 벌커 주력: `DryBulk_Pct >= 70%` 그리고 `Tanker_Pct <= 35%`
- 제외: 원자료 설명에 `EXCLUDE`, `insufficient trading data`, `combination carrier`가 있는 경우

대시보드에서 슬라이더로 기준을 바꾸면 모든 KPI, 차트, 판정표가 즉시 다시 계산됩니다.

## 가치평가 CSV 입력

`data/valuation_inputs_template.csv`에 아래 필드를 채우고 화면의 `CSV 불러오기`로 넣으면 됩니다.

기본 화면에 보이는 `data/valuation_inputs_generated.json` 값은 yfinance 공개 시장 스냅샷입니다. 빠른 분석과 화면 확인용이며, 논문 최종 표본에서는 회사의 20-F, 10-K, 연차보고서, 감사보고서 원문에서 확인한 값으로 덮어쓰는 것이 원칙입니다.

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

## 선대 수 정확성 기준

대시보드는 먼저 공식 회사 웹사이트, 연차보고서, SEC filing 등에서 확인한 상장사 선대 수를 보여줍니다. 각 숫자는 기준일, 산정 기준, 출처 URL, 검증 상태를 같이 보관합니다.

정확한 전세계 회사별 선종 수를 완성하려면 IMO 단위 선박 원장이 필요합니다. 공개 웹을 임의로 긁어 만드는 방식은 누락·중복·약관 문제가 생기므로 연구용 기준으로 쓰면 안 됩니다.

권장 원천:

- Clarksons World Fleet Register
- MarineTraffic/Kpler Vessels API
- Lloyd's List Intelligence
- S&P/IHS Maritime
- AXSMarine 계열 데이터

원장 CSV는 `data/fleet_raw_template.csv` 형식으로 넣습니다.

필수 필드:

- `Company_Name`
- `IMO`
- `Ship_Type`

선택 필드:

- `RIC`
- `Vessel_Name`
- `Ship_Type_Detail`
- `DWT`
- `GT`
- `Flag`
- `Source`
- `Source_Date`

대시보드는 `IMO`를 기준으로 중복을 제거한 뒤 회사별로 `벌크`, `탱커`, `컨테이너`, `가스`, `일반화물`, `오프쇼어`, `여객`, `기타` 척수를 집계합니다. 선종 카테고리 버튼을 누르면 해당 선종을 1척 이상 보유한 회사 목록만 표시됩니다.

## 자료 보기

- 상단 `입력 템플릿`, `선대 템플릿`, `분류 CSV`, `선대 요약`, `연구 노트` 버튼은 바로 다운로드하지 않고 앱 안에서 먼저 미리보기를 엽니다.
- 미리보기 하단의 `다운로드`를 눌렀을 때만 파일로 저장됩니다.
- 회사별 판정표의 `자료실` 버튼은 시장가격, SEC 공시, 선대 공식자료, IR 검색 링크를 보여줍니다.
- 회사 대시보드의 `기업가치분석` 영역에는 SEC/EDGAR, IR/Annual Report, Yahoo 원천 링크와 재무값 신뢰도 상태가 바로 표시됩니다.
- `기업가치평가 데이터룸`에는 OpenBB, EdgarTools, sec-edgar-downloader, yfinance, Arelle 등 연구 자동화에 쓸 오픈소스 도구 링크가 들어 있습니다.
- `기업가치평가 데이터룸`의 체크리스트 카드를 누르면 바로 아래 실행 패널에 필요한 자료, 현재 계산값, 선택 회사 기준 다음 행동이 표시됩니다.
- `논문 작성 도우미`는 데이터 완성도, 추천 연구 주제, 가설, 종속·설명변수, 분석 방법, OpenAlex/Crossref/Semantic Scholar 문헌검색 링크와 실제 계산 결과를 함께 보여줍니다.
- `실제 분석 결과`에는 탱커·벌커 EV/EBITDA 중앙값, verified/review 표본 비교, permutation p-value, Fleet_Total과 EV/Fleet 상관계수가 바로 계산됩니다.
- `분석 방법` 문장과 `실제 분석 결과`의 실행 버튼을 누르면 중앙값 비교, Mann-Whitney U/Welch t-test 근사, 60/70/80% 민감도 분석, verified 표본 강건성 분석, 선대 규모 효과, 공시 품질 비교가 화면에서 바로 계산됩니다.
- 상단 `논문 패키지` 버튼은 현재 표본 상태, 데이터 한계, 선택한 연구 주제, 가설, 방법론, 공개 데이터·오픈소스 링크를 마크다운으로 미리 보여줍니다.

## 재무 스냅샷 갱신

```bash
python3 scripts/refresh_finance_yfinance.py
```

이 명령은 `data/firms.json`과 `data/listed_fleet_counts.json`의 RIC를 읽어 `data/valuation_inputs_generated.json`과 `.csv`를 다시 만듭니다. yfinance 값은 공개 시장 스냅샷이므로 논문 최종값은 감사보고서·연차보고서에서 확인한 수치로 CSV 업로드해 덮어쓰는 것을 권장합니다.

## 논문에 바로 쓸 때의 기준

현재 앱은 논문 기획과 표본 구축에 필요한 뼈대를 제공합니다. 다만 무료 공개자료만으로 전세계 모든 상장 해운사의 회사별 정확한 선종 수가 완성됐다고 단정하면 안 됩니다.

논문 본문에는 다음처럼 쓰는 편이 안전합니다.

- 기본 분석: `Source_Status = verified`인 회사와 재무 입력이 있는 회사
- 보조 분석: `Source_Status = review`까지 포함한 확장 표본
- 한계: 공개자료 기반 선대 수는 회사별 산정 기준이 owned, operated, chartered, pool, pro-forma로 다를 수 있음
- 개선 방향: Clarksons, Kpler, Lloyd's List Intelligence, S&P/IHS 등 IMO 단위 원장 확보 후 재현

## 공유

터미널이 꺼져도 다른 사람이 볼 수 있게 하려면 GitHub Pages 링크를 공유합니다.

- GitHub Pages: `https://jm7397776-byte.github.io/shipping-valuation-research-tool/`
- 로컬 확인: `python3 -m http.server 4173`
- 임시 비공개 확인: `SHIPPING_TOOL_PASSWORD=원하는비밀번호 python3 scripts/serve_private.py`

GitHub Pages는 공개 링크입니다. 민감한 유료 원장이나 비공개 재무자료는 업로드하지 말고, 공개 가능한 공식 출처 기반 자료만 올립니다.
