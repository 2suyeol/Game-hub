/* Deterministic, DOM-free game rules. Aim coordinates remain identical to the motion prototype. */
(function(root){
  'use strict';
  const space=typeof module!=='undefined'&&module.exports?require('./space-math'):root.SpaceMath;
  class OrbitGame {
    constructor(random=Math.random){this.random=random;this.reset();}
    reset(){
      this.phase='ready';this.time=60;this.score=0;this.lives=5;this.kills=0;this.shots=0;this.hits=0;
      this.combo=0;this.bestCombo=0;this.enemies=[];this.events=[];this.spawnIn=.25;this.cooldown=0;
      this.countdown=3;this.lastFireCount=0;this.lastFiring=false;this.controllerVersion=-1;this.nextId=1;
    }
    start(){
      const version=this.controllerVersion,count=this.lastFireCount,firing=this.lastFiring;
      this.reset();this.phase='countdown';this.controllerVersion=version;this.lastFireCount=count;this.lastFiring=firing;
    }
    finish(reason){this.phase='over';this.reason=reason;this.events.push({type:'over',reason});}
    spawn(aspect=16/9){
      const progress=1-this.time/60,roll=this.random();
      const type=roll<.22&&progress>.12?'guard':roll>.74?'scout':'fighter';
      const x=.2+this.random()*.6,depth=95+this.random()*20;
      const origin=space.worldAt({x,y:.23+this.random()*.18},depth,aspect);
      const destination=space.worldAt({x:.5+(x-.5)*.8,y:.58+this.random()*.12},space.IMPACT_DEPTH,aspect);
      this.enemies.push({id:this.nextId++,type,position:{...origin},origin,destination,depth,startDepth:depth,age:0,seed:this.random()*Math.PI*2,
        radius:type==='guard'?2.5:type==='scout'?1.6:2.1,hp:type==='guard'?2:1,maxHp:type==='guard'?2:1,
        speed:(type==='scout'?10.5:type==='guard'?7:8.5)*(1+progress*.4),points:type==='guard'?200:type==='scout'?150:100});
    }
    target(point,aspect){return space.nearest(this.enemies,point,aspect);}
    shoot(point,aspect){
      if(!space.validPoint(point)) return;
      const intersection=this.target(point,aspect),hit=intersection?.enemy;
      this.shots++;this.events.push({type:'shot',position:intersection?.position||space.worldAt(point,100,aspect)});
      if(!hit){this.combo=0;return;}
      this.hits++;hit.hp--;
      if(hit.hp>0){this.events.push({type:'hit',position:{...hit.position},radius:hit.radius});return;}
      this.enemies=this.enemies.filter(e=>e.id!==hit.id);this.kills++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);
      const multiplier=Math.min(4,1+Math.floor(this.combo/5)),points=hit.points*multiplier;
      this.score+=points;this.events.push({type:'kill',position:{...hit.position},radius:hit.radius,points,enemy:hit.type});
    }
    tick(delta,input={}){
      this.events=[];
      const dt=Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0));
      const active=!!input.active,blocked=!!input.blocked;
      if(input.controllerVersion!==this.controllerVersion){this.controllerVersion=input.controllerVersion;this.lastFireCount=0;this.lastFiring=false;}
      const count=Number.isSafeInteger(input.fireCount)?input.fireCount:0;
      const pressed=active&&(count>this.lastFireCount||(input.firing&&!this.lastFiring));
      this.lastFireCount=count;this.lastFiring=!!input.firing;
      if((this.phase==='ready'||this.phase==='over')&&pressed&&!blocked) this.start();
      if(['playing','countdown'].includes(this.phase)&&(!active||blocked)){
        this.phase='paused';this.pauseReason=input.blockReason||'휴대폰 연결을 확인해주세요';this.events.push({type:'pause'});
      }
      if(this.phase==='paused'&&active&&!blocked){this.phase='countdown';this.countdown=2;}
      if(this.phase==='countdown'){
        this.countdown-=dt;
        if(this.countdown<=0){this.phase='playing';this.events.push({type:'launch'});}
        return this.events;
      }
      if(this.phase!=='playing') return this.events;
      this.time=Math.max(0,this.time-dt);
      if(this.time<=0){this.finish('time');return this.events;}
      this.spawnIn-=dt;this.cooldown=Math.max(0,this.cooldown-dt);
      if(this.spawnIn<=0){if(this.enemies.length<12)this.spawn(input.aspect);this.spawnIn=1.3-(1-this.time/60)*.5;}
      for(const enemy of this.enemies){
        enemy.age+=dt;enemy.depth-=enemy.speed*dt;
        const progress=Math.max(0,Math.min(1,(enemy.startDepth-enemy.depth)/(enemy.startDepth-space.IMPACT_DEPTH)));
        const weave=Math.sin(enemy.age*(enemy.type==='scout'?2.1:.9)+enemy.seed)*(enemy.type==='scout'?2:.7)*Math.sin(progress*Math.PI);
        enemy.position={x:enemy.origin.x+(enemy.destination.x-enemy.origin.x)*progress+weave,y:enemy.origin.y+(enemy.destination.y-enemy.origin.y)*progress,z:-enemy.depth};
      }
      const escaped=this.enemies.filter(e=>e.depth<=space.IMPACT_DEPTH);
      if(escaped.length){
        this.enemies=this.enemies.filter(e=>e.depth>space.IMPACT_DEPTH);this.lives=Math.max(0,this.lives-escaped.length);this.combo=0;
        this.events.push(...escaped.map(e=>({type:'escape',position:{...e.position},radius:e.radius})));
        if(this.lives===0){this.finish('base');return this.events;}
      }
      const automatic=input.autoFire&&input.freshAim&&this.target(input.point,input.aspect);
      if((pressed||input.firing||automatic)&&this.cooldown<=0&&active&&!blocked){this.shoot(input.point,input.aspect||16/9);this.cooldown=.16;}
      return this.events;
    }
  }
  root.OrbitGame=OrbitGame;
  if(typeof module!=='undefined'&&module.exports)module.exports=OrbitGame;
})(typeof globalThis!=='undefined'?globalThis:this);
