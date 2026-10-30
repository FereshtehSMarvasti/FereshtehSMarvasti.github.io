(function(){
  'use strict';
  const $=s=>document.querySelector(s),model=new CMSTwin();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running=!reduced,speed=1,last=performance.now(),acc=0,renderAcc=0,lastEvents=-1,sceneReady=false,forecastSignature='',actionSignature='',toastTimer,fallback=null,compatibilityHost=null,preferCompatibility=false,rendererFailed=false;
  const frame=$('#scene'),fmt=t=>'T+'+String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
  let currentView='control',cameraAuto=!reduced,cameraElapsed=0,probeCount=0,probeTimer;
  const names={isolate:['Isolate T2','Dispatcher'],reserve:['Enable reserve','Supervisor'],suppress:['Enable suppression','Site response'],dispatch:['Notify response team','Incident coordination']};
  function message(data){if(sceneReady)frame.contentWindow.postMessage(data,location.origin);}
  function cameraStatus(){
    $('#cameraStatus').textContent=CMSCamera.views[currentView].label+' · '+(cameraAuto?'Auto follow':'Manual view');
    $('#cameraAuto').setAttribute('aria-pressed',String(cameraAuto));
    document.querySelectorAll('[data-view]').forEach(el=>{const selected=el.dataset.view===currentView;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));});
  }
  function setView(name,manual=false,instant=false){
    if(!CMSCamera.views[name])return;if(manual)cameraAuto=false;currentView=name;
    message({type:'cms-twin-view',view:name,auto:cameraAuto,instant});
    if(fallback)fallback.view(name,{auto:cameraAuto,instant});cameraStatus();
  }
  function manualCamera(){cameraAuto=false;message({type:'cms-camera-auto',enabled:false});if(fallback)fallback.auto(false);cameraStatus();}
  function toast(txt){$('#toast').textContent=txt;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
  function forecastKey(){const s=model.s;return [Math.floor(s.time),s.scenario,s.demand,s.ambient,s.isolated,s.reserveClosed,s.suppression,s.t1Closed,s.t2Closed].join('|');}
  function render(){
    const s=model.s,a=model.assessment(),g=model.gates(),served=s.demand-s.unserved;
    $('#simClock').textContent=fmt(s.time);$('#play').textContent=running?'Pause':'Resume';$('#play').setAttribute('aria-pressed',String(running));
    $('#runState').textContent=s.scenario==='normal'?'NORMAL OPERATION':s.unserved>.1?'SUPPLY DEFICIT':s.fire>0?'ACTIVE FIRE':s.scenario==='conflict'?'EVIDENCE CONFLICT':s.isolated?'T2 ISOLATED':'COOLING FAILURE';
    $('#runState').style.color=s.scenario==='normal'?'var(--lime)':'var(--red)';
    $('#served').innerHTML=served.toFixed(1)+'<em>/ '+s.demand+' MW</em>';$('#served').classList.toggle('alert',s.unserved>.1);
    $('#supplyState').textContent=s.unserved>.1?s.unserved.toFixed(1)+' MW unserved':'Full supply';
    $('#t1Load').innerHTML=Math.round(s.t1Load/s.rating*100)+'<em>%</em>';$('#t1Load').classList.toggle('alert',s.t1Load>s.rating||!s.t1Closed);
    $('#t1Status').textContent=s.t1Closed?s.t1Load.toFixed(1)+' MW / 40 MW rating':'CB-T1 / TRIPPED';
    $('#t2Temp').innerHTML=s.t2Temp.toFixed(1)+'<em>°C</em>';$('#t2Temp').classList.toggle('alert',s.t2Temp>90);
    $('#t2Status').textContent=s.isolated?'Isolated / out of service':!s.t2Closed?'Protection / breaker open':s.cooling?'Cooling available':'Cooling failed / heat rising';
    $('#unservedEnergy').innerHTML=s.energyUnserved.toFixed(3)+'<em>MWh</em>';
    $('#sceneBadge').textContent=s.scenario==='normal'?'T1 + T2 / IN SERVICE':s.fire>0?'T2 / FIRE '+Math.round(s.fire*100)+'%':s.isolated?'T2 / ISOLATED':s.scenario==='conflict'?'T2 / OBSERVATIONS DISAGREE':'T2 / COOLING FAILED';
    $('#route').textContent=a.route;$('#assessmentTitle').textContent=a.title;$('#assessmentDetail').textContent=a.detail;
    document.querySelectorAll('[data-stage]').forEach(el=>{el.classList.toggle('active',+el.dataset.stage===a.stage);el.classList.toggle('done',+el.dataset.stage<a.stage);});
    $('#evidence').innerHTML=a.evidence.map(e=>'<div class="evidence-row '+(!e.available?'missing':e.flag?'flag':'')+'"><i></i><div><b>'+e.label+'</b><span>'+e.value+'</span></div></div>').join('');
    $('#thermal').disabled=!g.thermal.allowed;$('#thermal').textContent=s.thermal?'Thermal view received ✓':s.evidenceRequested?'Acquiring… (3 sim sec)':'Acquire thermal view +';
    const nextActions=JSON.stringify(g);
    if(nextActions!==actionSignature){actionSignature=nextActions;$('#actions').innerHTML=Object.entries(names).map(([id,[name,role]])=>'<div class="action"><div><b>'+name+'</b><small>'+role+' · '+g[id].reason+'</small></div><button data-action="'+id+'" '+(!g[id].allowed?'disabled':'')+'>'+(['isolate','reserve'].includes(id)?'Approve':'Run')+'</button></div>').join('');}
    $('#inject').disabled=s.scenario!=='normal';$('#scenario').disabled=s.scenario!=='normal';
    $('#demandValue').textContent=s.demand+' MW';$('#ambientValue').textContent=s.ambient+' °C';
    drawNetwork(s);drawTrend();
    if(lastEvents!==model.seq){lastEvents=model.seq;$('#eventCount').textContent=model.events.length+' EVENTS';$('#audit').innerHTML=model.events.slice().reverse().map(e=>'<tr data-kind="'+e.kind+'"><td>'+fmt(e.time)+'</td><td>'+e.kind+'</td><td>'+e.message+'</td></tr>').join('');}
    if(forecastSignature&&forecastSignature!==forecastKey()){$('#forecastResult').innerHTML='<span class="empty-state">The plant has changed. Compare again for an updated forecast.</span>';forecastSignature='';}
    message({type:'cms-twin-state',state:s,paused:!running,reduced});
    if(fallback)fallback.update(s);
  }
  function drawNetwork(s){
    const green='#bff977',red='#ff8777',gray='#596d7c';
    [['T1',s.t1Closed,s.t1Load],['T2',s.t2Closed,s.t2Load],['R',s.reserveClosed,s.reserveLoad]].forEach(([id,closed,load])=>{
      const color=closed?(load>s.rating?'#f4c078':green):(id==='R'?gray:red);
      $('#wire'+id).style.stroke=color;$('#wire'+id).style.strokeDasharray=closed?'':'5 4';
      $('#symbol'+id).querySelectorAll('circle,rect').forEach(el=>el.style.stroke=color);
      $('#sld'+id).textContent=load.toFixed(1)+' MW · '+(closed?'CLOSED':'OPEN');
    });
    $('#wireLoad').style.stroke=s.unserved>0?red:green;$('#sldServed').textContent='CITY / '+(s.demand-s.unserved).toFixed(1)+' MW SERVED';
    $('#networkNote').textContent=s.t1Load>s.rating?'T1 is overloaded. The 120-second protection timer is at '+Math.floor(s.overloadSeconds)+' seconds.':s.unserved>0?'Supply deficit accumulates in the unserved-energy record.':'Automatic protection and CMS decisions have separate records.';
  }
  function drawTrend(){
    const end=model.s.time,start=Math.max(0,end-180),span=Math.max(30,end-start);
    const data=model.history.filter(p=>p.time>=start);
    const path=key=>data.map((p,i)=>(i?'L':'M')+(43+Math.min(1,(p.time-start)/span)*477).toFixed(1)+','+(172-Math.min(180,p[key])/180*147).toFixed(1)).join(' ');
    $('#temp1Line').setAttribute('d',path('t1Temp'));$('#temp2Line').setAttribute('d',path('t2Temp'));$('#chartStart').textContent=fmt(start);$('#chartEnd').textContent=fmt(end);
    $('#t1Temp').textContent=model.s.t1Temp.toFixed(1)+' °C';$('#t2ChartTemp').textContent=model.s.t2Temp.toFixed(1)+' °C';
  }
  $('#play').onclick=()=>{running=!running;last=performance.now();render();};
  $('#speed').onchange=e=>{speed=Number(e.target.value);model.log('INPUT','Simulation speed → '+speed+'×');render();};
  $('#inject').onclick=()=>{model.inject($('#scenario').value);toast('Fault injected. The physical state and CMS observations now evolve separately.');render();};
  $('#reset').onclick=()=>{model.reset();lastEvents=-1;acc=0;speed=1;$('#speed').value='1';running=!reduced;$('#demand').value='60';$('#ambient').value='25';['scada','vision','context'].forEach(id=>$('#'+id).checked=true);$('#forecastResult').innerHTML='<span class="empty-state">A forecast copies the current model. It never changes the running plant.</span>';forecastSignature='';cameraElapsed=0;cameraAuto=!reduced;setView('control',false,true);message({type:'cms-twin-reset'});render();toast('New run. Equipment, evidence and event record reset.');};
  ['demand','ambient'].forEach(id=>$('#'+id).addEventListener('input',e=>{model.set(id,e.target.value);render();}));
  ['scada','vision','context'].forEach(id=>$('#'+id).addEventListener('change',e=>{model.set(id,e.target.checked);render();}));
  $('#thermal').onclick=()=>{model.action('thermal');render();};
  $('#actions').onclick=e=>{const button=e.target.closest('[data-action]');if(!button)return;const id=button.dataset.action;if(model.action(id)){toast(names[id][0]+' recorded in the simulation.');render();}};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view,true));
  $('#cameraAuto').onclick=()=>{cameraAuto=!cameraAuto;cameraElapsed=0;setView(cameraAuto?CMSCamera.follow(model.s,0):currentView);};
  document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{manualCamera();message({type:'cms-camera-nudge',action:b.dataset.camera});if(fallback)fallback.nudge(b.dataset.camera);});
  $('#forecast').onclick=()=>{const wasRunning=running;running=false;const current=model.forecast(false),planned=model.forecast(true),s=model.s;
    function card(title,f){return '<div><b>'+title+'</b><span>T1 peak: '+f.t1Peak.toFixed(1)+' °C</span><span>T1: '+(f.t1Closed?'in service':'tripped')+'</span><span>Unserved: '+f.unserved.toFixed(1)+' MW</span><span>Fire: '+(f.fire>0?'active':'none')+'</span></div>';}
    $('#forecastResult').innerHTML='<div class="forecast-comparison">'+card('Hold current state',current)+card('Assume response complete',planned)+'</div><p>Snapshot '+fmt(s.time)+'. Simulation paused to inspect the comparison. '+(s.scenario==='normal'||s.scenario==='conflict'?'The intervention is hypothetical; current evidence does not justify this response.':'Actions still require their normal gates in the running model.')+'</p>';
    forecastSignature=forecastKey();model.log('WHAT-IF','Compared holding current state with assumed completed isolation, reserve and suppression. No running state changed.');render();if(wasRunning)toast('Paused for comparison. Resume when ready.');};
  $('#export').onclick=()=>{model.record();const blob=new Blob([JSON.stringify(model.export(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cms-twin-run-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Exported model parameters, samples, actions and event timestamps.');};
  function rendererStatus(){
    const detailed=sceneReady&&!preferCompatibility&&!rendererFailed;
    $('#rendererStatus').textContent=detailed?'Detailed 3D · live model':rendererFailed?'Compatible view · detailed 3D unavailable':'Compatible view · live model';
    $('#rendererToggle').textContent=detailed?'Use compatible view':sceneReady?'Use detailed 3D':'Retry detailed 3D';
    frame.style.visibility=detailed?'visible':'hidden';
    if(compatibilityHost)compatibilityHost.hidden=detailed;
    $('#sceneLoading').hidden=true;
  }
  function compatibility(failed=false){
    if(failed){rendererFailed=true;sceneReady=false;clearTimeout(probeTimer);}
    if(!fallback){
      compatibilityHost=document.createElement('div');compatibilityHost.className='compatible-scene';frame.after(compatibilityHost);
      fallback=new CMSTwinView(compatibilityHost,{onManual:manualCamera,initialState:model.s});
      fallback.view(currentView,{auto:cameraAuto,instant:true});
    }
    rendererStatus();render();cameraStatus();
  }
  window.addEventListener('message',e=>{
    if(e.source!==frame.contentWindow||e.origin!==location.origin)return;
    if(e.data?.type==='cms-scene-ready'&&!rendererFailed){sceneReady=true;clearTimeout(probeTimer);setView(currentView,false,true);render();rendererStatus();}
    if(e.data?.type==='cms-camera-manual')manualCamera();
    if(e.data?.type==='cms-scene-error')compatibility(true);
  });
  function probeScene(){clearTimeout(probeTimer);if(sceneReady||rendererFailed)return;frame.contentWindow.postMessage({type:'cms-twin-ping'},location.origin);if(++probeCount<10)probeTimer=setTimeout(probeScene,1000);else compatibility(true);}
  $('#rendererToggle').onclick=()=>{
    if(sceneReady){preferCompatibility=!preferCompatibility;rendererStatus();setView(currentView,false,true);}
    else {rendererFailed=false;preferCompatibility=false;probeCount=0;frame.src='twin-scene.html?retry='+Date.now();$('#rendererStatus').textContent='Loading detailed 3D · compatible view remains available';probeScene();}
  };
  compatibility();frame.addEventListener('load',probeScene);probeScene();
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){running=false;model.log('SYSTEM','Simulation paused because the page was hidden.');render();}last=performance.now();});
  function loop(now){const wallDt=Math.min((now-last)/1000,1),dt=Math.min(wallDt,.25);last=now;if(running){acc+=dt*speed;while(acc>=.1){model.step(.1);acc-=.1;}}if(cameraAuto&&!document.hidden){cameraElapsed+=wallDt;const nextView=CMSCamera.follow(model.s,cameraElapsed);if(nextView!==currentView)setView(nextView);}renderAcc+=dt;if(renderAcc>=.2){renderAcc=0;render();}requestAnimationFrame(loop);}
  cameraStatus();render();requestAnimationFrame(loop);
})();
