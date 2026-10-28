/* طبقة الاتصال بـ Firebase (مصادقة + Firestore). ضع إعدادات مشروعك مكان PASTE_HERE */
const FB={apiKey:"AIzaSyB93hy9KV98GI0kFX7d_2D-py-6zWVghQA",authDomain:"abtal-grades.firebaseapp.com",projectId:"abtal-grades",storageBucket:"abtal-grades.firebasestorage.app",messagingSenderId:"978541722047",appId:"1:978541722047:web:1b8b652aa53f6b7b01890a"};
const EM={teacher:'teacher@grades-sa.app',manager:'manager@grades-sa.app'};
const ROLE_NAME={teacher:'المعلم',manager:'المدير'};
const FU='https://www.gstatic.com/firebasejs/10.14.1/';
let FA,FS,auth,fs;
const ready=(async()=>{
  const [app,a,s]=await Promise.all([import(FU+'firebase-app.js'),import(FU+'firebase-auth.js'),import(FU+'firebase-firestore.js')]);
  FA=a;FS=s;const ap=app.initializeApp(FB);auth=FA.getAuth(ap);await FA.setPersistence(auth,FA.browserSessionPersistence);fs=FS.getFirestore(ap);
})();
db={students:[],users:[],audit:[]};
// رمز ولي الأمر: ١٠ خانات عشوائية من ٣١ رمزاً (بدون الحروف المتشابهة) — غير قابل للتخمين
const ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode=()=>{let s='';while(s.length<10)for(const x of crypto.getRandomValues(new Uint8Array(16)))if(x<248&&s.length<10)s+=ALPHA[x%31];return s};
const fmt=c=>c.slice(0,5)+'-'+c.slice(5);
const normCode=s=>String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toUpperCase().replace(/[^A-Z0-9]/g,'');
const link=c=>location.origin+location.pathname+'#c='+c;
const roleOf=e=>Object.keys(EM).find(r=>EM[r]===e);
const gObj=s=>Object.fromEntries(Object.entries(s.g).map(([k,e])=>[k,e.v]));
const toS=d=>{const x=d.data(),g={};for(const k of keys)if(typeof(x.g||{})[k]==='number')g[k]={v:x.g[k]};return{id:d.id,name:x.name,cls:x.cls,g}};
const codeCard=(n,code)=>`<p class="err">رمز دخول ولي أمر ${esc(n)}: <b class="keep" dir="ltr">${fmt(code)}</b><br>رابط الدخول المباشر: <span class="keep" dir="ltr" style="word-break:break-all">${esc(link(code))}</span></p>`;
async function commit(ops){for(let i=0;i<ops.length;i+=400){const b=FS.writeBatch(fs);ops.slice(i,i+400).forEach(f=>f(b));await b.commit()}}
const addOps=(ops,code,n,c,contact,g)=>{ops.push(b=>b.set(FS.doc(fs,'portal',code),{name:n,cls:c,g}));if(contact)ops.push(b=>b.set(FS.doc(fs,'contacts',code),{contact}))};

// سجل التدقيق: إضافة فقط، ويقرؤه المدير وحده
async function aud(a){if(!me||me.role==='student'||!auth.currentUser)return;try{await FS.addDoc(FS.collection(fs,'audit'),{t:FS.serverTimestamp(),by:auth.currentUser.email,a:String(a).slice(0,300)})}catch(e){}}
log=a=>{aud(a)};

let idleT=null;
function armIdle(){clearTimeout(idleT);if(!me)return;idleT=setTimeout(()=>{logout();toast('انتهت الجلسة لعدم النشاط')},(me.role==='student'?15:30)*60000)}
['click','keydown','touchstart'].forEach(ev=>addEventListener(ev,()=>{if(me)armIdle()},{passive:true}));

async function load(){
  if(me.role==='student'){const d=await FS.getDoc(FS.doc(fs,'portal',me.sid));if(!d.exists())throw new Error('x');db.students=[toS(d)]}
  else{const q=await FS.getDocs(FS.collection(fs,'portal'));db.students=q.docs.map(toS).sort((a,b)=>a.cls.localeCompare(b.cls,'ar')||a.name.localeCompare(b.name,'ar'))}
  db.audit=[];
  if(me.role==='manager'){try{const q=await FS.getDocs(FS.query(FS.collection(fs,'audit'),FS.orderBy('t','desc'),FS.limit(200)));db.audit=q.docs.map(d=>{const x=d.data();return{t:x.t?x.t.toDate().toISOString():new Date().toISOString(),by:(roleOf(x.by)?ROLE_NAME[roleOf(x.by)]:x.by),a:x.a}})}catch(e){}}
  try{const m=await FS.getDoc(FS.doc(fs,'settings','msg'));db.msg=m.exists()?m.data().text:undefined}catch(e){db.msg=undefined}
}
async function init(){
  try{
    await ready;await auth.authStateReady();
    const u=auth.currentUser;
    if(u&&!u.isAnonymous){const r=roleOf(u.email);if(r){me={role:r,name:ROLE_NAME[r]};try{await load()}catch(e){me=null}}else await FA.signOut(auth)}
  }catch(e){}
  render();armIdle();
  const m=/#c=([A-Za-z0-9\-]+)/.exec(location.hash);
  if(m&&!me){history.replaceState(null,'',location.pathname+location.search);lm='p';render();$('pin').value=m[1].toUpperCase();login()}
}
async function login(){
  if(Date.now()<lock)return render('محاولات كثيرة، انتظر '+Math.ceil((lock-Date.now())/1000)+' ثانية');
  const bad=m=>{if(++fails>=5){lock=Date.now()+Math.min(30000*2**strikes++,3600000);fails=0}render(m)};
  try{
    await ready;
    if(lm==='p'){
      const code=normCode($('pin').value);if(code.length!==10)return render('أدخل الرمز كاملاً (١٠ خانات)');
      if(!auth.currentUser)await FA.signInAnonymously(auth);
      const d=await FS.getDoc(FS.doc(fs,'portal',code));
      if(!d.exists())return bad('الرمز غير صحيح');
      me={role:'student',name:d.data().name,sid:code};
    }else{
      const code=$('tp').value.replace(/[^A-Za-z0-9]/g,'');if(code.length<6)return render('أدخل رمز الدخول');
      if(auth.currentUser)await FA.signOut(auth);
      let role=null;
      for(const r of Object.keys(EM)){try{await FA.signInWithEmailAndPassword(auth,EM[r],code);role=r;break}catch(e){if(e.code==='auth/too-many-requests')return render('محاولات كثيرة، حاول لاحقاً')}}
      if(!role)return bad('بيانات الدخول غير صحيحة');
      me={role,name:ROLE_NAME[role]};
    }
    await load();fails=0;strikes=0;sel=null;armIdle();render();aud('تسجيل دخول');
  }catch(e){me=null;try{if(auth&&auth.currentUser&&!auth.currentUser.isAnonymous)await FA.signOut(auth)}catch(x){}render('تعذر الدخول، تحقق من الاتصال وحاول مجدداً')}
}
async function logout(){await aud('تسجيل خروج');clearTimeout(idleT);try{await FA.signOut(auth)}catch(e){}me=null;db={students:[],users:[],audit:[]};render()}

async function setS(id,key,el){
  const s=db.students.find(x=>x.id===id),t=nn(el.value),v=t===''?null:Math.round(Number(t)*100)/100;
  const back=()=>{el.value=s.g[key]?ar(s.g[key].v):''};
  if(v!==null&&(!Number.isFinite(v)||v<0||v>20)){back();return toast('الدرجة يجب أن تكون بين ٠ و٢٠')}
  const old=s.g[key]?.v;
  try{await FS.updateDoc(FS.doc(fs,'portal',id),{['g.'+key]:v===null?FS.deleteField():v});
    if(v===null)delete s.g[key];else s.g[key]={v};aud(`تعديل ${s.name} – ${lbl(key)}: ${old??'—'} ← ${v??'—'}`);render()}
  catch(e){back();toast('تعذر الحفظ، تحقق من الاتصال')}
}
async function bulk(){
  const ids=[...document.querySelectorAll('.ck:checked')].map(c=>c.value),key=$('bk').value,t=nn($('bv').value),v=Number(t);
  if(!ids.length||t===''||!Number.isFinite(v)||v<0||v>20)return toast('حدّد طلاباً وأدخل درجة صحيحة (٠-٢٠)');
  try{await commit(ids.map(id=>b=>b.update(FS.doc(fs,'portal',id),{['g.'+key]:v})));ids.forEach(id=>{const s=db.students.find(x=>x.id===id);if(s)s.g[key]={v}});aud(`تعديل جماعي (${ids.length}) – ${lbl(key)} = ${v}`);render();toast('تم التعديل الجماعي ✅')}catch(e){toast('تعذر التعديل الجماعي')}
}
async function addS(){
  const n=$('nn').value.trim().slice(0,100);if(!n)return;
  const c=$('nc').value.trim().slice(0,20)||'6/1',ct=$('nt').value.trim().slice(0,100);
  if(db.students.some(x=>x.name===n&&x.cls===c))return toast('الطالب موجود مسبقاً في نفس الفصل');
  const code=newCode(),ops=[];addOps(ops,code,n,c,ct,{});
  try{await commit(ops);aud('إضافة طالب: '+n);await load();render();$('out').innerHTML=codeCard(n,code)}catch(e){toast('تعذرت الإضافة')}
}
async function doImp(){
  const mp={};FM.forEach(([k],i)=>mp[k]=Number($('m'+i).value));
  if(mp.name<0)return toast('حدّد عمود الاسم');
  const ops=[],cr=[],seen={};let upd=0,bad=0;
  for(const r of mapCtx.rows){
    const name=String(r[mp.name]).trim().slice(0,100);if(!name)continue;
    const cls=(mp.cls>=0?String(r[mp.cls]).trim().slice(0,20):'')||'6/1',k0=name+'|'+cls,g={};
    keys.forEach(k=>{if(mp[k]>=0&&r[mp[k]]!==''){const t=nn(r[mp[k]]),v=t===''?NaN:Number(t);if(Number.isFinite(v)&&v>=0&&v<=20)g[k]=Math.round(v*100)/100;else bad++}});
    let code=(db.students.find(x=>x.name===name&&x.cls===cls)||{}).id||seen[k0];
    if(code){upd++;if(Object.keys(g).length){const up={};for(const k in g)up['g.'+k]=g[k];const c0=code;ops.push(b=>b.update(FS.doc(fs,'portal',c0),up))}}
    else{code=newCode();seen[k0]=code;const ct=mp.contact>=0?String(r[mp.contact]).trim().slice(0,100):'';addOps(ops,code,name,cls,ct,g);cr.push({name,cls,pw:code,contact:ct})}
  }
  if(!ops.length)return toast('لا توجد بيانات صالحة في الملف');
  try{
    await commit(ops);aud(`استيراد Excel: جديد ${cr.length}، محدَّث ${upd}، قيم مرفوضة ${bad}`);await load();render();window._cr=cr;
    $('out').innerHTML=`<div class="card"><p>تم: ${cr.length} جديد، ${upd} محدَّث، ${bad} قيمة مرفوضة.</p>${cr.length?`<div class="sc"><table><tr><th>الاسم</th><th>الفصل</th><th>رمز الدخول</th></tr>${cr.map(c=>`<tr><td style="text-align:right">${esc(c.name)}</td><td>${esc(c.cls)}</td><td><b class="keep" dir="ltr">${fmt(c.pw)}</b></td></tr>`).join('')}</table></div><button class="p" onclick="dlCred()">تنزيل رموز الدخول وروابطها (Excel)</button><p class="m">سلّم كل رمز لولي أمر الطالب المعني فقط، واحذف الملف بعد التوزيع.</p>`:''}</div>`;
  }catch(e){toast('تعذر الاستيراد (صلاحيات أو اتصال)')}
}
function dlCred(){
  const ws=XLSX.utils.json_to_sheet(window._cr.map(c=>({'اسم الطالب':c.name,'الفصل':c.cls,'رمز الدخول':fmt(c.pw),'رابط الدخول':link(c.pw),'جهة التواصل':c.contact})));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Codes');XLSX.writeFile(wb,'parent-codes.xlsx');aud('تنزيل رموز أولياء الأمور');
}
async function rpw(id){
  try{
    const s=db.students.find(x=>x.id===id),nc=newCode(),old=await FS.getDoc(FS.doc(fs,'contacts',id)),ops=[];
    ops.push(b=>b.set(FS.doc(fs,'portal',nc),{name:s.name,cls:s.cls,g:gObj(s)}));
    if(old.exists())ops.push(b=>b.set(FS.doc(fs,'contacts',nc),old.data()));
    ops.push(b=>b.delete(FS.doc(fs,'portal',id)),b=>b.delete(FS.doc(fs,'contacts',id)));
    await commit(ops);aud('رمز جديد لولي أمر: '+s.name);await load();render();$('out').innerHTML=codeCard(s.name,nc);$('out').scrollIntoView({behavior:'smooth'});
  }catch(e){toast('تعذر إصدار رمز جديد')}
}
async function del2(id){
  try{const s=db.students.find(x=>x.id===id);await commit([b=>b.delete(FS.doc(fs,'portal',id)),b=>b.delete(FS.doc(fs,'contacts',id))]);db.students=db.students.filter(x=>x.id!==id);aud('حذف طالب: '+(s?s.name:''));render()}catch(e){toast('تعذر الحذف')}
}
async function saveMsg(){
  const t=$('mt').value.trim().slice(0,2000),use=t&&t!==DEFMSG;
  try{if(use)await FS.setDoc(FS.doc(fs,'settings','msg'),{text:t});else await FS.deleteDoc(FS.doc(fs,'settings','msg'));db.msg=use?t:undefined;aud('تحديث رسالة ولي الأمر');render();toast('تم حفظ الرسالة ✅')}catch(e){toast('تعذر حفظ الرسالة')}
}
async function doChpw(){
  const p=$('np').value;
  if(!/^[A-Za-z0-9]{8,12}$/.test(p)||!/[a-z]/.test(p)||!/[A-Z]/.test(p)||!/[0-9]/.test(p))return toast('الرمز من ٨ إلى ١٢ خانة ويحتوي حرفاً صغيراً وحرفاً كبيراً ورقماً');
  try{await FA.updatePassword(auth.currentUser,p);aud('تغيير رمز الدخول');closeM();toast('تم تغيير الرمز بنجاح ✅')}catch(e){toast(e.code==='auth/requires-recent-login'?'سجّل الخروج ثم الدخول وأعد المحاولة':'تعذر تغيير الرمز')}
}
async function bk(){
  try{
    const q=await FS.getDocs(FS.collection(fs,'contacts')),ct={};q.docs.forEach(d=>ct[d.id]=d.data().contact);
    const out={v:1,students:db.students.map(s=>({id:s.id,name:s.name,cls:s.cls,g:gObj(s),contact:ct[s.id]||''}))};
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.download='grades-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();aud('تنزيل نسخة احتياطية');
  }catch(e){toast('تعذر إنشاء النسخة')}
}
function rs(el){
  const f=el.files[0];if(!f)return;
  ask('سيُضاف الطلاب الموجودون في الملف أو تُحدَّث بياناتهم. متابعة؟',()=>{const r=new FileReader();r.onload=async e=>{
    try{const d=JSON.parse(e.target.result);if(!Array.isArray(d.students))throw 0;const ops=[];
      for(const s of d.students){if(!/^[A-HJ-KM-NP-Z2-9]{10}$/.test(s.id))continue;ops.push(b=>b.set(FS.doc(fs,'portal',s.id),{name:String(s.name).slice(0,100),cls:String(s.cls).slice(0,20),g:s.g||{}}));if(s.contact)ops.push(b=>b.set(FS.doc(fs,'contacts',s.id),{contact:String(s.contact).slice(0,100)}))}
      await commit(ops);aud('استعادة نسخة احتياطية');await load();render();toast('تمت الاستعادة ✅')}catch(x){toast('ملف غير صالح')}};r.readAsText(f)});
}
init();
