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

## 데이터 모델 (localStorage, schema 2)

| 키 | 내용 |
|---|---|
| `geoQuizSchema` | `"2"` — `migrateStorage()`가 v1 키를 흡수 |
| `geoQuizSettings` | `{regions:{flag,map,capital}, autoMode, answerMode, capitalDirection, name, createdAt}` |
| `geoQuizStats` | 누적 집계 + `byMode[모드].seenByCode/correctByCode` + `missedByMode[모드]` |
| `geoQuizHistory` | 종료된 세션 기록(최대 500건) |
| `geoQuizSessionsV2` | 진행 중 세션. **기기 로컬 전용, 동기화 대상 아님** |
| `geoQuizInstall` | 홈 화면 추가 배너 상태 `{dismissedAt, installed}` |

향후 계정 동기화 시 올릴 단위는 settings + stats + history. 세션 키는 `모드:지역`(예: `flag:Asia`), 연습은 `flag:Mistakes`.

## 규칙·관례

- **모드 3종** flag / map / capital. 지역 설정은 **모드별로 따로** 저장된다(공유하지 않음).
- **타이머**: All 20분, 개별 지역 10분, 연습(Mistakes)은 무제한(`Practice` 표시).
- **색**: `--flag` 라벤더 / `--map` 카키 / `--capital` 탄 / `--settings` 로즈. 결과색은 `--good/--warn/--bad`. 새 색을 쓰지 말고 토큰을 쓴다. 활성 탭 색은 `--accent`로 자동 전환된다.
- **힌트로 맞힌 답은 오답 집계**(노란 체크는 그대로).
- **글래스 화면**(Ready / Paused / Finished / Session ended)은 모두 Ready 패널 기준 높이로 상단 정렬된다(`lockReadyPanelOffset`). 전환 애니메이션은 **문제 화면 ↔ 글래스 화면**에만 넣고 글래스 → 글래스는 즉시 전환한다.
- 애니메이션은 `prefers-reduced-motion`에서 꺼져야 한다.
- 시트 메뉴는 **press-drag-release**(누른 채 끌면 하이라이트가 손가락을 따라가고, 항목 밖에서 떼면 취소)로 동작한다. 포인터 이벤트 + `setPointerCapture`를 쓰고 `touch-action:none`이 필요하다.
- 지도 데이터는 Natural Earth(110m 기본, 작은 섬나라는 10m). 새 국가를 추가하면 같은 소스에서 외곽선을 가져오고 좌표는 소수점 4자리로 줄인다.
- 정답 판정은 `norm()`으로 악센트·기호를 제거해 비교한다. 수도 표기 변형은 `CAPITAL_ALIASES`에 추가한다.
- 입력은 한글 자판으로 쳐도 QWERTY 문자로 변환된다(`hangulToQwerty`).

## 하지 말 것

- 파일 분리, 번들러·프레임워크 도입, `node_modules`를 저장소에 추가
- 외부 CDN 의존 추가 (오프라인 동작이 깨진다)
- `COUNTRIES` 데이터를 손으로 편집 (Node 스크립트로 파싱→수정→직렬화)
- 검증 없이 "고쳤다"고 보고
