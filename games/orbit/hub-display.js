"use strict";
/* 게임 센터용 화면 스크립트 (원래 display.js에서 서버·QR 연결 부분을 게임 센터 입력으로 바꿈)
   조준: 게임 센터가 보내는 폰 기울기 원본 값을 원래 motion.js의 행렬 계산으로 변환
   발사: 폰 A 버튼 / 일시정지: 폰 B 짧게 / 홈: B 길게 (게임 센터가 처리) */
const $=id=>document.getElementById(id);
const game=new OrbitGame();
const view=new OrbitView($("gameCanvas"));
const aimSmoother=new PhoneInput.AimSmoother(),timing=PhoneInput.timing;
let shown=null,target=null,stopped=false,manualPaused=false,lastFrame=0,active=false,autoFire=true;
// 입력 상태
let reference=null,sample=null,sampleAt=-1e9,pointerAt=-1e9,connected=true;
let firing=false,fireCount=0,controllerVersion=1,lastPhase="",recorded=true;

function useSample(o){
  sample={alpha:o.a,beta:o.b,gamma:o.g};sampleAt=performance.now();
  if(!reference)reference=PhoneMotion.matrix(sample);      // 처음 들어온 방향을 화면 가운데로
  const p=PhoneMotion.aim(reference,sample);
  if(p){target={x:p.x,y:p.y};aimSmoother.push(target);}
}
Hub.on("motion",o=>{if(PhoneMotion.valid({alpha:o.a,beta:o.b,gamma:o.g}))useSample(o);});
Hub.on("calibrate",()=>{if(sample){reference=PhoneMotion.matrix(sample);aimSmoother.clear();target={x:.5,y:.5};aimSmoother.push(target);}});
// 개발 모드(게임 센터 밖)에서는 마우스가 조준
Hub.on("pointer",p=>{if(performance.now()-sampleAt<timing.inputGrace)return;pointerAt=performance.now();target={x:p.x,y:p.y};aimSmoother.push(target);});
Hub.on("button",b=>{
  if(b.key==="A"){
    if(b.down&&!firing){firing=true;fireCount++;}
    else if(!b.down)firing=false;
  }else if(b.key==="B"&&b.down&&["playing","countdown","paused"].includes(game.phase)){
    manualPaused=!manualPaused;
  }
});
Hub.on("controller",d=>{connected=d.connected;firing=false;if(d.connected)controllerVersion++;});
Hub.on("form",d=>{
  if(game.phase!=="over"||recorded)return;
  Hub.submitScore({name:(d.values.name||"").trim()||"익명",score:game.score,kills:game.kills,clear:game.reason==="time"});
  recorded=true;updatePad(true);
});
Hub.on("formSkip",()=>{recorded=true;updatePad(true);});
Hub.on("exit",()=>{stopped=true;try{view.dispose();}catch{}});

function updatePad(force){
  const key=game.phase+"|"+recorded+"|"+manualPaused;
  if(key===lastPhase&&!force)return;lastPhase=key;
  if(game.phase==="over"&&!recorded){
    Hub.setPad("form",{title:game.reason==="time"?"방어 성공! 기록을 남기시겠어요?":"기록을 남기시겠어요?",big:game.score.toLocaleString("ko-KR"),
      hint:`격추 ${game.kills}대, 명중률 ${game.shots?Math.round(game.hits/game.shots*100):0}%, 최고 연속 ${game.bestCombo}`,
      fields:[{id:"name",label:"학번 이름",maxlength:10}],submit:"기록 등록",skip:"등록 없이 넘어가기"});
  }else if(game.phase==="playing"||game.phase==="countdown"){
    Hub.setPad("motion",{title:"방어 중",hint:"손목을 움직여 적을 겨누세요. 겨누면 자동 발사, A를 누르고 있으면 연사합니다. B는 일시정지."});
  }else if(game.phase==="paused"){
    Hub.setPad("motion",{title:"일시정지",hint:"B를 누르면 이어서 진행합니다."});
  }else{
    Hub.setPad("motion",{title:"오빗 디펜스",hint:"폰 위쪽 끝을 화면 가운데로 향하고 조준 맞추기를 누른 뒤, A로 출격하세요."});
  }
}

function gameUi(){
  $("scoreValue").textContent=String(game.score).padStart(5,"0");
  $("timeValue").textContent=String(Math.ceil(game.time)).padStart(2,"0");
  $("livesValue").textContent="●".repeat(game.lives)+"○".repeat(5-game.lives);
  $("livesValue").setAttribute("aria-label","방어력 "+game.lives);
  $("pauseGame").disabled=!["playing","countdown","paused"].includes(game.phase);
  $("pauseGame").textContent=manualPaused?"계속하기":"일시정지";
  $("comboLabel").hidden=game.combo<3||game.phase!=="playing";
  $("comboLabel").textContent=game.combo+" CHAIN · ×"+Math.min(4,1+Math.floor(game.combo/5));
  $("countdown").hidden=game.phase!=="countdown";
  if(game.phase==="countdown")$("countdown").textContent=Math.max(1,Math.ceil(game.countdown));
  $("gameCard").hidden=["playing","countdown"].includes(game.phase);
  $("resultStats").hidden=game.phase!=="over";
  $("startGame").disabled=!active;
  if(game.phase==="ready"){
    $("gameEyebrow").textContent="IMMERSIVE 3D / FORWARD DEFENSE";$("gameTitle").textContent="전방을 지켜라.";
    $("gameHelp").textContent="태양계를 순항하는 함대를 지켜주세요. 60초 동안 전방의 적을 격추하고, 적이 기체에 닿기 전에 막으세요.";
    $("startGame").textContent=active?"출격 · 60초":"폰을 움직여 조준을 시작하세요";
    $("gameTip").textContent="폰에서 조준 맞추기를 누른 뒤 A로 출격 · 적을 겨누면 자동으로 발사합니다.";
  }else if(game.phase==="paused"){
    $("gameEyebrow").textContent="MISSION PAUSED";$("gameTitle").textContent="잠시 대기.";
    $("gameHelp").textContent=game.pauseReason;
    $("startGame").textContent=active?"계속하기":"폰 조준을 기다리는 중";
    $("gameTip").textContent="시간과 적의 움직임은 멈춰 있습니다.";
  }else if(game.phase==="over"){
    $("gameEyebrow").textContent=game.reason==="time"?"MISSION COMPLETE":"BASE SIGNAL LOST";
    $("gameTitle").textContent=game.reason==="time"?"방어 성공!":"다시 도전!";
    $("gameHelp").textContent=recorded?"폰에서 A를 누르면 다시 출격합니다.":"폰에서 이름을 적어 기록을 남겨주세요.";
    $("finalScore").textContent=game.score.toLocaleString("ko-KR");$("finalKills").textContent=game.kills;
    $("finalAccuracy").textContent=(game.shots?Math.round(game.hits/game.shots*100):0)+"%";$("finalCombo").textContent=game.bestCombo;
    $("startGame").textContent="다시 출격";
    $("gameTip").textContent="폰의 A를 뗐다가 다시 누르면 재시작합니다.";
  }
}

function animate(now){
  if(stopped)return;
  const dt=lastFrame?Math.min(.1,(now-lastFrame)/1000):0;lastFrame=now;
  const inputAge=Math.min(now-sampleAt,now-pointerAt);
  active=!!(connected&&target&&inputAge<timing.inputGrace&&!document.hidden);
  if(!active){shown=null;}
  else shown=aimSmoother.step(dt);
  if(shown){
    $("aim").style.left=(Math.max(.02,Math.min(.98,shown.x))*100)+"%";
    $("aim").style.top=(Math.max(.04,Math.min(.96,shown.y))*100)+"%";
    $("aim").classList.toggle("is-outside",!SpaceMath.validPoint(shown));
    $("xValue").textContent=(shown.x*100).toFixed(1);$("yValue").textContent=(shown.y*100).toFixed(1);
    $("statusText").textContent=shown.x<0||shown.x>1||shown.y<0||shown.y>1?"화면 밖을 향하고 있습니다 · 폰에서 조준 맞추기를 눌러보세요":autoFire?"3D 조준 연결됨 · 적을 겨누면 자동 사격 · A로도 발사":"3D 조준 연결됨 · A를 길게 눌러 연사";
  }else{
    $("xValue").textContent="—";$("yValue").textContent="—";
    $("statusText").textContent=connected?"폰을 움직이면 조준이 시작됩니다":"폰 연결이 끊겼습니다 · 다시 연결하면 이어집니다";
  }
  // 게임 센터 밖(개발 모드)에서 쓰던 일시정지 상태가 남지 않게, 게임이 끝나면 해제
  if(!["playing","countdown","paused"].includes(game.phase))manualPaused=false;
  const blocked=manualPaused||document.hidden||view.available===false;
  const isFiring=active&&firing&&inputAge<timing.fireGrace+200;
  const freshAim=active&&inputAge<timing.fireGrace;
  $("aim").hidden=!active;
  const rect=$("gameCanvas").getBoundingClientRect();
  const before=game.phase;
  // 기록 입력 중에는 A로 재시작되지 않도록 발사 입력을 막음
  const holdForForm=game.phase==="over"&&!recorded;
  const events=game.tick(dt,{active,point:shown,firing:holdForForm?false:isFiring,freshAim,autoFire,fireCount:holdForForm?game.lastFireCount:fireCount,controllerVersion,aspect:rect.width/rect.height,blocked,
    blockReason:view.available===false?"3D 그래픽 연결을 복구하는 중입니다.":manualPaused?"폰에서 B를 누르면 이어서 진행합니다.":"폰 조준을 기다리는 중입니다. 폰을 움직이면 자동으로 이어집니다."});
  if(before!=="over"&&game.phase==="over")recorded=false;   // 새로 끝난 판
  if(game.phase==="countdown"&&before!=="countdown"&&before!=="paused")view.clearEffects();
  view.accept(events);
  const locked=active&&!blocked&&game.phase==="playing"?game.target(shown,rect.width/rect.height):null;
  $("aim").classList.toggle("is-locked",!!locked);
  $("aim").classList.toggle("is-firing",events.some(e=>e.type==="shot"));
  $("targetReadout").textContent=locked?"TARGET LOCK":game.phase==="playing"?"전방 목표 "+game.enemies.length+"대":"전방 스캔 중";
  $("rangeReadout").textContent=locked?"거리 "+Math.round(locked.distance)+" m · "+(autoFire?"자동 사격":"수동 사격"):"함대 전진 · 반시계 순항";
  $("rendererError").hidden=view.available!==false;
  view.draw(game,document.hidden?0:dt,shown);
  if(view.navigation){
    const nav=view.navigation;
    for(const planet of nav.map){const dot=$("map-"+planet.id);dot.setAttribute("cx",planet.x);dot.setAttribute("cy",planet.y);}
    $("fleetMapMarker").setAttribute("transform","rotate("+(-nav.angle*180/Math.PI)+" 64 64)");
    $("voyageProgress").textContent=view.reduceMotion?"동작 줄이기 · 항로 정지":game.phase==="paused"?"일시정지 · 항로 대기":"항로 진행 "+Math.floor(nav.progress*100)+"%";
  }
  if(game.phase==="playing")Hub.activity();
  gameUi();updatePad(false);requestAnimationFrame(animate);
}
function startOrResume(){
  if(!active)return;
  if(game.phase==="paused"){manualPaused=false;return;}
  manualPaused=false;view.clearEffects();game.start();
}
$("startGame").addEventListener("click",startOrResume);
$("autoFire").addEventListener("click",()=>{autoFire=!autoFire;$("autoFire").textContent=autoFire?"자동 사격 켜짐":"수동 사격";$("autoFire").setAttribute("aria-pressed",String(autoFire));});
$("pauseGame").addEventListener("click",()=>{manualPaused=!manualPaused;});
$("soundButton").addEventListener("click",()=>{try{const sound=view.toggleSound();$("soundButton").textContent=sound?"소리 끄기":"소리 켜기";$("soundButton").setAttribute("aria-pressed",String(sound));}catch{$("statusText").textContent="이 브라우저에서 소리를 켤 수 없습니다";}});
document.addEventListener("visibilitychange",()=>{lastFrame=0;if(document.hidden)firing=false;});
window.addEventListener("pagehide",()=>{stopped=true;try{view.dispose();}catch{}});
requestAnimationFrame(animate);
Hub.ready();
// 점검용 (개발자 도구에서 window.orbit 으로 상태 확인)
window.orbit={game,get aim(){return shown;}};
