# Geography Quiz — 작업 지침

국기·수도·지도 위치를 묻는 오프라인 지원 PWA. 한국어로 답한다.

## 구조

빌드 도구·프레임워크·패키지 매니저가 **없다**. 정적 호스팅(GitHub Pages)에 그대로 올린다.

```
index.html   앱 전체 — CSS + 마크업 + JS + COUNTRIES 데이터(197개국, 지도 geometry 포함)
sw.js        서비스 워커. index.html은 네트워크 우선, 나머지는 캐시 우선
manifest.webmanifest / icon-*.png / apple-touch-icon.png
assets/fonts/Geist-Variable.ttf
```

`index.html` 한 파일에 전부 들어간다. 파일을 쪼개지 말 것. JS는 대부분 한 줄에 압축된 스타일이라 수정 시 주변 코드의 밀도·네이밍을 따른다.

## 수정 방법

- 큰 편집은 Python 패치 스크립트로 한다. 스크래치패드에 스크립트를 쓰고, 각 치환마다 `assert s.count(old)==1`로 유일성을 검증한 뒤 적용한다. 정규식으로 CSS 규칙을 일괄 삭제할 때는 비슷한 이름(`.sub` vs `.stat-sub`, `.region-option` vs `.region-options`)을 같이 지우지 않는지 확인한다 — 실제로 두 번 사고가 났다.
- **CSS를 지울 때 조각(특히 `@keyframes`의 스텝과 짝 없는 `}`)을 남기지 말 것.** 남은 `}` 하나가 바로 **다음 규칙을 통째로 삼킨다** — 에러도 안 나고 선택자는 소스에 멀쩡히 보이는데 그 규칙만 안 먹는다(`.answer-mode`의 `justify-content:center`가 이렇게 죽어 Ready 화면 칩이 왼쪽으로 쏠렸다). CSS를 건드렸으면 CSSOM으로 확인한다:
  ```js
  // 최상위에 올라온 키프레임 스텝이 있으면 그 앞이 깨진 것이다
  const seen=new Set();(function w(rs){for(const r of rs){if(r.selectorText)seen.add(r.selectorText);if(r.cssRules)w(r.cssRules)}})(document.styleSheets[0].cssRules);
  [...seen].filter(s=>/^\d+%/.test(s))   // []이어야 한다
  ```
  그리고 바꾼 속성은 `getComputedStyle`로 실제 값이 들어갔는지 본다.
- 편집 후 항상 문법 검사:
  ```
  node -e "const h=require('fs').readFileSync('index.html','utf8');for(const x of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){try{new Function(x[1])}catch(e){console.log('SYNTAX',e.message)}}"
  ```

## 검증

주장하기 전에 헤드리스 브라우저로 확인한다. 스크래치패드에 `playwright-core`가 설치돼 있고 Chromium은 `~/Library/Caches/ms-playwright/chromium_headless_shell-1234/...`에 있다.

```js
const {chromium}=require('<scratchpad>/node_modules/playwright-core')
const b=await chromium.launch({executablePath:process.env.HOME+'/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-x64/chrome-headless-shell'})
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2})
```

`python3 -m http.server 8765`로 띄운 뒤 접속한다(`file://`는 서비스 워커가 안 돈다). Node 스크립트가 멈출 수 있으므로 워치독을 건다:
`(node smoke.js & PID=$!; (sleep 60; kill $PID 2>/dev/null) & wait $PID)`

`pageerror` 리스너로 콘솔 에러를 수집하고, 레이아웃 변경은 좌표(`getBoundingClientRect().top`)를 재서 "위치가 안 변했다"를 수치로 확인한다. 스크린샷도 남겨 눈으로 본다.

## 커밋

작업이 끝나면 커밋하고 **바로 `git push origin main`** 한다(사용자가 매번 폰에서 확인함). 커밋 메시지는 영어, 본문에 무엇을·왜를 적는다. 배포 URL: https://gwkor.github.io/geography-quiz/

## 데이터 모델 (localStorage, schema 3)

| 키 | 내용 |
|---|---|
| `geoQuizSchema` | `"3"` — `migrateStorage()`가 v1·v2 키를 흡수 |
| `geoQuizSettings` | `{region, difficulty, autoMode, answerMode, capitalDirection, name, createdAt}` |
| `geoQuizStats` | 누적 집계 + `byMode[모드][난이도].seenByCode/correctByCode` + `missedByMode[모드][난이도]` |
| `geoQuizHistory` | 종료된 세션 기록(최대 500건). 각 항목에 `difficulty` 포함 |
| `geoQuizSessionsV2` | 진행 중 세션. **기기 로컬 전용, 동기화 대상 아님** |
| `geoQuizInstall` | 홈 화면 추가 배너 상태 `{dismissedAt, installed}` |

향후 계정 동기화 시 올릴 단위는 settings + stats + history. 세션 키는 `모드:난이도:지역`(예: `flag:typed:Asia`), 연습은 `flag:typed:Mistakes`.

v2 → v3 마이그레이션은 지역을 `All`로 리셋하고, 진행 중 세션을 전부 버리고(`geoQuizSessionsV2` 삭제), 기존 통계·기록을 `typed`쪽으로 옮긴다.

## 규칙·관례

- **모드 3종** flag / map / capital. 헤더 제목은 `Flag`/`Map`/`Capital`(`Quiz`를 빼서 칩 자리를 만들었다).
- **지역과 난이도는 전역 설정 1개씩**이다(세 모드가 공유). 헤더 오른쪽 타이머 옆의 아이콘 칩(`#headerChips`)에서 바꾼다 — 지구본 = 지역, 키보드/목록 = 난이도. 난이도 칩은 설명이 붙은 팝오버다. 팝오버는 폭이 넓어서 칩이 아니라 **`.header-tools` 오른쪽 끝에 붙인다**(`position:static` + `right:0`) — 칩 기준으로 가운데 정렬하면 화면 밖으로 나간다.
- 헤더에는 아이콘만 들어가므로 **지금 지역·난이도가 무엇인지는 글래스 화면 제목 위의 읽기 전용 칩**(`[data-panel-chips]`, `renderChipBar`가 채운다)이 알려준다. 누르는 물건이 아니다. Auto mode 토글과 같은 34px 높이에 테두리는 `var(--accent)`라 모드마다 색이 바뀐다. Ready·Paused·Session ended 셋 다 있어야 패널 높이가 맞는다.
- **묻는 건 전부 앱 안의 대화상자로 한다**(`askConfirm` / `askText` / `askInfo`, `#modal`). `confirm`·`prompt`·`alert`는 쓰지 않는다 — iOS 홈 화면 앱에서 모양이 튄다. 셋 다 Promise를 돌려주므로 호출하는 쪽을 `async`로 바꿔야 한다(`setRegion`/`setDifficulty`가 그래서 async다). 파괴적인 동작은 `danger:true`로 빨간 버튼을 쓰되, **`button.danger`가 글자색을 빨강으로 칠하므로 채운 버튼에는 `color`를 다시 지정해야 한다** — 안 그러면 빨강 위 빨강으로 글자가 사라진다.
- **난이도 2종** `typed`(주관식 입력) / `choice`(4지선다). `difficulty()`로 읽고, 통계·연습·기록은 현재 난이도 기준으로만 보여준다(지역으로는 나누지 않는다 — By region 매트릭스가 깨진다).
- **Choice 모드는 한 문제에 한 칸만 묻는다**(`questionVariant`). Country·Capital 토글이 둘 다 켜져 있으면 Capital Quiz처럼 문제마다 번갈아 내고 라벨도 `Mixed`가 된다. 따라서 타이머에 25분(`BOTH_SESSION_MS`)을 주지 않는다.
- **보기는 답에 가까운 것부터 뽑는다**(`buildChoices`): 국기 문제의 나라 이름은 `SIMILAR` → 같은 subregion → 같은 region 순. 다른 대륙 나라가 섞이면 답이 바로 보인다. 뽑은 보기는 `s.choices[index]`에 저장해 다시 굴릴 수 없게 한다. 단 **일시정지는 남은 문제를 다시 섞으므로** 저장 키에 국가 코드를 함께 넣어 슬롯이 밀렸을 때 새로 뽑는다.
- Choice 모드에서는 힌트가 의미 없으므로 `showHint`가 바로 빠지고 입력 필드 대신 `#choiceList`를 보여준다. 문제 프레임(`--visual-h`)이 그만큼 줄어들어 **카드 높이는 두 난이도가 동일**하다 — 이게 깨지면 글래스 패널 정렬과 스크롤이 함께 깨진다.
- **전역 값을 바꿀 때 진행 중 세션이 있으면** `confirmDiscardLive()`로 먼저 물어보고, 수락하면 `endLiveSessions()`가 한 문제라도 푼 세션은 quit으로 기록하고 전부 정리한다. 세션 키에 지역·난이도가 들어가므로 이 정리를 빠뜨리면 세션이 유령처럼 남는다.
- **오답 목록은 난이도별로 따로**다. 단 `typed`로 맞히면 `choice`쪽 오답까지 지우고, `choice`로 맞히면 `choice`쪽만 지운다(주관식이 더 어려우므로).
- **타이머**(`sessionMsFor`): All은 20분, 단 Flag/Map에서 Country+Capital 둘 다 답하면 25분(한 문제에 두 칸을 채우므로). Capital Quiz는 토글과 무관하게 답하는 칸이 하나라 항상 20분. 개별 지역은 10분, 연습(Mistakes)은 무제한(`Practice` 표시). 시작 전 토글을 바꾸면 남은 시간도 다시 계산된다.
- **색**: `--flag` 라벤더 / `--map` 카키 / `--capital` 탄 / `--settings` 로즈. 결과색은 `--good/--warn/--bad`. 새 색을 쓰지 말고 토큰을 쓴다. 활성 탭 색은 `--accent`로 자동 전환된다.
- **채점 결과는 세 가지다**: 정답(초록) / 힌트 정답(노랑, 일부만 힌트로 보고 나머지는 직접 입력) / 오답(빨강). 뒤 둘은 모두 점수에 포함되지 않지만 힌트 정답만 `hinted`·`hintedByCode`로 따로 집계해 Statistics·결과 화면·Weak spots에 표시한다.
- **한 칸을 힌트로 전부 열면 그 칸은 오답이다**(`state.countryRevealed`/`capitalRevealed`). 플래그는 문제 단위로 고정되므로 지웠다 다시 직접 입력해도 되살아나지 않는다. 전부 열리면 자동 제출되고, Auto mode에서도 자동 진행하지 않고 `Got it`을 기다린다.
- **글래스 화면**(Ready / Paused / Finished / Session ended)은 모두 Ready 패널 기준 높이로 상단 정렬된다(`lockReadyPanelOffset`). Ready의 Start 아래에는 최고 기록 블록(`#readyBest`, 높이 64px 고정)이 있고 Paused에서는 같은 자리에 Quit이 온다. 이 블록 높이를 바꾸면 모든 패널이 같이 움직이므로 빈 상태에도 같은 높이를 유지해야 한다.
- **기록은 한 세션**이다(`bestFor`/`beatsRecord`): 최고 점수, 동점이면 더 짧은 시간. **모드 + 지역 + 답변 유형**(country/capital/both, capital quiz는 shuffle)별로 따로 집계한다 — Country만 맞추는 세션과 Both는 난이도가 달라 섞으면 안 된다. "가장 빠른 세션"을 따로 두면 전부 틀리고 넘기는 게 1위가 되므로 쓰지 않는다. 경신하면 결과 화면에 배지가 뜬다(`s.record` = first/score/time). 전환 애니메이션은 **문제 화면 ↔ 글래스 화면**에만 넣고 글래스 → 글래스는 즉시 전환한다.
- **일시정지는 커닝 수단이 될 수 없어야 한다**: 답하지 않은 문제에서 멈추면 `#visual`(국기·지도·이름)을 즉시 숨기고(`.quiz.hide-question`), Resume 시 남은 문제를 다시 섞어 다른 문제를 낸다. 이미 채점된 문제에서는 둘 다 하지 않는다. 일시정지된 세션이 있는 모드는 그 탭이 비활성일 때 아이콘이 강조색으로 점멸한다(`updateNavPausedMarks`, `saveSessions`에서 호출).
- 애니메이션은 `prefers-reduced-motion`에서 꺼져야 한다.
- 시트 메뉴는 **press-drag-release**(누른 채 끌면 하이라이트가 손가락을 따라가고, 항목 밖에서 떼면 취소)로 동작한다. 포인터 이벤트 + `setPointerCapture`를 쓰고 `touch-action:none`이 필요하다.
- 지도 데이터는 Natural Earth(110m 기본, 작은 섬나라는 10m). 새 국가를 추가하면 같은 소스에서 외곽선을 가져오고 좌표는 소수점 4자리로 줄인다.
- 정답 판정은 `normLoose()`로 비교한다: 악센트·기호 제거에 더해 **`the`/`of` 생략 가능, `St.`=`Saint`**. 그 외 철자는 정확해야 한다 — 오타 허용(편집거리)은 의도적으로 넣지 않았다. `Iran`/`Iraq`, `Niger`/`Nigeria`, `Gambia`/`Zambia`처럼 1글자 차이인 다른 나라가 8쌍 있어서 퀴즈의 목적 자체가 무너진다. 끝 `s` 생략과 `City` 생략도 오답이다.
- **자동 채점**: 보이는 모든 필드가 정답이 되는 순간 채점한다(`autoCheck`). 모르는 문제는 `Show answer`(또는 빈 칸에서 Enter)로 넘긴다 — 자동 채점은 정답일 때만 발동하므로 이 버튼이 유일한 탈출구다. 입력창 포커스는 반드시 동기적으로 준다(`setTimeout` 사용 시 첫 글자가 유실된다). 정확 일치일 때만 발동하고, 입력한 값이 더 긴 정답의 앞부분이면(`Mexico`→`Mexico City` 등 11건) 즉시 채점하지 않고 300ms 입력 멈춤을 기다린다. 한 필드가 맞고 다른 필드가 비어 있으면 포커스를 옮긴다.
- 수도 표기 변형은 `CAPITAL_ALIASES`에 추가한다. 국가 약칭(USA/UK/UAE/DRC/CAR)은 `aliases`에 둔다.
- 입력은 한글 자판으로 쳐도 QWERTY 문자로 변환된다(`hangulToQwerty`).

## 하지 말 것

- `confirm()` / `alert()` / `prompt()` (브라우저의 설치 프롬프트만 예외)
- 파일 분리, 번들러·프레임워크 도입, `node_modules`를 저장소에 추가
- 외부 CDN 의존 추가 (오프라인 동작이 깨진다)
- `COUNTRIES` 데이터를 손으로 편집 (Node 스크립트로 파싱→수정→직렬화)
- 검증 없이 "고쳤다"고 보고
