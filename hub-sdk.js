/*
 * hub-sdk.js — 게임 센터에 들어가는 게임이 불러오는 공용 스크립트
 *
 *   <script src="../../hub-sdk.js"></script>
 *
 *   Hub.on('pointer', ({x, y, speed}) => {})   // 폰 조준 위치 (0~1), 휘두르는 속도 (화면 비율/초)
 *   Hub.on('button',  ({key, down}) => {})     // key: 'A' 'B' 'UP' 'DOWN' 'LEFT' 'RIGHT'
 *   Hub.on('motion',  ({a, b, g}) => {})       // 폰 기울기 원본 값 (도)
 *   Hub.on('exit',    () => {})                // 홈으로 나가기 직전
 *   Hub.on('calibrate', ({a, b}) => {})        // 폰에서 조준 맞추기를 눌렀을 때의 기울기
 *   Hub.on('controller', ({connected}) => {})  // 폰 연결이 끊기거나 다시 붙었을 때
 *   Hub.on('hello', ({connected}) => {})       // 게임이 열린 직후, 폰 연결 여부
 *   Hub.on('form', ({values}) => {})           // 폰 입력칸에 적어 보낸 값 {id: 값}
 *   Hub.on('formSkip', () => {})               // 폰에서 입력 없이 넘어가기
 *
 *   Hub.ready()                 // 로딩이 끝나면 꼭 호출 (로딩 화면이 걷힘)
 *   Hub.exit()                  // 게임이 스스로 홈으로 돌아갈 때
 *   Hub.submitScore({name, score})
 *   Hub.activity()              // 카메라 게임 등에서 "아직 누가 하고 있음"을 알림
 *   Hub.setPad('dpad', '안내 문구')   // 게임 도중 폰 화면 바꾸기: home | dpad | motion | camera | form
 *   Hub.setPad('motion', { title, hint })
 *   Hub.setPad('form', { title, hint, big, fields:[{id, label, inputmode, maxlength}], submit, skip })
 *
 * 게임 센터 밖에서 파일을 그냥 열면 개발 모드로 동작합니다.
 *   마우스 = 조준, 클릭·Z·스페이스 = A, X·Esc = B, 방향키 = 방향
 */
(function(){
  const inHub = window.parent !== window;
  const listeners = {};
  const streams = [];

  function emit(type, data){
    (listeners[type] || []).forEach(fn => { try{ fn(data); }catch(e){ console.error('[Hub]', e); } });
  }
  function send(m){
    if (inHub) window.parent.postMessage(Object.assign({ hub: 1 }, m), '*');
  }

  const Hub = {
    inHub,
    on(type, fn){ (listeners[type] = listeners[type] || []).push(fn); return Hub; },
    off(type, fn){ listeners[type] = (listeners[type] || []).filter(f => f !== fn); return Hub; },
    ready(){ send({ type: 'ready' }); },
    exit(){ inHub ? send({ type: 'exit' }) : console.info('[Hub] 홈으로 나가기 (개발 모드에서는 무시)'); },
    submitScore(data){ send({ type: 'score', data }); },
    activity(){ send({ type: 'activity' }); },
    setPad(pad, opts){
      if (typeof opts === 'string') opts = { hint: opts };
      send(Object.assign({}, opts || {}, { type: 'pad', pad }));
    }
  };

  window.addEventListener('message', e => {
    if (e.source !== window.parent) return;
    const d = e.data;
    if (!d || d.hub !== 1) return;
    if (d.type === 'exit') stopCameras();
    emit(d.type, d);
  });

  // 게임이 켠 카메라를 기억했다가 나갈 때 자동으로 끔 (다음 카메라 게임이 정상적으로 켜지도록)
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(c){
      const s = await orig(c);
      streams.push(s);
      return s;
    };
  }
  function stopCameras(){
    streams.forEach(s => s.getTracks().forEach(t => t.stop()));
    streams.length = 0;
  }
  window.addEventListener('pagehide', stopCameras);

  // 개발 모드: 폰 없이 마우스와 키보드로 테스트
  if (!inHub){
    let last = null;
    addEventListener('mousemove', e => {
      const x = e.clientX / innerWidth, y = e.clientY / innerHeight, t = performance.now();
      let speed = 0;
      if (last){ const dt = (t - last.t) / 1000; if (dt > 0) speed = Math.hypot(x - last.x, y - last.y) / dt; }
      last = { x, y, t };
      emit('pointer', { x, y, speed });
    });
    addEventListener('mousedown', () => emit('button', { key: 'A', down: true }));
    addEventListener('mouseup', () => emit('button', { key: 'A', down: false }));
    const KEYS = { KeyZ: 'A', Space: 'A', Enter: 'A', KeyX: 'B', Escape: 'B',
                   ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
    addEventListener('keydown', e => { const k = KEYS[e.code]; if (k && !e.repeat) emit('button', { key: k, down: true }); });
    addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) emit('button', { key: k, down: false }); });
    console.info('[Hub] 개발 모드: 마우스 = 조준, 클릭·Z·스페이스 = A, X·Esc = B, 방향키 = 방향');
  }

  window.Hub = Hub;
})();
