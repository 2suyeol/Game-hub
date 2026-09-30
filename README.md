# 동아리 게임 센터

노트북 화면에 게임 아이콘이 뜨고, 폰을 컨트롤러로 연결해서 게임을 골라 하는 통합 사이트입니다.

## 파일 구성

```
game-hub/
├── index.html        노트북 화면 (홈 화면 + 게임 실행). 폰 연결을 계속 유지합니다
├── controller.html   폰 화면 (QR로 접속)
├── config.js         제목, 조준 감도, 연결 서버 설정
├── games.json        게임 목록. 여기에 추가하면 아이콘이 생깁니다
├── hub-sdk.js        모든 게임이 불러오는 공용 스크립트
└── games/
    ├── fruit/        과일 자르기 자리 (지금은 연결 테스트 화면)
    ├── rhythm/       리듬 게임 자리 (지금은 카메라 테스트 화면)
    └── _template/    새 게임 만들 때 복사해서 쓰는 틀
```

## 실행하기

폰이 노트북 화면에 접속하려면 사이트가 인터넷 주소(HTTPS)에 올라가 있어야 합니다. GitHub Pages가 가장 간단합니다.

1. GitHub에 저장소를 만들고 `game-hub` 폴더 안의 파일을 전부 올립니다.
2. 저장소의 Settings > Pages에서 main 브랜치를 선택하고 저장합니다.
3. 몇 분 뒤 `https://아이디.github.io/저장소이름/` 주소를 노트북 크롬에서 엽니다.
4. 화면의 QR을 폰으로 찍으면 컨트롤러가 연결됩니다.

노트북에서만 화면을 확인하고 싶을 때는 폴더에서 `python -m http.server 8080`을 실행하고 `http://localhost:8080`을 엽니다. 이때는 폰이 접속할 수 없으니 `config.js`의 `controllerURL`에 GitHub Pages의 controller.html 주소를 넣으세요.

## 부스에서 띄우기

주소창 없이 전체화면으로 띄우고, 폰으로 게임을 켜도 소리가 바로 나게 하려면 크롬을 이렇게 실행합니다.

Windows (명령 프롬프트):
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --autoplay-policy=no-user-gesture-required --user-data-dir=%TEMP%\gamehub https://아이디.github.io/저장소이름/
```

Mac (터미널):
```
open -na "Google Chrome" --args --kiosk --autoplay-policy=no-user-gesture-required --user-data-dir=/tmp/gamehub https://아이디.github.io/저장소이름/
```

처음 한 번은 카메라 권한 팝업이 뜹니다. 허용하면 그 뒤로는 묻지 않습니다. 키오스크 모드를 끝내려면 Alt+F4 (Mac은 Cmd+Q).

## 조작

폰의 방향 버튼으로 게임을 고르고 A로 시작합니다. 게임 중에 B를 길게 누르면 홈으로 돌아옵니다. 컨트롤러 게임은 90초 동안 입력이 없으면 자동으로 홈으로 돌아갑니다.

진행자는 노트북 키보드의 방향키와 Enter로 고르고, Esc로 홈에 돌아올 수 있습니다.

## 게임 추가하기

1. `games/_template` 폴더를 복사해서 `games/새게임이름`으로 만듭니다.
2. 게임 파일을 그 폴더에 넣고, `index.html`에 `<script src="../../hub-sdk.js"></script>`를 넣습니다.
3. `games.json`에 한 줄 추가합니다.

```json
{
  "id": "snake",
  "title": "스네이크",
  "desc": "짧은 설명 한 줄",
  "path": "games/snake/index.html",
  "input": "controller",
  "mode": "sdk",
  "pad": "dpad",
  "emoji": "🐍",
  "color": "#6FD6C1",
  "padHint": "방향 버튼으로 움직이세요"
}
```

| 항목 | 값 |
|---|---|
| `input` | `controller` (폰으로 조작) 또는 `camera` (카메라로 조작) |
| `mode` | `sdk` (hub-sdk.js로 입력을 받는 게임) 또는 `compat` (마우스·키보드 게임을 그대로 넣을 때) |
| `pad` | 폰 화면 모양. `motion` (조준+A/B), `dpad` (방향키+A/B), `camera` (A/B만) |
| `icon` | 아이콘 이미지 경로 (선택). 없으면 `emoji`와 `color`로 그려집니다 |
| `map` | `compat` 게임에서 폰 버튼을 어떤 키로 바꿀지. 예: `{"A": "Space", "B": "Escape"}`. `"click"`은 마우스 클릭 |

## 게임에서 쓰는 SDK

```js
Hub.on('pointer', ({x, y, speed}) => {})  // 폰 조준 위치 0~1, 휘두르기 속도
Hub.on('button', ({key, down}) => {})     // 'A' 'B' 'UP' 'DOWN' 'LEFT' 'RIGHT'
Hub.on('exit', () => {})                  // 홈으로 나가기 직전

Hub.on('calibrate', ({a, b}) => {})       // 폰에서 조준 맞추기를 눌렀을 때
Hub.on('motion', ({a, b, g, rtt}) => {})  // 폰 기울기 원본 값과 지연(ms). 조준을 직접 계산하는 게임용
Hub.on('controller', ({connected}) => {}) // 폰 연결이 끊기거나 다시 붙었을 때
Hub.on('form', ({values}) => {})          // 폰 입력칸에서 보낸 값
Hub.on('formSkip', () => {})

Hub.ready()                // 로딩이 끝나면 호출
Hub.submitScore({name, score})
Hub.exit()                 // 게임이 스스로 홈으로 돌아갈 때

// 폰 화면 바꾸기
Hub.setPad('motion', { title: '과일 자르기', hint: 'A를 누르면 시작합니다.' })
Hub.setPad('form', {
  title: '기록을 남기시겠어요?', big: '2,480',
  fields: [{ id: 'sid', label: '학번', inputmode: 'numeric' }, { id: 'name', label: '이름' }],
  submit: '순위표에 올리기', skip: '기록 없이 넘어가기'
})
```

게임 파일을 게임 센터 밖에서 그냥 열면 개발 모드로 동작합니다. 마우스가 조준, 클릭·Z·스페이스가 A, X·Esc가 B입니다. 폰 없이도 개발과 테스트를 할 수 있습니다.

## 게임 만들 때 약속

- 파일 경로는 상대경로로 씁니다 (`./img/apple.png`)
- 화면은 창 크기에 맞춰 늘어나게 만듭니다
- `alert()`, `prompt()`는 쓰지 않습니다
- 홈으로 나가는 기능은 게임에 따로 만들지 않습니다 (B 길게 누르기로 통일)
