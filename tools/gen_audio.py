# -*- coding: utf-8 -*-
"""Generate all public clips with edge-tts (Microsoft neural voices). Source is requested at the highest format the
free endpoint returns (24 kHz, 96 kbit/s mp3 instead of the default 48 kbit/s); after trimming silence it is
encoded once at 64 kbit/s mono 24 kHz (was 32 kbit/s). Per-role rate/pitch/volume give the lively/joyful/gentle tones.
usage: python3 tools/gen_audio.py [--force] [ids...]"""
import asyncio, os, sys, subprocess, json, hashlib
sys.path.insert(0, os.path.dirname(__file__))
from clips import CLIPS, VOICES
import edge_tts, inspect, edge_tts.communicate as _c
_src = inspect.getsource(_c).replace('audio-24khz-48kbitrate-mono-mp3', 'audio-24khz-96kbitrate-mono-mp3')
_hq = type(sys)('edge_tts_hq'); _hq.__dict__.update(_c.__dict__); exec(compile(_src, _c.__file__, 'exec'), _hq.__dict__)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")
STAMP = os.path.join(ROOT, "tools", ".audio-stamps.json")

def compress(src, dst):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src,
        "-af", "silenceremove=start_periods=1:start_threshold=-62dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_threshold=-62dB:start_silence=0.08,areverse,apad=pad_dur=0.12",
        "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "64k", dst], check=True)

async def one(cid, role, text, sem):
    voice, rate, pitch, *vol = VOICES[role]; volume = vol[0] if vol else '+0%'
    tmp = f"/tmp/rs1_{cid}.mp3"
    async with sem:
        for attempt in range(4):
            try:
                await _hq.Communicate(text, voice, rate=rate, pitch=pitch, volume=volume).save(tmp)
                break
            except Exception as e:
                if attempt == 3: raise
                await asyncio.sleep(2)
    compress(tmp, os.path.join(OUT, cid + ".mp3"))
    os.remove(tmp)

async def main(argv):
    force = "--force" in argv
    only = [a for a in argv if not a.startswith("--")]
    os.makedirs(OUT, exist_ok=True)
    stamps = json.load(open(STAMP)) if os.path.exists(STAMP) else {}
    sem = asyncio.Semaphore(6); jobs = []
    for cid, (role, text) in CLIPS.items():
        if only and cid not in only: continue
        key = hashlib.sha1(json.dumps([VOICES[role], text, 'hq96-64k']).encode()).hexdigest()
        path = os.path.join(OUT, cid + ".mp3")
        if not force and stamps.get(cid) == key and os.path.exists(path): continue
        jobs.append((cid, key, one(cid, role, text, sem)))
    for cid, key, j in jobs:
        pass
    await asyncio.gather(*[j for _, _, j in jobs])
    for cid, key, _ in jobs: stamps[cid] = key
    # remove orphans
    for f in os.listdir(OUT):
        if f.endswith(".mp3") and f[:-4] not in CLIPS: os.remove(os.path.join(OUT, f))
    json.dump(stamps, open(STAMP, "w"), indent=0)
    print("generated", len(jobs), "clips; total", len(CLIPS))

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
