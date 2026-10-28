# Generates the game's music with Google's Lyria RealTime model (free, instrumental) from the
# prompts in packs/hafnia/assets/audio/lyria/prompts.json. Each track is streamed for a while,
# the warm-up is dropped, and the end is crossfaded into the start so it loops without a seam.
# Writes packs/hafnia/assets/audio/lyria/<key>.ogg; pack.json "audio" points the keys at them.
# Needs: pip install google-genai numpy, ffmpeg, and GEMINI_API_KEY in the environment.
# Usage: python3 tools/lyria-music.py [key ...]   (no keys = every track that has no file yet)
import asyncio, json, os, subprocess, sys
import numpy as np
from google import genai
from google.genai import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'packs', 'hafnia', 'assets', 'audio', 'lyria')
RATE, WARMUP, LENGTH, FADE, PARALLEL = 48000, 4, 80, 3, 4

client = genai.Client(api_key=os.environ['GEMINI_API_KEY'], http_options={'api_version': 'v1alpha'})

async def record(key, spec):
    want = (WARMUP + LENGTH) * RATE * 4
    pcm = bytearray()
    async with client.aio.live.music.connect(model='models/lyria-realtime-exp') as s:
        await s.set_weighted_prompts(prompts=[types.WeightedPrompt(text=spec['prompt'], weight=1.0)])
        await s.set_music_generation_config(config=types.LiveMusicGenerationConfig(bpm=spec['bpm'], temperature=1.0))
        await s.play()
        async for m in s.receive():
            if m.filtered_prompt: raise RuntimeError(f'{key}: prompt filtered ({m.filtered_prompt})')
            if m.server_content and m.server_content.audio_chunks:
                for c in m.server_content.audio_chunks: pcm += c.data
                if len(pcm) >= want: break
    a = np.frombuffer(bytes(pcm[:want]), dtype='<i2').reshape(-1, 2).astype(np.float32)[WARMUP * RATE:]
    n = FADE * RATE
    body, tail = a[:-n].copy(), a[-n:]
    t = np.linspace(0, 1, n)[:, None]
    body[:n] = body[:n] * t + tail * (1 - t)
    raw = os.path.join(DIR, f'_{key}.pcm')
    body.clip(-32768, 32767).astype('<i2').tofile(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(RATE), '-ac', '2', '-i', raw,
                    '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11,aresample=44100', '-c:a', 'libvorbis', '-q:a', '1',
                    os.path.join(DIR, f'{key}.ogg')], check=True)
    os.remove(raw)
    print(f'made {key}.ogg', flush=True)

async def main():
    prompts = json.load(open(os.path.join(DIR, 'prompts.json')))
    keys = sys.argv[1:] or [k for k in prompts if not os.path.exists(os.path.join(DIR, f'{k}.ogg'))]
    gate = asyncio.Semaphore(PARALLEL)
    async def one(k):
        async with gate:
            for attempt in range(3):
                try: return await record(k, prompts[k])
                except Exception as e: print(f'{k}: attempt {attempt + 1} failed: {e}', flush=True)
    await asyncio.gather(*(one(k) for k in keys))

asyncio.run(main())
