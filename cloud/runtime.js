/* V1.16 shared classroom cloud sync — local-only remains the default until configured. */
(() => {
  'use strict';
  const config=window.EXAM_CLOUD_CONFIG||{};
  if(!window.EXAM_CLOUD_ACTIVE)return;
  // Pilot entry ?cloud=test opts this browser into Google OAuth until explicitly exited.
  // Production remains local-only while config.enabled is false.
  const pilotKey='exam-classroom-google-pilot';
  const pilotRequested=new URLSearchParams(window.location.search).get('cloud')==='test';
  if(pilotRequested){try{localStorage.setItem(pilotKey,'1')}catch{}}
  const pilotEnabled=(()=>{try{return localStorage.getItem(pilotKey)==='1'}catch{return pilotRequested}})();
  const configured=(config.enabled===true || pilotEnabled) && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((config.url||'').trim()) &&
      typeof config.publishableKey==='string' && config.publishableKey.trim().length>20;
  const app=window.EXAM_APP;
  if(!app || !configured)return;
  const lib=window.supabase;
  if(!lib?.createClient){console.error('Supabase client unavailable');return;}
  const db=lib.createClient(config.url.trim().replace(/\/$/,''),config.publishableKey.trim());
  let user=null, memberships=[], activeRoom=null, sub=null, loadingRoom=false;
  const revisions=new Map(), pending=new Map(), dirty=new Set(), timers=new Map();
  const verified=new Set();
  let sessionSerial=0;
  const shade=document.createElement('div');
  shade.id='cloudGate';
  shade.style.cssText='position:fixed;inset:0;z-index:99999;background:#f2f3ff;display:grid;place-items:center;padding:18px;color:#223354;font-family:system-ui,"Noto Sans TC",sans-serif';
  shade.innerHTML='<section style="width:min(480px,100%);background:white;border:1px solid #ccd4e8;padding:24px;border-radius:20px;box-shadow:0 16px 70px #21335c2a">'+
    '<h2 style="margin:0 0 8px">🏫 段考監考教室 · 教師登入</h2>'+
    '<p style="line-height:1.6;color:#5d6680;margin:0 0 12px">請使用學校核發的教師帳號。只有獲授權的班級可開啟及修改。</p>'+
    '<button id="cloudGoogleLogin" type="button" style="display:block;width:100%;padding:14px;margin:14px 0;border:1px solid #c9d0e5;background:white;color:#253052;border-radius:12px;font-weight:700;cursor:pointer">使用 Google 帳號登入</button>'+
    '<div id="cloudPasswordLogin" style="display:none"><form id="cloudLogin"><label>電子郵件<input id="cloudEmail" type="email" autocomplete="username" required style="box-sizing:border-box;display:block;width:100%;padding:10px;margin:5px 0 10px"></label>'+
    '<label>密碼<input id="cloudPassword" type="password" autocomplete="current-password" required style="box-sizing:border-box;display:block;width:100%;padding:10px;margin:5px 0 14px"></label>'+
    '<button type="submit" style="background:#6359b7;color:white;border:0;border-radius:9px;padding:11px 17px;cursor:pointer">密碼登入</button><button type="button" id="cloudMagicLink" style="margin-left:8px;background:#e6e1ff;color:#463b88;border:0;border-radius:9px;padding:11px 12px;cursor:pointer">寄送 Email 登入連結</button></form></div>'+
    '<button id="cloudGateLogout" type="button" style="border:0;background:none;color:#6558b2;padding:10px 0;cursor:pointer">切換教師帳號／登出</button><button id="cloudPilotExit" type="button" style="border:0;background:none;color:#6558b2;padding:10px 0;cursor:pointer">開啟此裝置本機版／JSON 備份</button><div id="cloudGateStatus" role="status" style="color:#6a5078;font-size:14px;margin-top:12px"></div>'+
    '</section>';
  document.body.appendChild(shade);
  document.documentElement.classList.remove('cloud-booting');
  document.querySelector('.topbar .status').textContent='● Google 教師雲端模式';
  const setGateStatus=(msg)=>{const t=document.getElementById('cloudGateStatus');if(t)t.textContent=msg;};
  const shell=document.querySelector('.shell');
  if(shell)shell.style.visibility='hidden'; // prevent exposing student data while logged out
  const toolbar=document.createElement('div');
  toolbar.id='cloudToolbar';
  toolbar.style.cssText='display:flex;gap:7px;align-items:center;flex-wrap:wrap';
  toolbar.innerHTML='<span id="cloudStatus" style="font-size:12px;color:#5e5ba4">雲端連線中</span>'+
    '<select id="cloudRoom" aria-label="切換已授權班級" style="padding:7px;border-radius:9px;border:1px solid #a7aed0"></select>'+
    '<button id="cloudRefresh" class="btn" title="重新下載雲端資料">↻ 同步</button>'+
    '<button id="cloudUpload" class="btn" title="第一次將本班本機資料建立到雲端">↑ 初始化本班</button>'+
    '<button id="cloudSignOut" class="btn">登出</button><a href="?cloud=local" class="btn">本機版／備份</a>';
  document.querySelector('.nav')?.appendChild(toolbar);
  const status=(text)=>{document.getElementById('cloudStatus').textContent=text;};
  const membership=(room)=>memberships.find(m=>m.room===room);
  const canWrite=(room)=>['editor','admin'].includes(membership(room)?.role);
  const gate=(visible,text)=>{shade.style.display=visible?'grid':'none';if(shell)shell.style.visibility=visible?'hidden':'';if(text)setGateStatus(text);};
  const cancel=(room)=>{const t=timers.get(room);if(t)clearTimeout(t);timers.delete(room);};
  const queryRow=async(room)=>{
    const {data,error}=await db.from('classroom_state').select('room,payload,revision,updated_at').eq('room',room).maybeSingle();
    if(error)throw error;return data;
  };
  async function loadRemote(room,force=false){
    if(!user||!membership(room))return;
    const serial=sessionSerial;
    const row=await queryRow(room);
    if(serial!==sessionSerial||!user||!membership(room))return;
    if(!row){revisions.set(room,0);verified.add(room);if(app.currentRoom()===room)app.initializeEmptyRoom(room);status('此班尚未建立雲端資料，顯示空白班級以保護既有本機名冊');return;}
    if(dirty.has(room) && !force){status('本機有未同步修改，請先處理衝突');return;}
    revisions.set(room,row.revision);
    verified.add(room);
    pending.delete(room);dirty.delete(room);cancel(room);
    if(app.currentRoom()===room)app.applySnapshot(room,row.payload);
    else app.cacheSnapshot(room,row.payload);
    status('✓ 已載入雲端 · '+room);
  }
  const reloadMemberships=async()=>{
    const {data,error}=await db.from('classroom_members').select('room,role').order('room');
    if(error)throw error;
    memberships=data||[];
    const select=document.getElementById('cloudRoom');select.replaceChildren();
    for(const m of memberships){const option=document.createElement('option');option.value=m.room;option.textContent=m.room+' · '+(m.role==='viewer'?'可檢視':'可編輯');select.appendChild(option);}
  };
  const subscribe=(room)=>{
    if(sub){db.removeChannel(sub);sub=null;}
    sub=db.channel('exam-'+room)
      .on('postgres_changes',{event:'*',schema:'public',table:'classroom_state',filter:'room=eq.'+room},async()=>{
        if(!user||activeRoom!==room)return;
        if(dirty.has(room)){status('⚠ 其他老師已修改，本機尚有待存資料');return;}
        try{await loadRemote(room)}catch(e){status('雲端更新失敗：'+e.message);}
      }).subscribe();
  };
  async function openRoom(room){
    if(!membership(room))throw Error('沒有這個班級的存取權限');
    activeRoom=room;loadingRoom=true;
    if(app.currentRoom()!==room)app.selectRoom(room);
    const select=document.getElementById('cloudRoom');select.value=room;
    const writer=canWrite(room);
    const adminBtn=document.getElementById('adminNav');if(adminBtn)adminBtn.disabled=!writer;
    document.querySelectorAll('.resize-grip').forEach(btn=>{btn.style.pointerEvents=writer?'':'none';btn.style.opacity=writer?'':'.2'});
    document.getElementById('cloudUpload').style.display=writer?'':'none';
    if(!writer&&document.getElementById('adminView')&&!document.getElementById('adminView').classList.contains('hidden'))app.showBoard?.();
    subscribe(room);
    try{await loadRemote(room)}finally{loadingRoom=false;}
  }
  async function activate(session){
    const serial=++sessionSerial;
    for(const t of timers.values())clearTimeout(t);
    timers.clear();
    if(!session?.user){user=null;activeRoom=null;memberships=[];revisions.clear();verified.clear();pending.clear();dirty.clear();if(sub){db.removeChannel(sub);sub=null;}gate(true,'請登入後使用');return;}
    user=session.user;setGateStatus('正在確認班級權限…');gate(true);
    try{
      await reloadMemberships();
      if(serial!==sessionSerial)return;
      if(!memberships.length){gate(true,'此帳號尚未被授權任何班級，請學校管理員在 Supabase 新增成員');return;}
      const next=membership(app.currentRoom())?app.currentRoom():memberships[0].room;
      await openRoom(next);
      if(serial!==sessionSerial)return;
      gate(false);
      status(revisions.get(next)>0 ? ('✓ 雲端已載入 · '+next+(canWrite(next)?'':'（唯讀）')) : ('首次使用，請按「初始化本班」 · '+next));
    }catch(e){gate(true,'連線或權限設定錯誤：'+e.message);}
  }
  async function savePending(room){
    if(!user||!canWrite(room)||!verified.has(room)||!dirty.has(room))return;
    const payload=pending.get(room);
    if(!payload)return;
    let current=Number(revisions.get(room)||0);
    try{
      let result;
      if(current===0){
        result=await db.from('classroom_state').insert({room,payload,revision:1,updated_by:user.id}).select('revision').single();
      }else{
        result=await db.from('classroom_state')
          .update({payload,revision:current+1,updated_at:new Date().toISOString(),updated_by:user.id})
          .eq('room',room).eq('revision',current).select('revision').maybeSingle();
      }
      if(result.error)throw result.error;
      if(!result.data){status('⚠ 雲端版本衝突，已停止覆蓋');return;}
      revisions.set(room,result.data.revision);
      if(pending.get(room)===payload){pending.delete(room);dirty.delete(room);}
      status('✓ 雲端已儲存 · '+room);
      if(pending.has(room))planSave(room);
    }catch(e){status('⚠ 儲存失敗：'+e.message);}
  }
  function planSave(room){
    cancel(room);
    timers.set(room,setTimeout(()=>{timers.delete(room);void savePending(room);},850));
  }
  window.EXAM_CLOUD_SYNC={
    rooms(){return memberships.map(m=>m.room)},
    canWrite(room){return !!user&&canWrite(room)&&verified.has(room)&&!loadingRoom},
    canSwitch(room){return !!membership(room)},
    localChanged(room,payload){
      if(!user||loadingRoom||!membership(room)||!verified.has(room)||!payload)return;
      if(!canWrite(room)){status('此班為唯讀權限，無法儲存修改');return;}
      dirty.add(room);pending.set(room,payload);
      status('正在儲存到雲端…');planSave(room);
    },
    async roomChanged(room){
      if(!user)return;
      if(!membership(room)){status('沒有該班權限');if(activeRoom)app.selectRoom(activeRoom);return;}
      if(room===activeRoom)return;
      try{await openRoom(room);}catch(e){status(e.message);}
    }
  };
  document.getElementById('cloudGoogleLogin').addEventListener('click',async()=>{
    const btn=document.getElementById('cloudGoogleLogin');
    btn.disabled=true;
    setGateStatus('正在轉往 Google 安全登入…');
    const {error}=await db.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin+window.location.pathname}
    });
    if(error){btn.disabled=false;setGateStatus('Google 登入失敗：'+error.message)}
  });
  // The older password and email-link flows remain available for migration only.
  // Never enable them in Google-only mode unless explicitly approved by the school.
  if(config.allowEmailLogin===true)document.getElementById('cloudPasswordLogin').style.display='block';
  const query=new URLSearchParams(window.location.search);
  const authError=query.get('error_description')||query.get('error');
  if(authError)setGateStatus('Google 登入未完成：'+authError.slice(0,200));
  document.getElementById('cloudPilotExit').style.display='inline-block';
  document.getElementById('cloudPilotExit').addEventListener('click',()=>{
    try{localStorage.removeItem(pilotKey)}catch{}
    // Redirect to original board without leaving a Google login gate.
    window.location.replace(window.location.origin+window.location.pathname+'?cloud=local');
  });
  document.getElementById('cloudGateLogout').addEventListener('click',async()=>{await db.auth.signOut();});
  document.getElementById('cloudMagicLink').addEventListener('click',async()=>{
    const email=document.getElementById('cloudEmail').value.trim();
    if(!/^\S+@\S+\.\S+$/.test(email)){setGateStatus('請先輸入有效的電子郵件');return;}
    setGateStatus('正在寄送登入郵件…');
    const {error}=await db.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:true,emailRedirectTo:window.location.origin+window.location.pathname}
    });
    setGateStatus(error?'郵件登入失敗：'+error.message:'已提出寄送請求。請檢查信箱並點擊登入連結；如未收到，請向管理者確認郵件服務設定。');
  });
  document.getElementById('cloudLogin').addEventListener('submit',async(e)=>{
    e.preventDefault();setGateStatus('登入中…');
    const email=document.getElementById('cloudEmail').value.trim();
    const password=document.getElementById('cloudPassword').value;
    const {error}=await db.auth.signInWithPassword({email,password});
    document.getElementById('cloudPassword').value='';
    if(error)setGateStatus('登入失敗：'+error.message);
  });
  document.getElementById('cloudRoom').addEventListener('change',async(e)=>{try{await openRoom(e.target.value)}catch(err){status(err.message)}});
  document.getElementById('cloudSignOut').addEventListener('click',async()=>{await db.auth.signOut();});
  document.getElementById('cloudRefresh').addEventListener('click',async()=>{
    if(!activeRoom)return;
    if(dirty.has(activeRoom)&&!confirm('本機尚有未同步修改。要捨棄本機修改並重新載入雲端資料嗎？'))return;
    try{await loadRemote(activeRoom,true)}catch(e){status('重新同步失敗：'+e.message);}
  });
  document.getElementById('cloudUpload').addEventListener('click',async()=>{
    const room=activeRoom;if(!room||!canWrite(room)){status('沒有編輯權限');return;}
    if(revisions.get(room)>0){status('雲端已有此班資料，不允許初始化覆蓋');return;}
    if(!confirm('確定要將「'+room+'」的本機設定與名冊首次上傳到雲端嗎？請先確認沒有真實學生資料外洩風險。'))return;
    pending.set(room,app.serializeRoom(room));dirty.add(room);await savePending(room);
  });
  // INITIAL_SESSION already delivers the current session. A second getSession()
  // raced with it and could recreate the editor on mobile on every refresh.
  let authActivation=null;
  db.auth.onAuthStateChange((event,session)=>{
    if(!['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))return;
    const key=(session?.user?.id||'signed-out')+':'+(session?.access_token||'');
    if(event!=='SIGNED_OUT' && authActivation===key)return;
    authActivation=key;
    setTimeout(()=>{void activate(session)},0);
  });
})();