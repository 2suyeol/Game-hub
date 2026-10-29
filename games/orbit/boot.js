try{
  const {OrbitView}=await import('./game-view-3d.js');
  window.OrbitView=OrbitView;
  await import('./hub-display.js');
}catch(error){
  document.getElementById('rendererError').hidden=false;
  document.getElementById('rendererMessage').textContent='3D 화면을 시작하지 못했습니다. 인터넷 연결을 확인하고 새로고침해주세요. 이 컴퓨터는 WebGL 2 그래픽 지원이 필요합니다.';
  document.getElementById('gameCard').hidden=true;
  console.error('3D initialization failed:',error);
  if(window.Hub)Hub.ready();
}
