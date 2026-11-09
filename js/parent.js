// Parent panel (locked: press-and-hold, then a sum a young child cannot do)
import { S, save, reset, lesson as L, putClip, getClip, delClip } from './store.js';
import { ar, num, toLatin, todayKey, fmtDate, esc, rint } from './fmt.js';
import { say, loadPersonal, hasPersonal, stop } from './audio.js';
import { h, $, $$ } from './engine.js';
import { LESSONS, FOUNDATION, UNIT6 } from './content-u6.js';
import { offlineStatus } from './pwa.js';

// The child's name is built into the site (parent's explicit request): clips name_greet / name_praise.
// A recording made or imported here (kept on this phone only) overrides the built-in clip.
export const CHILD_NAME = 'مَالِكْ شَمَّةْ';
export const PERSONAL = {
  p_greet: { label: 'الترحيب الشخصي', text: (n) => `أَهْلًا يَا ${n}! هَيَّا نَلْعَبُ وَنَتَعَلَّمُ الرِّيَاضِيَّاتِ` },
  p_praise: { label: 'التشجيع الشخصي', text: (n) => `أَحْسَنْتَ يَا ${n}` },
};
const STAGE = { new: 'لم يبدأ', learning: 'يتدرّب', confirm: 'نجح مرة، ينتظر التأكيد في جلسة لاحقة', mastered: 'أتقنه ✓' };

export function holdToOpen(btn, onOpen) {
  let t = null;
  const start = (e) => { e.preventDefault(); btn.classList.add('holding'); t = setTimeout(() => { btn.classList.remove('holding'); askLock(onOpen); }, 2000); };
  const end = () => { clearTimeout(t); btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', end); btn.addEventListener('pointerleave', end); btn.addEventListener('pointercancel', end);
  btn.addEventListener('click', (e) => e.preventDefault());
}
export function askLock(onOpen, title = 'لوحة ولي الأمر') {
  const a = rint(12, 19), b = rint(3, 6);
  const dlg = h(`<div class="modal lock"><div class="box"><h3>${title}</h3><p class="who">لولي الأمر فقط</p><p>اكتب ناتج: ${num(a)} × ${num(b)}</p>
     <div class="pin" dir="ltr"></div><div class="keys" dir="ltr">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button data-d="${d}">${ar(d)}</button>`).join('')}<button data-d="x">⌫</button></div>
     <div class="row"><button class="btn ok">فتح</button><button class="btn ghost cancel">إلغاء</button></div></div></div>`);
  document.body.appendChild(dlg);
  let v = '';
  const show = () => ($('.pin', dlg).textContent = ar(v));
  $('.keys', dlg).onclick = (e) => { const d = e.target.dataset.d; if (d == null) return; v = d === 'x' ? v.slice(0, -1) : (v + d).slice(0, 4); show(); };
  $('.cancel', dlg).onclick = () => dlg.remove();
  $('.ok', dlg).onclick = () => { if (+toLatin(v) === a * b) { dlg.remove(); onOpen(); } else { v = ''; show(); $('.box', dlg).classList.add('shake'); setTimeout(() => $('.box', dlg).classList.remove('shake'), 500); } };
}

function summary() {
  const st = S();
  const mastered = LESSONS.filter((l) => L(l.id).stage === 'mastered');
  const learning = LESSONS.filter((l) => ['learning', 'confirm'].includes(L(l.id).stage));
  let reach = mastered.length ? Math.max(...mastered.map((l) => l.range[1])) : (st.foundation.skills.count?.status === 'ok' ? 10 : 0);
  const weakF = Object.entries(st.foundation.skills).filter(([, v]) => v.status === 'weak').map(([k]) => k);
  const errCount = {};
  st.errors.slice(0, 20).forEach((e) => { const k = e.lesson || e.skill; errCount[k] = (errCount[k] || 0) + 1; });
  const worst = Object.entries(errCount).sort((a, b) => b[1] - a[1])[0];
  let need = null, home = null;
  if (weakF.length) { need = FOUNDATION[weakF[0]].name; home = FOUNDATION[weakF[0]].home; }
  else if (worst) { const l = LESSONS.find((x) => x.id === worst[0]); if (l) { need = l.skill; home = l.home; } else if (FOUNDATION[worst[0]]) { need = FOUNDATION[worst[0]].name; home = FOUNDATION[worst[0]].home; } }
  const next = LESSONS.find((l) => L(l.id).stage !== 'mastered');
  if (!need && next) { need = next.skill; home = next.home; }
  if (!st.foundation.done) return { text: 'لم يلعب جولة التعارف بعد. افتحوا اللعب معه أول مرة.', home: LESSONS[0].home };
  const reachTxt = reach ? `يعدّ ويكوّن الأعداد حتى ${num(reach)}` : 'بدأ التعلّم';
  return { text: `${reachTxt}${need ? `، ويحتاج يتدرّب على: ${need}` : '، وأتقن كل دروس هذه التجربة'}.`, home };
}

export function openParent(app, { onClose }) {
  stop();
  const st = S();
  const sm = summary();
  const days = Object.entries(st.usage).sort().slice(-7);
  const el = h(`<div class="screen parent">
   <header class="ptop"><h2>لوحة ولي الأمر</h2><button class="btn close">رجوع للعب</button></header>
   <section><h3>أين وصل</h3><p class="sum">${sm.text}</p><div class="homeact"><b>نشاط بيت (دقيقة):</b> ${sm.home}</div></section>
   <section><h3>الدروس (الوحدة ${num(6)}: ${UNIT6.title})</h3><ul class="lessons">${LESSONS.map((l) => { const x = L(l.id); return `<li><span>درس ${l.code} ص ${num(l.page)}: ${l.title}</span><em class="st-${x.stage}">${STAGE[x.stage]}</em><small>محاولات ${num(x.attempts)}، صحيحة ${num(x.correct)}</small></li>`; }).join('')}</ul>
     <p class="hint">لتشغيل أي درس مباشرة: المسوا عنوانه في «فهرس الدروس» بالشاشة الرئيسية ثم أجيبوا سؤال ولي الأمر.</p></section>
   <section><h3>أساسات الترم الأول</h3><ul class="found">${Object.entries(FOUNDATION).map(([k, f]) => { const s = st.foundation.skills[k]; return `<li>${f.name}: <em>${!s ? 'لم تُفحص بعد' : s.status === 'weak' ? 'يحتاج تدريب' : 'جيد'}</em></li>`; }).join('')}</ul></section>
   <section><h3>أخطاء حقيقية حديثة</h3>${st.errors.length ? `<ul class="errs">${st.errors.slice(0, 8).map((e) => `<li><small>${fmtDate(new Date(e.d))}</small> ${esc(e.text)}</li>`).join('')}</ul>` : '<p>لا أخطاء مسجّلة بعد.</p>'}
     <p class="note">اللمسات التي سقطت خارج مكانها لا تُحسب أخطاء (عددها: ${num(st.misses)}).</p></section>
   <section><h3>الاستخدام</h3>${days.length ? `<ul class="usage">${days.map(([d, s]) => `<li>${fmtDate(new Date(d))}: ${num(Math.max(1, Math.round(s / 60)))} دقيقة</li>`).join('')}</ul>` : '<p>لا استخدام بعد.</p>'}<p>عدد الجلسات: ${num(st.sessions.count)} — النجوم: ${num(st.stars)}</p></section>
   <section><h3>التحكم</h3>
     <button class="btn extra">${st.sessions.extraDay === todayKey() ? 'الجلسة الإضافية مفتوحة ✓' : 'فتح جلسة إضافية اليوم'}</button>
     <label class="sel">مستوى الصوت <input type="range" class="vol" min="0" max="1" step="0.05" value="${st.settings.volume}"></label><button class="btn ghost test">تجربة الصوت</button>
     <button class="btn danger reset">إعادة ضبط التقدم</button></section>
   <section><h3>اسم الطفل وصوته</h3><p class="note">الاسم «مالك شمّة» مدمج في الموقع: ترحيب عند أول ضغطة، وتشجيع بالاسم مع الإجابات الصحيحة بالتناوب، ودائمًا في نهاية اللعبة. إن سجّلتم أو استوردتم مقطعًا هنا يُشغَّل بدل المقطع المدمج (يُحفظ على هذا الجوال فقط).</p>
     <label class="sel">اسم الطفل بالتشكيل (للشهادة): <input class="cname" value="${esc(st.settings.childName || CHILD_NAME)}" maxlength="30"></label>
     ${Object.entries(PERSONAL).map(([k, p]) => `<div class="pclip" data-k="${k}"><b>${p.label}</b><p class="ptext">النص الذي يُسجَّل: «${esc(p.text(st.settings.childName || CHILD_NAME))}»</p>
       <div class="row"><button class="btn rec">🎙️ سجّل</button><label class="btn ghost imp">📁 استيراد ملف<input type="file" accept="audio/*" hidden></label><button class="btn ghost play">▶ استمع</button><button class="btn ghost del">حذف</button></div><small class="pstat">${hasPersonal(k) ? 'تسجيلكم محفوظ ✓ (يُشغَّل بدل المقطع المدمج)' : 'يُشغَّل المقطع المدمج بالاسم'}</small></div>`).join('')}
     <button class="btn ghost cert">معاينة الشهادة</button></section>
   <section><h3>التشغيل بدون نت</h3><p class="offline">جارٍ الفحص…</p><button class="btn ghost recheck">افحص الآن</button></section>
   <footer class="ver">نسخة ${ar(window.__VERSION__ || '')}</footer>
  </div>`);
  app.innerHTML = ''; app.appendChild(el);
  $('.close', el).onclick = () => onClose();
  $('.extra', el).onclick = (e) => { st.sessions.extraDay = todayKey(); save(); e.target.textContent = 'الجلسة الإضافية مفتوحة ✓'; };
  $('.vol', el).oninput = (e) => { st.settings.volume = +e.target.value; save(); };
  $('.test', el).onclick = () => say('t_welcome');
  $('.reset', el).onclick = () => { if (confirm('سيُمسح التقدم والنجوم. هل أنت متأكد؟') && confirm('تأكيد أخير: إعادة الضبط؟')) { reset(); onClose(); } };
  $('.cname', el).onchange = (e) => { st.settings.childName = e.target.value.trim(); save(); $$('.pclip', el).forEach((b) => { $('.ptext', b).textContent = `النص الذي يُسجَّل: «${PERSONAL[b.dataset.k].text(st.settings.childName || CHILD_NAME)}»`; }); };
  $('.cert', el).onclick = () => certificate();
  $$('.pclip', el).forEach((box) => wireClip(box));
  const chk = async () => { const s = await offlineStatus(); $('.offline', el).innerHTML = s.ready ? '<b class="ready">جاهز بدون نت ✓</b> تم تنزيل كل الدروس والأصوات على هذا الجوال.' : `لم يكتمل التنزيل بعد: ${num(s.have)} من ${num(s.total)} ملفًا. افتحوا الموقع والإنترنت متاح قليلًا.`; };
  $('.recheck', el).onclick = chk; chk();
}

function wireClip(box) {
  const k = box.dataset.k; const stat = $('.pstat', box);
  let rec = null, chunks = [];
  const done = async (blob) => { await putClip(k, blob); await loadPersonal(); stat.textContent = 'تسجيلكم محفوظ ✓ (يُشغَّل بدل المقطع المدمج)'; };
  $('.rec', box).onclick = async (e) => {
    const b = e.target;
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream); chunks = [];
      rec.ondataavailable = (ev) => chunks.push(ev.data);
      rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); b.textContent = '🎙️ سجّل'; const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); rec = null; await done(blob); };
      rec.start(); b.textContent = '⏹ أوقف التسجيل';
    } catch (err) { stat.textContent = 'تعذّر فتح المايك. يمكن استيراد ملف بدلًا من ذلك.'; }
  };
  $('input[type=file]', box).onchange = async (e) => { const f = e.target.files[0]; if (f) await done(f); };
  $('.play', box).onclick = () => say(hasPersonal(k) ? k : (k === 'p_greet' ? 'name_greet' : 'name_praise'));
  $('.del', box).onclick = async () => { await delClip(k); await loadPersonal(); stat.textContent = 'يُشغَّل المقطع المدمج بالاسم'; };
}

export function certificate() {
  const st = S(); const name = st.settings.childName || CHILD_NAME;
  const c = document.createElement('canvas'); c.width = 1200; c.height = 850; const g = c.getContext('2d');
  g.fillStyle = '#fff8e7'; g.fillRect(0, 0, 1200, 850);
  g.strokeStyle = '#ff7aa8'; g.lineWidth = 18; g.strokeRect(30, 30, 1140, 790);
  g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#5b2a86';
  g.font = 'bold 72px "Noto Naskh Arabic", "Amiri", serif'; g.fillText('شهادة تقدير', 600, 170);
  g.font = '44px "Noto Naskh Arabic", "Amiri", serif'; g.fillStyle = '#333';
  g.fillText('نهنّئ البطل', 600, 280);
  g.font = 'bold 80px "Noto Naskh Arabic", "Amiri", serif'; g.fillStyle = '#e65100'; g.fillText(name, 600, 390);
  g.font = '42px "Noto Naskh Arabic", "Amiri", serif'; g.fillStyle = '#333';
  const done = LESSONS.filter((l) => L(l.id).stage === 'mastered').length;
  g.fillText(`على إتقان دروس الوحدة ${ar(6)}: ${UNIT6.title}`, 600, 500);
  g.fillText(`أتقن ${ar(done)} من ${ar(LESSONS.length)} دروس (نسخة التجربة)`, 600, 570);
  g.fillText(fmtDate(new Date()), 600, 660);
  g.font = '60px serif'; g.fillText('⭐ ⭐ ⭐', 600, 760);
  const a = document.createElement('a'); a.download = 'shahada-wahda-6.png'; a.href = c.toDataURL('image/png'); a.click();
}
