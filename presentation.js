/* Automatic, pausable portfolio presentation. Counts describe scope, never measured performance. */
(function(){
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),$=s=>document.querySelector(s);
 let paused=reduced.matches,workIndex=0,heroIndex=0,last=performance.now();
 const held=new Map(),timers=new Map(),visible=new Set();
 const works=[
  ['ENGINEERING FOUNDATION','I connected the pieces of a critical response.','A multimodal incident pipeline, retrieved operational context, coordinated response roles, independent checks and an audit trail.',['4 input streams','5 layers','10 response roles'],'#architecture','Explore the architecture'],
  ['SIMULATION-BACKED PROTOTYPE','I made the system observable—and testable.','A modelled substation with evolving equipment state, independent protection, fault scenarios, evidence gaps and visible response consequences.',['3D environment','Stateful scenarios','What-if comparison'],'twin/','Enter the Digital Twin Lab'],
  ['EXPERIMENTAL INSTRUMENT','I built a workspace for the human–AI questions.','A scenario dashboard and three study modules prepare comparisons of evidence presentation, reliance under pressure and adaptive decision authority.',['Scenario workspace','Decision records','3 planned studies'],'lab.html','Open the Human–AI Lab'],
  ['RESEARCH IN PROGRESS','I turned engineering questions into a research programme.','A research proposal, defined study designs and a first manuscript draft connect the prototype to measurable questions about assurance, evidence and oversight.',['Proposal prepared','Study designs','Manuscript draft'],'#research','Explore the research questions']
 ];
 const phases=[
 ['01 / DETECT','Separate signals. One critical event.','Associate observations with the same incident before planning a response.'],
 ['02 / UNDERSTAND','Give the evidence its operational context.','Connect observations with procedures, equipment relationships and source provenance.'],
 ['03 / PLAN','Bring the right response roles together.','Organise candidate actions and dependencies into a coordinated response plan.'],
 ['04 / CHECK','Challenge the proposed response.','Inspect evidence gaps, conflicts and the constraints represented in the rules.'],
 ['05 / AUTHORISE','Make the approval boundary visible.','Present consequential actions for the required human review before proceeding.'],
 ['06 / RECORD','Keep the reasoning connected to the outcome.','Preserve the evidence, checks, decision and simulated result for later review.']
 ];
 let demo=null,demoView=null,demoTime=0,demoInjected=false;
 function showWork(index){
  workIndex=index;const item=works[index];
  document.querySelectorAll('[data-work]').forEach(el=>{const on=+el.dataset.work===index;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
  document.querySelectorAll('[data-work-visual]').forEach(el=>el.hidden=+el.dataset.workVisual!==index);
  $('#workLabel').textContent=item[0];$('#workTitle').textContent=item[1];$('#workDescription').textContent=item[2];
  $('#workTags').replaceChildren(...item[3].map(text=>{const el=document.createElement('span');el.textContent=text;return el;}));
  $('#workLink').href=item[4];$('#workLink').innerHTML=item[5]+' <span>↗</span>';
  if(index===1&&!demoView){demo=new CMSTwin();demoView=new CMSTwinView($('#showcaseTwin'),{initialState:demo.s});demoView.view('control',{instant:true,auto:!paused});demoView.update(demo.s);}
  if(demoView)demoView.auto(index===1&&!paused);
  $('#workVisual').classList.remove('work-change');requestAnimationFrame(()=>$('#workVisual').classList.add('work-change'));
 }
 document.querySelectorAll('[data-work]').forEach(el=>el.addEventListener('click',()=>showWork(+el.dataset.work)));
 function phase(index){
  heroIndex=index;$('#heroPhase').textContent=phases[index][0];$('#heroPhaseTitle').textContent=phases[index][1];$('#heroPhaseDescription').textContent=phases[index][2];$('.hero-system').dataset.phase=index;
  document.querySelectorAll('[data-hero-step]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.heroStep===index)));
 }
 document.querySelectorAll('[data-hero-step]').forEach(el=>el.addEventListener('click',()=>phase(+el.dataset.heroStep)));
 function motionState(){
  document.body.classList.toggle('story-paused',paused);$('#storyMotion').setAttribute('aria-pressed',String(!paused));$('#storyMotion').lastChild.textContent=paused?' Live story · play':' Live story · pause';
  document.querySelectorAll('.source-observation,.incident-detail,.layer-panel,#stepPanel,#studyPanel').forEach(el=>el.setAttribute('aria-live','off'));
  if(demoView)demoView.auto(workIndex===1&&!paused);
 }
 $('#storyMotion').onclick=()=>{paused=!paused;motionState();};
 reduced.addEventListener('change',e=>{if(e.matches){paused=true;motionState();}});
 function manualHold(event){const section=event.target.closest('section');if(section){held.set(section.id||'hero',performance.now()+16000);timers.set(section.id||'hero',0);}}
 document.addEventListener('pointerdown',manualHold,true);document.addEventListener('keydown',manualHold,true);
 const sections=[['hero','.hero'],['built','#built'],['incident','#incident'],['architecture','#architecture'],['algorithm','#algorithm'],['research','#research']];
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const key=entry.target.dataset.presentationSection;if(entry.isIntersecting)visible.add(key);else visible.delete(key);}),{threshold:.12});
 sections.forEach(([key,selector])=>{const el=$(selector);el.dataset.presentationSection=key;observer.observe(el);});
 function active(key){const el=$('[data-presentation-section="'+key+'"]');return visible.has(key)&&(!held.get(key)||held.get(key)<performance.now())&&!el.contains(document.activeElement);}
 function every(key,dt,seconds,action){if(!active(key))return;const time=(timers.get(key)||0)+dt;if(time>=seconds){timers.set(key,0);action();}else timers.set(key,time);}
 function advanceGroup(selector){const els=Array.from(document.querySelectorAll(selector));const current=els.findIndex(el=>el.getAttribute('aria-pressed')==='true'||el.getAttribute('aria-selected')==='true'||el.classList.contains('active'));els[(current+1)%els.length].click();}
 function tick(now){
  const dt=Math.min((now-last)/1000,1);last=now;
  if(!paused&&!document.hidden){
   every('hero',dt,4.8,()=>phase((heroIndex+1)%6));
   every('built',dt,8,()=>showWork((workIndex+1)%4));
   every('incident',dt,6.5,()=>showIncident((incidentIndex+1)%6));
   every('architecture',dt,7.5,()=>advanceGroup('[data-layer]'));
   every('algorithm',dt,7.5,()=>showStep((stepIndex+1)%8));
   every('research',dt,9,()=>advanceGroup('[data-study]'));
   if(demo&&workIndex===1&&visible.has('built')){
    demoTime+=dt;demo.step(dt*10);
    if(demoTime>1&&!demoInjected){demo.inject('fire');demoInjected=true;demoView.view('transformers',{auto:true});}
    if(demoTime>3&&!demo.s.isolated){demo.action('isolate');demoView.view('dispatcher',{auto:true});}
    if(demoTime>4&&!demo.s.reserveClosed)demo.action('reserve');
    if(demoTime>5&&!demo.s.suppression){demo.action('suppress');demoView.view('control',{auto:true});}
    if(demoTime>7.5){demo.reset();demoTime=0;demoInjected=false;}
    demoView.update(demo.s);
   }
  }
  requestAnimationFrame(tick);
 }
 phase(0);motionState();requestAnimationFrame(tick);
})();
