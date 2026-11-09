import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from clips import CLIPS, VOICES
ROLE = {'teacher': 'المعلمة', 'number': 'صوت الأعداد الثابت', 'number0': 'صوت الأعداد الثابت (أبطأ قليلًا)', 'companion': 'الشخصية المرافقة', 'tjoy': 'المعلمة (فرحة)', 'tkind': 'المعلمة (لطيفة عند الخطأ)', 'cjoy': 'الشخصية المرافقة (فرحة)', 'ckind': 'الشخصية المرافقة (لطيفة)', 'man': 'رجل (الأب)', 'man2': 'رجل (البائع)', 'woman': 'امرأة (الأم/الجدة)', 'kidA': 'شخصية طفل (صوت امرأة)', 'kidB': 'شخصية طفلة (صوت امرأة)'}
out = ['# قائمة ملفات الصوت العامة', '', 'كل الملفات في `public/audio/` بصيغة mp3 أحادية 64kbps / 24kHz (المصدر من edge-tts بجودة 96kbps، يُقص الصمت بـ ffmpeg). تُولَّد بـ `python3 tools/gen_audio.py`. الاسم المدمج: `name_greet` و`name_praise` (يُكتب للمحرك «شَمَّهْ» حتى يُنطق «شمّة»).', '', '| الملف | الدور | الصوت | النص المنطوق |', '|---|---|---|---|']
for cid, (role, text) in CLIPS.items():
    out.append(f'| `{cid}.mp3` | {ROLE[role]} | {VOICES[role][0]} | {text} |')
out += ['', '## التسجيلات الشخصية (اختيارية، على الجوال فقط، تُشغَّل بدل المقطعين المدمجين)', '', '| الملف | النص |', '|---|---|', '| `p_greet` | بدل `name_greet` (يُسجَّل أو يُستورد من لوحة ولي الأمر) |', '| `p_praise` | بدل `name_praise` |']
open(os.path.join(os.path.dirname(__file__), '..', 'docs', 'AUDIO.md'), 'w').write('\n'.join(out) + '\n')
print(len(CLIPS))
