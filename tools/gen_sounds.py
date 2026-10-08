"""Синтез коротких звуков игры (свои, без лицензий)."""
import wave, struct, math, random, os
SR = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')

def save(name, samples):
    with wave.open(os.path.join(OUT, name + '.wav'), 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 30000)) for s in samples))

def env(i, n, a=0.01, r=0.6):
    t = i / n
    if t < a: return t / a
    return max(0.0, 1 - (t - a) / (1 - a)) ** (1 / r)

def tone(freqs, dur, vol=0.5, shape='sine', glide=None):
    n = int(SR * dur); out = []
    ph = 0.0
    for i in range(n):
        t = i / n
        f = freqs[0] + (freqs[1] - freqs[0]) * t if len(freqs) > 1 else freqs[0]
        ph += 2 * math.pi * f / SR
        s = math.sin(ph) if shape == 'sine' else (1 if math.sin(ph) > 0 else -1) * 0.5
        out.append(s * vol * env(i, n))
    return out

def noise(dur, vol=0.4, lp=0.2):
    n = int(SR * dur); out = []; y = 0
    rnd = random.Random(3)
    for i in range(n):
        y += lp * (rnd.uniform(-1, 1) - y)
        out.append(y * vol * env(i, n, 0.02, 0.4))
    return out

def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0 for p in parts) for i in range(n)]

def seq(*parts):
    out = []
    for p in parts: out += p
    return out

save('cast', mix(noise(0.35, 0.5, 0.08), tone([900, 300], 0.3, 0.15)))
save('splash', mix(noise(0.4, 0.7, 0.25), tone([420, 160], 0.25, 0.3)))
save('bite', seq(tone([660, 880], 0.07, 0.5), tone([880, 1320], 0.09, 0.5)))
save('coin', seq(tone([1320], 0.06, 0.4), tone([1760], 0.18, 0.4)))
save('success', seq(tone([523], 0.09, 0.4), tone([659], 0.09, 0.4), tone([784], 0.09, 0.4), tone([1046], 0.25, 0.45)))
save('fail', seq(tone([400, 300], 0.15, 0.4), tone([300, 180], 0.3, 0.4)))
save('tap', tone([1200, 900], 0.04, 0.25))
save('reel', mix(*[[0] * int(SR * 0.02 * k) + tone([2200], 0.012, 0.25) for k in range(6)]))
save('rare', seq(tone([784], 0.08, 0.35), tone([988], 0.08, 0.35), tone([1175], 0.08, 0.35), tone([1568], 0.4, 0.4)))
print('ok', os.listdir(OUT))
