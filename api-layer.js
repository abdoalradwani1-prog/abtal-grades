/* طبقة الاتصال بالخادم: تستبدل التخزين المحلي التجريبي بواجهة API آمنة */
async function api(method, url, body) {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (r.status === 401 && me) { me = null; db = { students: [], users: [], audit: [] }; render('انتهت الجلسة، سجّل الدخول من جديد'); }
  if (!r.ok) throw new Error(d.error || 'حدث خطأ، حاول مرة أخرى');
  return d;
}
db = { students: [], users: [], audit: [] };
async function load() { const d = await api('GET', '/api/data'); db = { students: d.students, users: [], audit: [], msg: d.msg || undefined }; }
async function init() { try { me = await api('GET', '/api/me'); await load(); } catch (e) { me = null; } render(); }
async function login() {
  const parent = lm === 'p';
  const code = parent ? nd($('pin').value) : $('tp').value.replace(/[^A-Za-z0-9]/g, '');
  if (parent && code.length !== PIN_LEN) return render('أدخل رمزاً من ' + ar(PIN_LEN) + ' أرقام');
  if (!parent && code.length !== 6) return render('أدخل رمزاً من ٦ خانات');
  try { me = await api('POST', '/api/login', { mode: parent ? 'p' : 's', code }); await load(); sel = null; render(); } catch (e) { render(e.message); }
}
async function logout() { try { await api('POST', '/api/logout', {}); } catch (e) {} me = null; db = { students: [], users: [], audit: [] }; render(); }
async function setS(id, key, el) {
  const s = db.students.find((x) => x.id === id); const t = nn(el.value), v = t === '' ? null : Number(t);
  const back = () => { el.value = s.g[key] ? ar(s.g[key].v) : ''; };
  if (v !== null && (!Number.isFinite(v) || v < 0 || v > 20)) { back(); return toast('الدرجة يجب أن تكون بين ٠ و٢٠'); }
  try { await api('PUT', '/api/grade', { id, key, v }); if (v === null) delete s.g[key]; else s.g[key] = { v, d: new Date().toISOString() }; render(); } catch (e) { back(); toast(e.message); }
}
async function bulk() {
  const ids = [...document.querySelectorAll('.ck:checked')].map((c) => c.value), key = $('bk').value, t = nn($('bv').value), v = Number(t);
  if (!ids.length || t === '' || !Number.isFinite(v) || v < 0 || v > 20) return toast('حدّد طلاباً وأدخل درجة صحيحة (٠-٢٠)');
  try { await api('POST', '/api/grades/bulk', { ids, key, v }); ids.forEach((id) => { const s = db.students.find((x) => x.id === id); if (s) s.g[key] = { v, d: new Date().toISOString() }; }); render(); toast('تم التعديل الجماعي ✅'); } catch (e) { toast(e.message); }
}
async function addS() {
  const n = $('nn').value.trim(); if (!n) return;
  try {
    const r = await api('POST', '/api/students', { list: [{ name: n, cls: $('nc').value.trim() || '6/1', contact: $('nt').value.trim() }] }); await load(); render();
    const c = r.created[0];
    $('out').innerHTML = c ? `<p class="err">الرمز السري لولي أمر ${esc(c.name)}: <b>${esc(c.pin)}</b> — سلّمه لولي الأمر الآن (لا يُعرض مرة أخرى)</p>` : '<p class="m">الطالب موجود مسبقاً في نفس الفصل.</p>';
  } catch (e) { toast(e.message); }
}
async function doImp() {
  const mp = {}; FM.forEach(([k], i) => (mp[k] = Number($('m' + i).value)));
  if (mp.name < 0) return toast('حدّد عمود الاسم');
  const list = []; let bad = 0;
  for (const r of mapCtx.rows) {
    const name = String(r[mp.name]).trim(); if (!name) continue; const g = {};
    keys.forEach((k) => { if (mp[k] >= 0 && r[mp[k]] !== '') { const t = nn(r[mp[k]]), v = t === '' ? NaN : Number(t); if (Number.isFinite(v) && v >= 0 && v <= 20) g[k] = v; else bad++; } });
    list.push({ name, cls: mp.cls >= 0 ? String(r[mp.cls]).trim() || '6/1' : '6/1', contact: mp.contact >= 0 ? String(r[mp.contact]).trim() : '', g });
  }
  if (!list.length) return toast('لا توجد أسماء صالحة في الملف');
  try {
    const r = await api('POST', '/api/students', { list }); await load(); render();
    const cr = r.created.map((c) => ({ id: c.id, name: c.name, cls: c.cls, pw: c.pin, contact: c.contact })); window._cr = cr;
    $('out').innerHTML = `<div class="card"><p>تم: ${cr.length} جديد، ${r.updated} محدَّث، ${bad + r.rejected} قيمة مرفوضة.</p>${cr.length ? `<div class="sc"><table><tr><th>الاسم</th><th>الفصل</th><th>الرمز السري</th></tr>${cr.map((c) => `<tr><td style="text-align:right">${esc(c.name)}</td><td>${esc(c.cls)}</td><td><b>${esc(c.pw)}</b></td></tr>`).join('')}</table></div><button class="p" onclick='dlCred()'>تنزيل الرموز السرية لأولياء الأمور (Excel)</button><p class="m">الرموز تظهر الآن مرة واحدة فقط؛ نزّلها وسلّمها لأولياء الأمور ثم احذف الملف.</p>` : ''}</div>`;
  } catch (e) { toast(e.message); }
}
async function rpw(id) {
  try { const r = await api('POST', '/api/students/' + encodeURIComponent(id) + '/pin', {}); const s = db.students.find((x) => x.id === id); $('out').innerHTML = `<p class="err">الرمز السري الجديد لـ ${esc(s ? s.name : '')}: <b>${esc(r.pin)}</b></p>`; $('out').scrollIntoView({ behavior: 'smooth' }); } catch (e) { toast(e.message); }
}
async function del2(id) { try { await api('DELETE', '/api/students/' + encodeURIComponent(id), {}); db.students = db.students.filter((x) => x.id !== id); render(); } catch (e) { toast(e.message); } }
async function saveMsg() { const t = $('mt').value.trim(); try { await api('PUT', '/api/message', { text: t }); db.msg = t || undefined; render(); toast('تم حفظ الرسالة ✅'); } catch (e) { toast(e.message); } }
async function doChpw() {
  const p = $('np').value;
  if (!/^[A-Za-z0-9]{6}$/.test(p) || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return toast('الرمز ٦ خانات ويحتوي حرفاً صغيراً وحرفاً كبيراً ورقماً');
  try { await api('POST', '/api/staff/code', { code: p }); closeM(); toast('تم تغيير الرمز بنجاح ✅'); } catch (e) { toast(e.message); }
}
async function bk() {
  if (me.role !== 'manager') return toast('النسخ الاحتياطي من صلاحية المدير');
  const r = await fetch('/api/backup', { credentials: 'same-origin' }); if (!r.ok) return toast('تعذّر إنشاء النسخة');
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'grades-backup-' + new Date().toISOString().slice(0, 10) + '.db'; a.click();
}
function rs() { toast('الاستعادة تتم من الخادم (راجع دليل النشر)'); }
init();
