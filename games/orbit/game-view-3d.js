import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
const COLORS={fighter:0x68dcff,scout:0xffc875,guard:0xc29aff};
// Halfway (in log size) from the original game scale toward NASA's Earth-relative diameters.
// https://science.nasa.gov/resource/solar-system-sizes/
// Orbits remain compressed: this is not an astronomical-distance simulation.
export const SUN_RADIUS=10*Math.sqrt(3.1*109);
export const CRUISE_RADIUS=1100;
export const SOLAR_SYSTEM=[
  {id:'mercury',name:'수성',au:.39,earthDiameters:.38,gameRatio:.4,phase:.3,speed:.009,color:0xaca59a},
  {id:'venus',name:'금성',au:.72,earthDiameters:.95,gameRatio:.7,phase:1.2,speed:.007,color:0xe4bb76},
  {id:'earth',name:'지구',au:1,earthDiameters:1,gameRatio:1,phase:2.2,speed:.005,color:0x549bec},
  {id:'mars',name:'화성',au:1.52,earthDiameters:.53,gameRatio:.6,phase:2.8,speed:.004,color:0xc86b46},
  {id:'jupiter',name:'목성',au:5.2,earthDiameters:11.21,gameRatio:2.5,phase:1.35,speed:.0025,color:0xd7b597},
  {id:'saturn',name:'토성',au:9.58,earthDiameters:9.45,gameRatio:2,phase:2.1,speed:.0018,color:0xd8c08f},
  {id:'uranus',name:'천왕성',au:19.2,earthDiameters:4.01,gameRatio:1.4,phase:3.8,speed:.0012,color:0x85ccd5},
  {id:'neptune',name:'해왕성',au:30.05,earthDiameters:3.88,gameRatio:1.3,phase:5,speed:.0008,color:0x4677d9}
].map(body=>({...body,orbit:210+220*Math.log1p(body.au),radius:10*Math.sqrt(body.gameRatio*body.earthDiameters)}));
export function cruisePose(time,aspect=16/9){
  const angle=time*Math.PI*2/144+.35,radius=CRUISE_RADIUS;
  // Positive angle moves up from the right of the north-pole map: counterclockwise.
  // Look into the upcoming curve, keeping the Sun in a cinematic forward panorama.
  const inwardAngle=Math.min(.55,Math.max(.025,Math.atan(Math.tan(58*Math.PI/360)*aspect)-Math.asin(SUN_RADIUS/radius)-.09));
  const ahead=Math.PI-2*inwardAngle;
  return {angle,radius,eye:new THREE.Vector3(radius*Math.cos(angle),radius*.1614,-radius*Math.sin(angle)),
    look:new THREE.Vector3(radius*Math.cos(angle+ahead),-radius*.2544,-radius*Math.sin(angle+ahead))};
}

export class OrbitView {
  constructor(canvas){
    this.canvas=canvas;this.effects=[];this.clock=0;this.sound=false;this.audio=null;this.available=true;
    this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(1.5,devicePixelRatio||1));
    this.renderer.setClearColor(0x030713);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.4;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x060d23,.003);
    this.camera=new THREE.PerspectiveCamera(SpaceMath.FOV,16/9,.1,3000);
    this.scene.add(new THREE.HemisphereLight(0xa8dfff,0x17213c,2.5));
    const sun=new THREE.DirectionalLight(0xffe6c5,3.5);sun.position.set(-20,35,15);this.scene.add(sun);
    const rim=new THREE.DirectionalLight(0x648fa8,1.3);rim.position.set(30,-10,-50);this.scene.add(rim);
    this.ships=new Map();this.templates=new Map();
    for(const type of Object.keys(COLORS))this.templates.set(type,this.makeShip(type));
    this.makeCockpit();this.makeSpace();
    this.preview=[{id:-1,type:'fighter',hp:1,position:{x:-16,y:5,z:-45},radius:2.1},
      {id:-2,type:'guard',hp:2,position:{x:15,y:8,z:-65},radius:2.5},
      {id:-3,type:'scout',hp:1,position:{x:6,y:1,z:-34},radius:1.6}];
    this.lost=event=>{event.preventDefault();this.available=false;};this.restored=()=>{this.available=true;};
    canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored);
  }
  makeShip(type){
    const group=new THREE.Group(),color=COLORS[type];
    const metal=new THREE.MeshStandardMaterial({color:type==='guard'?0x675080:0x38556f,metalness:.65,roughness:.36,flatShading:true});
    const glow=new THREE.MeshBasicMaterial({color});
    const hull=new THREE.Mesh(new THREE.OctahedronGeometry(.62,0),metal);hull.scale.set(.6,.48,1.45);group.add(hull);
    const shape=new THREE.Shape();shape.moveTo(-1,0);shape.lineTo(-.7,-.35);shape.lineTo(-.22,-.25);shape.lineTo(0,.55);shape.lineTo(.22,-.25);shape.lineTo(.7,-.35);shape.lineTo(1,0);shape.lineTo(.2,.35);shape.lineTo(-.2,.35);shape.closePath();
    const wing=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}),metal);
    wing.rotation.x=Math.PI/2;wing.position.y=.06;group.add(wing);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(wing.geometry,25),new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));edges.rotation.copy(wing.rotation);edges.position.copy(wing.position);group.add(edges);
    const canopy=new THREE.Mesh(new THREE.OctahedronGeometry(.19,0),glow);canopy.position.set(0,.23,.25);canopy.scale.set(.65,.6,1.5);group.add(canopy);
    for(const side of [-1,1]){
      const engine=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.65,6),metal);engine.rotation.x=Math.PI/2;engine.position.set(side*.57,-.02,-.16);group.add(engine);
      const exhaust=new THREE.Mesh(new THREE.ConeGeometry(.12,.75,6),glow);exhaust.rotation.x=-Math.PI/2;exhaust.position.set(side*.57,-.02,-.79);group.add(exhaust);
    }
    if(type==='guard'){
      const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(1.08,1),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.18,depthWrite:false}));shield.name='shield';group.add(shield);
    }
    return group;
  }
  makeSpace(){
    this.voyageTime=0;this.solarWorld=new THREE.Group();this.scene.add(this.solarWorld);
    this.voyageMatrix=new THREE.Matrix4();this.voyagePoint=new THREE.Vector3();this.voyageUp=new THREE.Vector3(0,1,0);
    const points=[],colors=[],color=new THREE.Color();
    for(let i=0;i<2200;i++){
      const y=1-2*(i+.5)/2200,radial=Math.sqrt(1-y*y),a=i*2.399963;
      points.push(Math.cos(a)*radial*1800,y*1800,Math.sin(a)*radial*1800);
      color.set(i%5===0?0xa0caff:i%7===0?0xffd2aa:0xc5daf8);colors.push(color.r,color.g,color.b);
    }
    const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(points,3));stars.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.starfield=new THREE.Points(stars,new THREE.PointsMaterial({size:1.5,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:.85,fog:false}));this.solarWorld.add(this.starfield);
    const sphere=new THREE.SphereGeometry(1,48,32);
    this.sunBody=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({map:this.planetTexture('sun'),color:0xffd096,fog:false,toneMapped:false}));this.sunBody.scale.setScalar(SUN_RADIUS);this.solarWorld.add(this.sunBody);
    const corona=new THREE.Sprite(new THREE.SpriteMaterial({map:this.effectGlow,color:0xffb756,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.55,fog:false,toneMapped:false}));corona.scale.setScalar(SUN_RADIUS*4.8);this.solarWorld.add(corona);
    this.solarWorld.add(new THREE.PointLight(0xffdfb0,240000,2800,2));
    this.planets=SOLAR_SYSTEM.map(data=>{
      const mesh=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({map:this.planetTexture(data.id),roughness:1,metalness:0,fog:false}));mesh.scale.setScalar(data.radius);this.solarWorld.add(mesh);
      const root=new THREE.Group();this.solarWorld.add(root);
      if(['earth','venus','uranus','neptune'].includes(data.id)){
        const air=new THREE.Mesh(sphere,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,uniforms:{tint:{value:new THREE.Color(data.color)}},
          vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
          fragmentShader:'uniform vec3 tint;varying vec3 n;varying vec3 v;void main(){float r=pow(1.0-abs(dot(normalize(n),normalize(v))),2.8);gl_FragColor=vec4(tint,r*.55);}'}));air.scale.setScalar(data.radius*1.045);root.add(air);
      }
      if(data.id==='saturn'){
        const ringMaterial=new THREE.MeshStandardMaterial({map:this.ringTexture(),color:0xe5d2a6,side:THREE.DoubleSide,transparent:true,opacity:.8,roughness:1,fog:false,depthWrite:false});
        const rings=new THREE.Mesh(new THREE.RingGeometry(data.radius*1.35,data.radius*2.15,96),ringMaterial);rings.rotation.set(-1.08,.15,.18);root.add(rings);
      }
      return {...data,mesh,root};
    });
    const dust=new THREE.BufferGeometry();dust.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(100*6),3));
    this.cruiseDust=new THREE.LineSegments(dust,new THREE.LineBasicMaterial({color:0xabcce6,transparent:true,opacity:.19,depthWrite:false}));this.cruiseDust.frustumCulled=false;this.scene.add(this.cruiseDust);
    const escort=this.makeFrigate();this.escorts=[];
    for(const [i,position] of [[-17,-8,-33],[21,-9,-41],[-34,-3,-67],[40,-1,-85]].entries()){
      const ship=i===0?escort:escort.clone(true);ship.position.fromArray(position);ship.userData.anchor=new THREE.Vector3().fromArray(position);ship.rotation.y=i%2?.055:-.04;this.scene.add(ship);this.escorts.push(ship);
    }
    this.updateVoyage(0);
  }
  planetTexture(kind){
    const width=256,height=128,pixels=new Uint8Array(width*height*4);
    const palette={mercury:[0x534c43,0xb1a798],venus:[0xa9773b,0xefce91],earth:[0x0b326d,0x1b77bc],mars:[0x66372e,0xc4794e],jupiter:[0x8b614b,0xe5c9a0],saturn:[0xa79164,0xe5d7ab],uranus:[0x529ba7,0xace3db],neptune:[0x163c93,0x528bdc],sun:[0xef6b08,0xffdd6b]};
    const [dark,light]=palette[kind].map(value=>new THREE.Color(value)),out=new THREE.Color(),land=new THREE.Color(0x618659),ice=new THREE.Color(0xd9edf2);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const u=x/width*Math.PI*2,v=(y/height-.5)*Math.PI,px=Math.cos(u)*Math.cos(v),py=Math.sin(v),pz=Math.sin(u)*Math.cos(v);
      const n=Math.sin(px*7+Math.sin(pz*5))*Math.cos(py*8-pz*2)+.4*Math.sin(px*19+pz*13+py*11);
      let mix=.5+n*.25;
      if(['jupiter','saturn','venus','uranus','neptune'].includes(kind))mix=.52+.2*Math.sin(v*(kind==='jupiter'?29:17)+n*.7)+n*.1;
      out.copy(dark).lerp(light,THREE.MathUtils.clamp(mix,0,1));
      if(kind==='earth'){
        if(n>.12)out.copy(land).multiplyScalar(.7+mix*.5);
        if(Math.abs(py)>.9)out.lerp(ice,.85);
        const cloud=Math.sin(px*23+Math.sin(py*12))*Math.cos(pz*19+py*13);if(cloud>.52)out.lerp(ice,(cloud-.52)*1.2);
      }
      if(kind==='mars'&&Math.abs(py)>.96)out.lerp(ice,.65);
      if(kind==='jupiter'&&Math.pow((u-4.2)/.24,2)+Math.pow((v+.2)/.10,2)<1)out.set(0xad6448);
      if(kind==='sun')out.multiplyScalar(1.05+.2*Math.sin(n*9));
      const i=(y*width+x)*4;out.convertLinearToSRGB();pixels[i]=Math.min(255,out.r*255);pixels[i+1]=Math.min(255,out.g*255);pixels[i+2]=Math.min(255,out.b*255);pixels[i+3]=255;
    }
    const texture=new THREE.DataTexture(pixels,width,height);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.wrapS=THREE.RepeatWrapping;texture.needsUpdate=true;return texture;
  }
  ringTexture(){
    const size=128,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const radius=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
      const stripe=.55+.2*Math.sin(radius*160)+.1*Math.sin(radius*330);
      pixels[i]=pixels[i+1]=pixels[i+2]=255*stripe;pixels[i+3]=radius>.79&&radius<.815?30:230;
    }
    const texture=new THREE.DataTexture(pixels,size,size);texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
  }
  updateVoyage(time){
    const pose=cruisePose(time,this.camera.aspect);this.voyagePose=pose;
    this.voyageMatrix.lookAt(pose.eye,pose.look,this.voyageUp);
    this.solarWorld.quaternion.setFromRotationMatrix(this.voyageMatrix).invert();
    this.solarWorld.position.copy(pose.eye).negate().applyQuaternion(this.solarWorld.quaternion);
    for(const planet of this.planets){
      const angle=planet.phase+time*planet.speed;planet.angle=angle;
      planet.mesh.position.set(planet.orbit*Math.cos(angle),0,-planet.orbit*Math.sin(angle));planet.mesh.rotation.y=time*.025;
      planet.root.position.copy(planet.mesh.position);
    }
    this.sunBody.rotation.y=time*.018;this.solarWorld.updateMatrixWorld(true);
    const dust=this.cruiseDust.geometry.attributes.position;
    for(let i=0;i<100;i++){
      const z=-180+((i*37.17+time*24)%176),x=Math.sin(i*4.7)*75,y=Math.cos(i*2.3)*42;
      dust.setXYZ(i*2,x,y,z);dust.setXYZ(i*2+1,x,y,z-.65);
    }
    dust.needsUpdate=true;this.cruiseDust.visible=!this.reduceMotion;
    for(const [i,ship] of this.escorts.entries()){
      ship.position.copy(ship.userData.anchor);ship.position.y+=Math.sin(time*.8+i)*.12;ship.rotation.z=Math.sin(time*.55+i)*.008;
      ship.traverse(node=>{
        if(node.userData.exhaust){const pulse=this.reduceMotion?1:1+.13*Math.sin(time*18+i*1.7+node.userData.phase);node.scale.set(pulse*.95,pulse*.95,pulse);}
        if(node.userData.exhaustGlow)node.scale.setScalar(this.reduceMotion?1.5:1.5+.12*Math.sin(time*18+i));
      });
    }
    if(this.engineMaterial)this.engineMaterial.uniforms.time.value=time;
    const bodies=[{id:'sun',name:'태양',radius:SUN_RADIUS,mesh:this.sunBody},...this.planets];
    this.navigation={angle:pose.angle,progress:((pose.angle-.35)%(Math.PI*2))/(Math.PI*2),labels:bodies.map(body=>{
      const point=this.voyagePoint.copy(body.mesh.position).applyMatrix4(this.solarWorld.matrixWorld),depth=-point.z;
      point.project(this.camera);
      const radius=body.radius/Math.max(1,depth)/(2*Math.tan(this.camera.fov*Math.PI/360));
      return {id:body.id,name:body.name,x:(point.x+1)/2,y:(1-point.y)/2+radius+.025,anchorY:(1-point.y)/2+radius+.013,centerY:(1-point.y)/2,radius,depth,
        visible:depth>body.radius&&Math.abs(point.x)<.94&&point.y>-.3&&point.y<.6};
    }),map:this.planets.map(planet=>({id:planet.id,x:64+planet.mesh.position.x/pose.radius*50,y:64+planet.mesh.position.z/pose.radius*50}))};
    // Place labels below nearby disks, never over another planet's name or surface.
    const placed=[];
    for(const label of this.navigation.labels){
      if(!label.visible)continue;
      for(let attempt=0;attempt<8;attempt++){
        const nameOverlap=placed.some(other=>Math.abs(label.x-other.x)<.055&&Math.abs(label.y-other.y)<.033);
        const diskOverlap=this.navigation.labels.some(other=>other!==label&&other.visible&&Math.abs(label.x-other.x)<other.radius/this.camera.aspect+.025&&Math.abs(label.y-other.centerY)<other.radius+.013);
        if(!nameOverlap&&!diskOverlap)break;label.y+=.033;
      }
      if(label.y>=.74)label.y=label.centerY-label.radius-.025;
      label.visible=label.y>.16&&label.y<.76;if(label.visible)placed.push(label);
    }
  }
  hullGeometry(width,length,depth){
    const shape=new THREE.Shape();shape.moveTo(0,length*.52);shape.lineTo(width*.42,length*.13);shape.lineTo(width*.5,-length*.32);shape.lineTo(width*.3,-length*.5);shape.lineTo(-width*.3,-length*.5);shape.lineTo(-width*.5,-length*.32);shape.lineTo(-width*.42,length*.13);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:depth*.25,bevelThickness:depth*.2});geometry.rotateX(-Math.PI/2);return geometry;
  }
  makeFrigate(){
    const group=new THREE.Group();group.name='allied-frigate';
    const armor=new THREE.MeshStandardMaterial({color:0x556b7e,metalness:.35,roughness:.52,emissive:0x162938,emissiveIntensity:.3});
    const dark=new THREE.MeshStandardMaterial({color:0x283e50,metalness:.4,roughness:.6});
    const trim=new THREE.MeshBasicMaterial({color:0x81eacb});
    this.engineMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{time:{value:0}},
      vertexShader:'varying vec2 uv0;varying vec3 n;varying vec3 v;void main(){uv0=uv;vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:'uniform float time;varying vec2 uv0;varying vec3 n;varying vec3 v;void main(){float t=uv0.y;float wave=.8+.2*sin(t*32.0-time*26.0+sin(uv0.x*18.0));float edge=pow(abs(dot(normalize(n),normalize(v))),.45);float alpha=pow(1.0-t,1.05)*wave*edge*.8;vec3 c=mix(vec3(.78,.98,1.0),vec3(.06,.4,1.0),smoothstep(.0,.6,t));gl_FragColor=vec4(c,alpha);}'});
    const plumeGeometry=new THREE.ConeGeometry(.44,4.4,20,1,true);plumeGeometry.rotateX(Math.PI/2);plumeGeometry.translate(0,0,2.2);
    const coreGeometry=new THREE.ConeGeometry(.20,2.7,16,1,true);coreGeometry.rotateX(Math.PI/2);coreGeometry.translate(0,0,1.35);
    const coreMaterial=new THREE.MeshBasicMaterial({color:0xcaffff,map:this.effectGlow,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
    const hull=new THREE.Mesh(this.hullGeometry(3.3,10,.55),armor);group.add(hull);
    const box=(w,h,d,x,y,z,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
    box(1.7,.4,4.7,0,.6,.2,dark);box(1.05,.7,1.55,0,1.1,1.3,armor);box(.87,.18,.04,0,1.25,2.1,trim);box(.07,1.2,.07,.25,1.9,1.4,dark);
    for(const side of [-1,1]){
      box(.62,.6,4,side*1.55,.15,1,dark);box(.045,.04,4.2,side*1.16,.59,.1,trim);
      const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.32,.35,.3,16),armor);nozzle.rotation.x=Math.PI/2;nozzle.position.set(side*1.55,.16,3.02);group.add(nozzle);
      const plume=new THREE.Group();plume.name='engine-plume';plume.userData.exhaust=true;plume.userData.phase=side*1.8;plume.position.set(side*1.55,.16,3.18);
      plume.add(new THREE.Mesh(plumeGeometry,this.engineMaterial),new THREE.Mesh(coreGeometry,coreMaterial));group.add(plume);
      const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.effectGlow,color:0x58cfff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.85,toneMapped:false}));glow.position.set(side*1.55,.16,3.2);glow.userData.exhaustGlow=true;glow.scale.setScalar(1.5);group.add(glow);
      const turret=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,.28,12),armor);turret.position.set(side*.57,.78,-1.7);group.add(turret);
      const gun=new THREE.Mesh(new THREE.CylinderGeometry(.075,.1,1.25,12),dark);gun.rotation.x=Math.PI/2;gun.position.set(side*.57,.88,-2.27);group.add(gun);
    }
    return group;
  }
  makeCockpit(){
    this.cockpit=new THREE.Group();this.scene.add(this.cockpit);
    this.barrels=[];this.turrets=[];this.muzzles=[];this.recoil=0;this.makeEffectAssets();
    this.turretTarget=new THREE.Vector3(0,0,-100);
    this.cockpit.name='flagship-armored-deck';
    const panel=new THREE.MeshStandardMaterial({color:0x617d91,metalness:.25,roughness:.55,emissive:0x182d43,emissiveIntensity:.35});
    const dark=new THREE.MeshStandardMaterial({color:0x243e51,metalness:.4,roughness:.5,emissive:0x0c1a27,emissiveIntensity:.3});
    const barrelMetal=new THREE.MeshStandardMaterial({color:0x839aaf,metalness:.35,roughness:.42,emissive:0x203950,emissiveIntensity:.3});
    const trim=new THREE.MeshBasicMaterial({color:0x7fe4cb}),gold=new THREE.MeshStandardMaterial({color:0xbc9759,metalness:.4,roughness:.5});
    const cockpitFill=new THREE.PointLight(0xd6eaff,3,5,2);cockpitFill.position.set(0,.35,-.8);this.cockpit.add(cockpitFill);
    const boxGeometry=new THREE.BoxGeometry(1,1,1);
    const box=(w,h,d,x,y,z,material)=>{const mesh=new THREE.Mesh(boxGeometry,material);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);this.cockpit.add(mesh);return mesh;};
    const hull=new THREE.Mesh(this.hullGeometry(2.25,5.2,.19),dark);hull.position.set(0,-1.4,-2.65);this.cockpit.add(hull);
    const deck=new THREE.Mesh(this.hullGeometry(1.92,4.75,.1),panel);deck.position.set(0,-1.28,-2.7);this.cockpit.add(deck);
    for(let i=0;i<6;i++){
      const z=-1.7-i*.54,width=.9-i*.10;box(width,.028,.43,0,-1.15,z,dark);
      for(const side of [-1,1])box(.022,.023,.29,side*(width*.5+.09),-1.135,z,trim);
    }
    // Raised aft bridge, sensor mast and armored gun bases; the center aim stays clear.
    box(.68,.47,.43,0,-.89,-1.77,dark);
    const bridge=new THREE.Mesh(this.hullGeometry(.59,.55,.19),panel);bridge.position.set(0,-.72,-1.8);this.cockpit.add(bridge);
    box(.30,.055,.012,0,-.6,-1.47,trim);box(.03,.2,.035,.24,-.4,-1.83,dark);
    box(.12,.025,.045,.24,-.29,-1.83,barrelMetal);
    for(const side of [-1,1]){
      const flank=new THREE.Mesh(this.hullGeometry(.53,2.9,.18),panel);flank.position.set(side*.95,-.9,-1.95);this.cockpit.add(flank);
      box(.12,.12,1.3,side*1.06,-.65,-1.4,dark);
      for(let i=0;i<5;i++)box(.14,.03,.037,side*1.065,-.576,-1.02-i*.19,barrelMetal);
      const base=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,.16,16),dark);base.position.set(side*.62,-.66,-1.7);this.cockpit.add(base);
      const yaw=new THREE.Group();yaw.name='turret-yaw';yaw.position.set(side*.62,-.64,-1.7);this.cockpit.add(yaw);
      const pitch=new THREE.Group();pitch.name='barrel-elevation';pitch.position.y=.16;yaw.add(pitch);
      const turret=new THREE.Mesh(this.hullGeometry(.34,.68,.18),panel);turret.position.set(side*.62,-.635,-1.57);this.cockpit.add(turret);
      yaw.attach(turret);yaw.attach(box(.28,.016,.042,side*.62,-.422,-1.47,gold));
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,1.05,8),barrelMetal);barrel.rotation.x=Math.PI/2;barrel.position.set(side*.62,-.48,-2);this.cockpit.add(barrel);this.barrels.push(barrel);
      pitch.attach(barrel);barrel.userData.restZ=barrel.position.z;
      for(const y of [-.39,.1,.35]){const collar=new THREE.Mesh(new THREE.CylinderGeometry(.087,.087,.075,12),dark);collar.position.y=y;barrel.add(collar);}
      const muzzle=new THREE.Mesh(new THREE.TorusGeometry(.066,.012,6,20),trim);muzzle.rotation.x=Math.PI/2;muzzle.position.y=-.532;barrel.add(muzzle);
      const bore=new THREE.Mesh(new THREE.CircleGeometry(.051,16),new THREE.MeshBasicMaterial({color:0x04101a,side:THREE.DoubleSide}));bore.rotation.x=Math.PI/2;bore.position.y=-.534;barrel.add(bore);
      const tip=new THREE.Object3D();tip.position.y=-.548;barrel.add(tip);this.muzzles.push(tip);this.turrets.push({yaw,pitch,barrel,tip});
      box(.035,.016,.61,side*.9,-.685,-1.82,trim);
    }
  }
  aimTurretsAt(target,dt,snap=false){
    if(!target||![target.x,target.y,target.z].every(Number.isFinite))return;
    const blend=snap?1:1-Math.exp(-Math.max(0,dt)/.055);
    for(const turret of this.turrets){
      const dx=target.x-turret.yaw.position.x,dy=target.y-(turret.yaw.position.y+turret.pitch.position.y),dz=target.z-turret.yaw.position.z;
      const yaw=THREE.MathUtils.clamp(Math.atan2(-dx,-dz),-Math.PI*.39,Math.PI*.39);
      const pitch=THREE.MathUtils.clamp(Math.atan2(dy,Math.hypot(dx,dz)),-Math.PI*.20,Math.PI*.25);
      turret.yaw.rotation.y+=(yaw-turret.yaw.rotation.y)*blend;turret.pitch.rotation.x+=(pitch-turret.pitch.rotation.x)*blend;
    }
    this.cockpit.updateMatrixWorld(true);
  }
  makeEffectAssets(){
    // Small, shared GPU assets: no full-screen bloom pass or per-shot textures.
    this.effectGeometry={bolt:new THREE.CylinderGeometry(.55,1,1,16),trail:new THREE.ConeGeometry(1,1,16),ring:new THREE.RingGeometry(.88,1,48)};
    const size=32,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);
      pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.pow(Math.max(0,1-r),2));
    }
    this.effectGlow=new THREE.DataTexture(pixels,size,size);this.effectGlow.needsUpdate=true;
    this.effectGlow.magFilter=this.effectGlow.minFilter=THREE.LinearFilter;
    this.effectDummy=new THREE.Object3D();this.effectAxis=new THREE.Vector3(0,1,0);
  }
  effectMaterial(color,opacity=1,sprite=false){
    const options={color,opacity,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false};
    return sprite?new THREE.SpriteMaterial({...options,map:this.effectGlow}):new THREE.MeshBasicMaterial({...options,side:THREE.DoubleSide});
  }
  addShot(endpoint){
    this.aimTurretsAt(endpoint,0,true);
    const mesh=new THREE.Group(),end=new THREE.Vector3().copy(endpoint),bolts=[],flashes=[];
    const core=this.effectMaterial(0xeaffff),shell=this.effectMaterial(0x44dcff,.45),trail=this.effectMaterial(0x168aff,.25);
    const flash=this.effectMaterial(0x64eaff,1,true),flashCore=this.effectMaterial(0xffffff,1,true);
    const aura=this.effectMaterial(0x32cfff,.7,true);shell.map=trail.map=this.effectGlow;
    const life=this.reduceMotion?.055:THREE.MathUtils.clamp(end.length()/650,.065,.17);
    for(const muzzle of this.muzzles){
      const start=muzzle.getWorldPosition(new THREE.Vector3()),direction=end.clone().sub(start).normalize(),packet=new THREE.Group();
      packet.quaternion.setFromUnitVectors(this.effectAxis,direction);packet.position.copy(start);
      const inner=new THREE.Mesh(this.effectGeometry.bolt,core),outer=new THREE.Mesh(this.effectGeometry.bolt,shell),tail=new THREE.Mesh(this.effectGeometry.trail,trail);
      const headGlow=new THREE.Sprite(aura);
      packet.add(tail,outer,inner,headGlow);mesh.add(packet);bolts.push({packet,start,end,inner,outer,tail,headGlow});
      const halo=new THREE.Sprite(flash),center=new THREE.Sprite(flashCore);
      halo.position.copy(start);center.position.copy(start);mesh.add(halo,center);flashes.push({halo,center});
    }
    this.scene.add(mesh);this.recoil=this.reduceMotion?0:.075;
    const effect={type:'shot',mesh,age:0,life,bolts,flashes,materials:[core,shell,trail,flash,flashCore,aura]};
    this.effects.push(effect);this.updateShot(effect);this.tone(720,.09,.018,'triangle');
    return life;
  }
  updateShot(effect){
    const t=Math.min(1,effect.age/effect.life),fade=Math.min(1,(1-t)*5),flash=Math.max(0,1-effect.age/.065);
    for(const bolt of effect.bolts){
      bolt.packet.position.lerpVectors(bolt.start,bolt.end,t);
      const travelled=bolt.start.distanceTo(bolt.end)*t,length=Math.min(.6+t*3.5,travelled+.12),width=.027+t*.13;
      bolt.inner.scale.set(width,length,width);bolt.inner.position.y=-length/2;
      bolt.headGlow.scale.setScalar(width*9);
      bolt.outer.scale.set(width*2.8,length*1.1,width*2.8);bolt.outer.position.y=-length*.55;
      const tailLength=this.reduceMotion?length:Math.min(length*2.6,travelled+.12);
      bolt.tail.scale.set(width*3.3,tailLength,width*3.3);bolt.tail.position.y=-tailLength/2;
    }
    for(const {halo,center} of effect.flashes){halo.scale.setScalar((this.reduceMotion?.18:.36)*(.6+flash*.4));center.scale.setScalar(.13);}
    const [core,shell,trail,muzzle,muzzleCore,aura]=effect.materials;
    core.opacity=fade;shell.opacity=.45*fade;trail.opacity=(this.reduceMotion?.08:.25)*fade;
    muzzle.opacity=flash*.85;muzzleCore.opacity=flash;aura.opacity=.7*fade;
  }
  queueImpact(event,delay){
    if(delay<=0){this.addImpact(event);return;}
    const mesh=new THREE.Group();mesh.position.copy(event.position);
    // The game still scores immediately. Keep only a visual hull until the pulse arrives.
    if(event.type==='kill'&&this.templates.has(event.enemy)){
      const hull=this.templates.get(event.enemy).clone(true);hull.scale.setScalar(event.radius);hull.rotation.x=.36;
      const shield=hull.getObjectByName('shield');if(shield)shield.visible=false;mesh.add(hull);
    }
    this.scene.add(mesh);this.effects.push({type:'impactDelay',event,mesh,age:0,life:delay,materials:[]});
  }
  addImpact(event){
    const mesh=new THREE.Group(),radius=event.radius||1.5,kill=event.type==='kill';mesh.position.copy(event.position);
    const color=event.type==='escape'?0xff5473:kill?0xffb955:0xb492ff;
    const glow=this.effectMaterial(color,.9,true),core=this.effectMaterial(kill?0xfff2c7:0xece4ff,1,true);
    const ringMaterial=this.effectMaterial(color,.65),sparkMaterial=this.effectMaterial(kill?0xffda83:color,.9);
    const halo=new THREE.Sprite(glow),center=new THREE.Sprite(core),ring=new THREE.Mesh(this.effectGeometry.ring,ringMaterial);
    mesh.add(halo,center,ring);
    const count=this.reduceMotion?6:kill?32:16,sparks=new THREE.InstancedMesh(this.effectGeometry.bolt,sparkMaterial,count),particles=[];
    sparks.frustumCulled=false;sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.add(sparks);
    for(let i=0;i<count;i++){
      const direction=new THREE.Vector3(Math.sin(i*2.4+.3),Math.cos(i*1.7),Math.sin(i*.9+.8)).normalize();
      particles.push({direction,speed:radius*(3+i%5),rotation:new THREE.Quaternion().setFromUnitVectors(this.effectAxis,direction)});
    }
    const effect={type:'impact',mesh,age:0,life:this.reduceMotion?.24:kill?.6:.36,radius,halo,center,ring,sparks,particles,materials:[glow,core,ringMaterial,sparkMaterial]};
    this.scene.add(mesh);this.effects.push(effect);this.updateImpact(effect);
    if(kill)this.tone(155,.2,.04,'sawtooth');if(event.type==='escape')this.tone(85,.3,.045);
  }
  updateImpact(effect){
    const t=Math.min(1,effect.age/effect.life),fade=Math.pow(1-t,2),r=effect.radius;
    effect.halo.scale.setScalar(r*(3+t*6));effect.center.scale.setScalar(r*(1.1+t*1.4));
    effect.ring.scale.setScalar(r*(.25+t*(this.reduceMotion?.8:2.5)));
    const [halo,core,ring,sparks]=effect.materials;
    halo.opacity=.85*fade;core.opacity=Math.max(0,1-t*4);ring.opacity=.65*fade;sparks.opacity=1-t;
    for(let i=0;i<effect.particles.length;i++){
      const particle=effect.particles[i],dummy=this.effectDummy;
      dummy.position.copy(particle.direction).multiplyScalar(particle.speed*effect.age*(this.reduceMotion?.2:1));
      dummy.quaternion.copy(particle.rotation);dummy.scale.set(r*.035*(1-t),r*(.12+.4*t),r*.035*(1-t));dummy.updateMatrix();
      effect.sparks.setMatrixAt(i,dummy.matrix);
    }
    effect.sparks.instanceMatrix.needsUpdate=true;
  }
  syncShips(enemies){
    const ids=new Set(enemies.map(enemy=>enemy.id));
    for(const [id,ship] of this.ships)if(!ids.has(id)){ship.removeFromParent();this.ships.delete(id);}
    for(const enemy of enemies){
      let ship=this.ships.get(enemy.id);
      if(!ship){ship=this.templates.get(enemy.type).clone(true);this.ships.set(enemy.id,ship);this.scene.add(ship);}
      ship.position.copy(enemy.position);ship.scale.setScalar(enemy.radius);
      ship.rotation.set(.36,Math.sin((enemy.age||this.clock)*.8+(enemy.seed||0))*.12,Math.sin((enemy.age||this.clock)*1.1+(enemy.seed||0))*.12);
      const shield=ship.getObjectByName('shield');if(shield)shield.visible=enemy.hp>1;
    }
  }
  toggleSound(){
    if(!this.audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;this.audio=new Audio();}
    this.audio.resume().catch(()=>{});this.sound=!this.sound;return this.sound;
  }
  tone(frequency,duration,volume=.035,type='sine'){
    if(!this.sound||this.audio?.state!=='running')return;
    const osc=this.audio.createOscillator(),gain=this.audio.createGain(),now=this.audio.currentTime;
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(Math.max(50,frequency*.3),now+duration);
    gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain);gain.connect(this.audio.destination);osc.start(now);osc.stop(now+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  accept(events){
    let travel=0;
    for(const event of events){
      if(event.type==='shot'){
        travel=this.addShot(event.position);
      }else if(['hit','kill','escape'].includes(event.type)){
        this.queueImpact(event,event.type==='escape'?0:travel);
      }else if(event.type==='launch')this.tone(850,.2,.025);
    }
    while(this.effects.length>45)this.removeEffect(this.effects.shift());
  }
  removeEffect(effect){
    effect.mesh.removeFromParent();effect.sparks?.dispose();
    for(const material of effect.materials)material.dispose();
  }
  clearEffects(){for(const effect of this.effects)this.removeEffect(effect);this.effects=[];this.recoil=0;for(const barrel of this.barrels)barrel.position.z=barrel.userData.restZ;}
  updateEffects(dt){
    this.recoil*=Math.exp(-24*dt);for(const barrel of this.barrels)barrel.position.z=barrel.userData.restZ+this.recoil;
    for(const effect of this.effects){
      effect.age+=dt;
      if(effect.type==='shot')this.updateShot(effect);
      if(effect.type==='impact')this.updateImpact(effect);
    }
    for(let i=this.effects.length-1;i>=0;i--)if(this.effects[i].age>=this.effects[i].life){
      const effect=this.effects.splice(i,1)[0];this.removeEffect(effect);
      if(effect.type==='impactDelay')this.addImpact(effect.event);
    }
  }
  draw(game,dt,aim=null){
    if(!this.available)return;
    const rect=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
    this.clock+=dt;this.syncShips(['playing','countdown','paused'].includes(game.phase)?game.enemies:this.preview);
    const x=Number.isFinite(aim?.x)?THREE.MathUtils.clamp(aim.x,0,1):.5,y=Number.isFinite(aim?.y)?THREE.MathUtils.clamp(aim.y,0,1):.5;
    const extent=100*Math.tan(this.camera.fov*Math.PI/360);
    this.turretTarget.set((x*2-1)*extent*this.camera.aspect,(1-y*2)*extent,-100);
    this.aimTurretsAt(this.turretTarget,dt);
    if(game.phase!=='paused'&&!this.reduceMotion)this.voyageTime+=dt;
    this.updateVoyage(this.voyageTime);
    this.updateEffects(dt);
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){
    this.clearEffects();this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored);
    const geometries=new Set(),materials=new Set(),textures=new Set([this.effectGlow]);
    const collect=object=>object.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)materials.add(node.material);});
    collect(this.scene);for(const template of this.templates.values())collect(template);
    for(const geometry of Object.values(this.effectGeometry))geometries.add(geometry);
    for(const geometry of geometries)geometry.dispose();for(const material of materials){if(material.map)textures.add(material.map);material.dispose();}
    for(const texture of textures)texture.dispose();this.renderer.dispose();this.audio?.close();
  }
}
