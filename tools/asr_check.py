# Objective pronunciation check: transcribe clips with Whisper (small) and print text next to the intended text.
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from clips import CLIPS
from faster_whisper import WhisperModel
import subprocess, numpy as np
def load(p):
    raw = subprocess.run(['ffmpeg','-loglevel','error','-i',p,'-f','s16le','-ac','1','-ar','16000','-'],capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32)/32768
m = WhisperModel('small', device='cpu', compute_type='int8')
ids = [f'n_{i}' for i in range(21)] + ['n_2g', 'n_12g', 'n_20g', 't_welcome', 'c_praise_1', 'l1_demo2', 's2_mom', 's5_q', 'w_gt']
out = []
for i in ids:
    segs, _ = m.transcribe(load(f'public/audio/{i}.mp3'), language='ar', beam_size=5)
    out.append((i, CLIPS[i][1], ''.join(s.text for s in segs).strip()))
for f in ['p_greet', 'p_praise']:
    segs, _ = m.transcribe(load(f'/workspace/riyadiyat-saf1-personal/{f}.mp3'), language='ar', beam_size=5)
    out.append((f, '(personal)', ''.join(s.text for s in segs).strip()))
for r in out: print(' | '.join(r))
