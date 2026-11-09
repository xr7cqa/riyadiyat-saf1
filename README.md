# riyadiyat-saf1 — رياضيات الصف الأول (تجربة)
موقع تعليمي تفاعلي (PWA يعمل بلا إنترنت) لطفل في الصف الأول الأساسي، مبني على مهارات كتاب الرياضيات اليمني (الجزء الثاني). هذه النسخة: الأساس + الدروس ٦-١ إلى ٦-٥.
- المصدر: `public/` — البناء: `python3 tools/build.py` ← `dist/`
- الصوت: `tools/clips.py` + `tools/gen_audio.py` (edge-tts) — القائمة: `docs/AUDIO.md`
- الاختبارات: `node tests/check_questions.mjs` و`python3 tests/e2e.py 360 640` و`python3 tests/p20.py 360 640` (التصميم الجديد) و`python3 tests/sw_offline.py`
- الرسومات: مولّدة بالذكاء الاصطناعي ومقصوصة بـ `tools/art_prep.py` ← `public/img/` (المصادر خارج المستودع)
- القواعد وخريطة الدروس: `docs/RULES.md`
اسم الطفل مدمج في الموقع بطلب ولي الأمر؛ لا يحتوي المستودع تسجيلات الأهل ولا الكتاب أو صوره.
