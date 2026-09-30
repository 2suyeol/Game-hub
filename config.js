// 통합 사이트 설정. 여기 값만 바꾸면 됩니다.
window.HUB_CONFIG = {
  title: '동아리 게임 센터',

  // 폰과 화면을 이어주는 방 이름 앞부분. 다른 팀과 겹치지 않게 바꿔도 됩니다.
  peerPrefix: 'club-hub-',

  // 폰이 접속할 컨트롤러 주소. 비워두면 이 사이트의 controller.html을 씁니다.
  // 노트북에서 localhost로 열 때는 폰이 접속할 수 없으니 GitHub Pages 주소를 넣으세요.
  // 예: 'https://아이디.github.io/game-hub/controller.html'
  controllerURL: '',

  // 서로 다른 네트워크(유선 PC ↔ 폰 LTE)에서도 연결되게 하는 서버 목록 (과일 자르기에서 쓰던 설정)
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],

  // 폰 조준 감도: 좌우/상하로 몇 도 돌리면 화면 끝까지 가는지
  aim: { yawDeg: 40, pitchDeg: 26, smooth: 0.6 },

  holdToExitMs: 1200,   // B를 이만큼 누르고 있으면 홈으로
  idleSeconds: 90,      // 컨트롤러 게임에서 입력이 없으면 홈으로 (카메라 게임은 제외)
  readyTimeoutMs: 20000 // 게임이 준비 신호를 안 보내도 이 시간이 지나면 로딩 화면을 걷음 (카메라 모델 로딩 고려)
};
