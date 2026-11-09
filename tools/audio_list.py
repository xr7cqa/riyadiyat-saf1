import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from clips import CLIPS, VOICES
ROLE = {'teacher': 'المعلمة', 'number': 'صوت الأعداد الثابت', 'companion': 'الشخصية المرافقة', 'man': 'رجل (الأب)', 'man2': 'رجل (البائع)', 'woman': 'امرأة (الأم/الجدة)', 'kidA': 'شخصية طفل (صوت امرأة)', 'kidB': 'شخصية طفلة (صوت امرأة)'}
out = ['# قائمة ملفات الصوت العامة', '', 'كل الملفات في `public/audio/` بصيغة mp3 أحادية 32kbps. تُولَّد بـ `python3 tools/gen_audio.py`.', '', '| الملف | الدور | الصوت | النص المنطوق |', '|---|---|---|---|']
for cid, (role, text) in CLIPS.items():
    out.append(f'| `{cid}.mp3` | {ROLE[role]} | {VOICES[role][0]} | {text} |')
out += ['', '## المقطعان الشخصيان (ليسا في المستودع)', '', '| الملف | النص |', '|---|---|', '| `p_greet` | الترحيب الشخصي باسم الطفل (يُضبط من لوحة ولي الأمر) |', '| `p_praise` | التشجيع الشخصي باسم الطفل، عند إنهاء اللعبة وإتقان الدرس |']
open(os.path.join(os.path.dirname(__file__), '..', 'docs', 'AUDIO.md'), 'w').write('\n'.join(out) + '\n')
print(len(CLIPS))
