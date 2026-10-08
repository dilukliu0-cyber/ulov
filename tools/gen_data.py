"""Генерирует src/data/fish.ts и src/data/assets.ts из blender/fish_data.py и папки assets."""
import os, sys, json
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.join(root, 'blender'))
from fish_data import FISH

EN = dict(roach='Roach', perch='Perch', bleak='Bleak', crucian='Crucian Carp', gudgeon='Gudgeon', bream='Bream', tench='Tench',
          ide='Ide', burbot='Burbot', goldcarp='Golden Carp', anchovy='Anchovy', mullet='Grey Mullet', flounder='Flounder',
          mackerel='Mackerel', goby='Goby', seabass='Sea Bass', mullet_red='Red Mullet', scorpion='Scorpionfish',
          twilightkoi='Twilight Koi', stingray='Stingray', herring='Herring', sardine='Sardine', tuna='Tuna',
          barracuda='Barracuda', mahi='Mahi-Mahi', swordfish='Swordfish', moray='Moray Eel', catshark='Catshark',
          sailfish='Sailfish', whiteshark='Great White', blobfish='Blobfish', lanternfish='Lanternfish',
          viperfish='Viperfish', gulper='Gulper Eel', anglerfish='Anglerfish', leviathan='Moon Leviathan',
          stareel='Star Eel', ghostfish='Ghostfish', golddragon='Golden Dragon', abyssking='Abyss King')

lines = ["// АВТОГЕНЕРАЦИЯ: tools/gen_data.py — не править руками", "export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';",
         "export type PlaceId = 'pier' | 'bay' | 'sea' | 'trench';",
         "export interface FishDef { id: string; ru: string; en: string; rarity: Rarity; place: PlaceId; kgMin: number; kgMax: number; ppk: number; }",
         "export const FISH: FishDef[] = ["]
for p in FISH:
    lines.append("  { id: '%s', ru: '%s', en: '%s', rarity: '%s', place: '%s', kgMin: %s, kgMax: %s, ppk: %s }," %
                 (p['id'], p['ru'], EN[p['id']], p['rarity'], p['place'], p['kg'][0], p['kg'][1], p['ppk']))
lines.append("];")
open(os.path.join(root, 'src', 'data', 'fish.ts'), 'w', encoding='utf8').write("\n".join(lines) + "\n")

A = os.path.join(root, 'assets')
out = ["// АВТОГЕНЕРАЦИЯ: tools/gen_data.py — не править руками", "/* eslint-disable */"]
def block(name, files, folder, key=lambda f: f):
    out.append("export const %s: Record<string, any> = {" % name)
    for f in sorted(files):
        k = key(f)
        out.append("  '%s': require('../../assets/%s/%s')," % (k, folder, f))
    out.append("};")
block('FISH_IMG', [p['id'] + '.png' for p in FISH], 'fish', lambda f: f[:-4])
cats = [f for f in os.listdir(os.path.join(A, 'cats')) if f.endswith('.png')]
block('CAT_IMG', cats, 'cats', lambda f: f[:-4])
sc = [f for f in os.listdir(os.path.join(A, 'scenes')) if f.endswith('.jpg')]
block('SCENE_IMG', sc, 'scenes', lambda f: f[:-4])
it = [f for f in os.listdir(os.path.join(A, 'items')) if f.endswith('.png')]
block('ITEM_IMG', it, 'items', lambda f: f[:-4])
meta = json.load(open(os.path.join(A, 'cats', 'player_meta.json')))
smeta = json.load(open(os.path.join(A, 'scenes', 'scene_meta.json')))
out.append("export const PLAYER_META: Record<string, { paw: number[] }> = %s;" % json.dumps(meta))
out.append("export const SCENE_META: Record<string, { cat: number[]; bobber: number[] }> = %s;" % json.dumps(smeta))
open(os.path.join(root, 'src', 'data', 'assets.ts'), 'w', encoding='utf8').write("\n".join(out) + "\n")
print('ok', len(FISH), len(cats), len(sc), len(it))
