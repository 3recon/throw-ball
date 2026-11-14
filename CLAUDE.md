# 패배 분풀이 야구 (웹 3D 게임)

응원팀이 진 날, 투수가 되어 상대가 아닌 "우리 팀" 가상 선수들에게 공을 던져 분풀이하는 웹 게임.
선수들은 공을 피하거나(옆으로 몸 날리기·숙이기) 맞고 넘어진다. 축구 모드는 이후 구상.

## 현재 상태
- 스택: **Vite + React 19 + TypeScript**, Three.js 0.160 (npm) + OutlineEffect. 폰트 Black Han Sans(@fontsource).
- 실행: `npm install` → `npm run dev` (http://localhost:5173). 배포용 `npm run build` → `dist/` 정적 파일. 타입 체크 `npm run typecheck`.
- 이전 단일 파일 버전은 `legacy/index.single.html`에 참고용으로 보관 (더 이상 수정하지 않음).
- 렌더링: MeshToonMaterial(3단 그라디언트) + 외곽선 → 플랫 일러스트 느낌.
- 시점: 투수 뒤 3인칭 (`CAM_PLAY`). 홈플레이트 z = -14 (실제보다 축소). 메뉴 화면은 `CAM_HOME`/`CAM_SELECT` + 패널을 피하는 `setViewOffset` 이동.

## 구조
- **React (화면)** `src/App.tsx`가 화면 상태(home → select → won | play → result)를 관리.
  - `screens/HomeScreen` 메인(프론트) 화면: 히어로, 던질 아이템, 플레이 방법, 최고 기록·바로 던지기.
  - `screens/TeamSelectScreen` 팀 선택 + 졌다/이겼다, `WonScreen`, `ResultScreen`(공유·최고 기록).
  - `components/GameStage` 엔진을 한 번만 생성해 전체화면 배경으로 유지, `components/Hud`는 `useSyncExternalStore(game.subscribe, game.getSnapshot)`.
  - `lib/storage.ts` 최고 점수·플레이 횟수·마지막 팀 (localStorage, try/catch).
  - `data/teams.ts` 팀 목록(id·이름·색).
- **엔진** `src/game/Game.ts` (`Game` 클래스): React와는 `setTeam(color)`, `setView(view)`, `start()`, `abort()`, `onEnd`, `subscribe/getSnapshot`으로만 통신.
  - 메뉴 화면(view ≠ play)에서는 투수가 자동으로 데모 투구 (`updateDemo`, 점수 미반영 `scoring: false`).
  - 말풍선·"퍽!"·콤보·조준점은 엔진이 소유한 DOM 레이어(`fx-*` 클래스, `effects.ts`)에 그림.
- **캐릭터** `game/character.ts` `makeCharacter()`: 뼈대(Group) 계층 — hips → spine → chest → neck → head, chest → ua(어깨) → el(팔꿈치) → ha(손), hips → th(엉덩이) → kn(무릎) → an(발목). L = 캐릭터 왼쪽(+x), R = 오른쪽(-x). 몸통·팔다리는 Capsule 메쉬.
- **애니메이션** `game/animation.ts` `CLIPS` + `Animator`: 키프레임 포즈(관절별 오일러 [x,y,z] + hp=골반 위치 오프셋), Catmull-Rom 보간, 클립 간 크로스페이드, `mirror()`로 좌우 반전.
  - 각도 규칙: th.x 음수 = 다리 앞으로, kn.x 양수 = 무릎 굽힘, ua.x 음수 = 팔 앞으로, el.x 음수 = 팔꿈치 굽힘, spine.x 양수 = 앞으로 숙임, uaL.z 양수/uaR.z 음수 = 팔 옆으로 벌림.
  - 클립: idle, walk, dodge, duck, panic, knockdown, getup, bow(사과), plead(살려주세요), p_idle/windup/pitch(투수).
- **선수 상태머신** `Game.updatePlayer()`: idle/taunt → (공 궤적 예측 `scanBalls`) → react → dodge|duck|panic, 명중 시 down → getup.
  - 회피 확률은 공 속도에 반비례 (`chance`). 피격 판정 = 발~머리 선분과 공 거리.
- **투구**: 누르는 동안 windup + 파워 게이지(왕복), 떼면 pitch 클립 → 0.19초에 손 위치에서 발사, 조준점까지 중력 보정 궤적. 아이템(`game/items.ts`: 공·배트·치킨·맥주병)은 매 투구 랜덤.
- **경기장** `game/stadium.ts`: `buildField`(고정 배경), `Stands`(팀 색 관중석, 들썩임), `Scoreboard`(캔버스 전광판).
- **연출**: 명중 시 슬로모션, "퍽!", 먼지 스프라이트, 화면 흔들림, 관중 들썩임, 전광판 갱신.
- 개발 모드에서는 `window.__game`으로 엔진 인스턴스 접근 가능 (디버깅용).

## 결정된 방향 / 제약
- 웹 서비스로 동작해야 함 (노트북 브라우저 기준, 내장 그래픽에서도 부드럽게).
- 실제 KBO 구단명·로고·엠블럼·유니폼 디자인·마스코트, 실제 선수 이름·얼굴은 사용하지 않음 → 가상 선수(등번호만).
- 캐릭터 품질: 현재는 코드로 만든 관절 캐릭터(2번 방식). 최종은 Mixamo 리깅 모델 + 모션캡처(.glb, AnimationMixer)로 교체 검토.

## 다음 할 일
1. KBO 구단을 대체하는 가상 팀 프리셋 (팀 이름·유니폼 색) + 팀별 홈구장 분위기 배경.
2. (선택) Mixamo 캐릭터/동작으로 교체: 대기, 걷기, 회피, 숙이기, 피격, 넘어짐, 일어나기, 투구.
3. 축구 모드 (같은 구조에서 던지기 → 차기).
4. 패배 자동 판정 (경기 결과 API) — 현재는 "졌다/이겼다" 버튼.
