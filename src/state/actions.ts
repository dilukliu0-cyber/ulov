import { setState, getState, setUi, getUi, toast, CaughtFish, Save } from './store';
import {
  fishDef, upgCost, UpgKind, MAX_LV, bucketCap, CATS, catUpgCost, skin, BOAT_COST, SEA_COST, SEA_ROD, TRENCH_COST,
  TRENCH_SPECIES, XP_BY_RARITY, levelFromXp, rankOf, MILESTONES, RARITY_SETS, SHINY_REWARD, Reward, rIdx,
} from '../data/game';
import type { PlaceId } from '../data/fish';
import { runCats, speciesCount, rarityComplete, offlineCap } from '../game/engine';
import { haptic } from '../ui/feedback';

function grant(d: Save, r: Reward, out: { ru: string; en: string; coins?: number; skin?: string }[]) {
  if (d.claimed.includes(r.id)) return;
  d.claimed.push(r.id);
  if (r.coins) d.coins += r.coins;
  if (r.skin && !d.owned.includes(r.skin)) d.owned.push(r.skin);
  out.push({ ru: r.ru, en: r.en, coins: r.coins, skin: r.skin });
}

/** Проверить вехи коллекции / редкостей / блестящую */
function checkRewards(d: Save) {
  const got: { ru: string; en: string; coins?: number; skin?: string }[] = [];
  const n = speciesCount(d);
  for (const m of MILESTONES) if (n >= m.n) grant(d, m.r, got);
  for (const rs of RARITY_SETS) if (rarityComplete(d, rs.rarity)) {
    if (!d.claimed.includes(rs.r.id)) setUi({ setDone: { ru: rs.r.ru, en: rs.r.en } });
    grant(d, rs.r, got);
  }
  if (Object.values(d.collection).some((c) => c.shiny)) grant(d, SHINY_REWARD, got);
  if (got.length) setUi({ rewards: [...getUi().rewards, ...got] });
}

/** Игрок поймал рыбу. Возвращает информацию для показа. */
export function catchFish(f: CaughtFish) {
  const def = fishDef(f.id);
  let info = { isNew: false, isRecord: false, prevBest: 0, inBucket: true, soldInstead: false };
  setState((d) => {
    const prev = d.collection[f.id];
    info.isNew = !prev;
    info.prevBest = prev?.best || 0;
    info.isRecord = !!prev && f.kg > prev.best;
    d.collection[f.id] = {
      count: (prev?.count || 0) + 1,
      best: Math.max(prev?.best || 0, f.kg),
      shiny: (prev?.shiny || false) || f.shiny,
      first: prev?.first || Date.now(),
    };
    d.stats.caught++;
    if (f.kg * (def.ppk) > 0 && f.kg > 0 && (f.kg > d.stats.heaviest)) {
      d.stats.heaviest = f.kg;
      d.stats.heaviestId = f.id;
    }
    const lvBefore = levelFromXp(d.xp);
    d.xp += XP_BY_RARITY[def.rarity] * (info.isNew ? 10 : 1);
    const lvAfter = levelFromXp(d.xp);
    if (rankOf(lvAfter) !== rankOf(lvBefore)) {
      const rk = rankOf(lvAfter);
      if (rk.reward && !d.owned.includes(rk.reward)) d.owned.push(rk.reward);
      setUi({ rankUp: { ru: rk.ru, en: rk.en, skin: rk.reward } });
    }
    // в ведро
    const cap = bucketCap(d.upgrades.bucket);
    if (d.bucket.length < cap) {
      d.bucket.push(f);
    } else if (rIdx(def.rarity) >= 2 || f.shiny) {
      // ведро полное, рыба ценная: продаём самую дешёвую незапертую
      const unlocked = d.bucket.filter((x) => !x.locked).sort((a, b) => a.value - b.value);
      if (unlocked.length) {
        const cheap = unlocked[0];
        d.bucket = d.bucket.filter((x) => x.uid !== cheap.uid);
        d.coins += cheap.value;
        d.stats.sold++;
        d.stats.earned += cheap.value;
        d.bucket.push(f);
      } else {
        info.inBucket = false;
        info.soldInstead = true;
        d.coins += f.value;
        d.stats.sold++;
        d.stats.earned += f.value;
      }
    } else {
      info.inBucket = false;
      info.soldInstead = true;
      d.coins += f.value;
      d.stats.sold++;
      d.stats.earned += f.value;
    }
    checkRewards(d);
  });
  return info;
}

export function fishLost() {
  setState((d) => {
    d.stats.lost++;
  });
}

export function sellAll(includeLocked = false): number {
  let total = 0;
  setState((d) => {
    const keep: CaughtFish[] = [];
    for (const f of d.bucket) {
      if (f.locked && !includeLocked) keep.push(f);
      else total += f.value;
    }
    d.stats.sold += d.bucket.length - keep.length;
    d.bucket = keep;
    d.coins += total;
    d.stats.earned += total;
  });
  if (total > 0) {
    setUi({ coinFly: getUi().coinFly + 1 });
    haptic('success');
  }
  return total;
}

export function sellOne(uid: string) {
  setState((d) => {
    const f = d.bucket.find((x) => x.uid === uid);
    if (!f) return;
    d.bucket = d.bucket.filter((x) => x.uid !== uid);
    d.coins += f.value;
    d.stats.sold++;
    d.stats.earned += f.value;
  });
  setUi({ coinFly: getUi().coinFly + 1 });
  haptic('success');
}

export function toggleLock(uid: string) {
  setState((d) => {
    const f = d.bucket.find((x) => x.uid === uid);
    if (f) f.locked = !f.locked;
  });
  haptic('light');
}

function pay(d: Save, cost: number) {
  if (d.coins < cost) return false;
  d.coins -= cost;
  return true;
}

export function buyUpgrade(k: UpgKind): boolean {
  const s = getState();
  const lv = s.upgrades[k];
  if (lv >= MAX_LV) return false;
  const cost = upgCost(k, lv);
  if (s.coins < cost) {
    haptic('error');
    return false;
  }
  setState((d) => {
    if (pay(d, cost)) d.upgrades[k] = lv + 1;
  });
  haptic('success');
  return true;
}

export function buyBoat(): boolean {
  const s = getState();
  if (s.boat) return false;
  if (s.coins < BOAT_COST) {
    haptic('error');
    return false;
  }
  setState((d) => {
    if (pay(d, BOAT_COST)) {
      d.boat = true;
      d.unlocked.bay = true;
    }
  });
  haptic('success');
  return true;
}

export function placeRequirement(s: Save, p: PlaceId): { ok: boolean; cost: number; needRu: string; needEn: string } {
  if (p === 'pier') return { ok: true, cost: 0, needRu: '', needEn: '' };
  if (p === 'bay') return { ok: s.boat, cost: 0, needRu: 'Купите лодку в магазине', needEn: 'Buy the boat in the shop' };
  if (p === 'sea') {
    const ok = s.unlocked.bay && s.upgrades.rod >= SEA_ROD;
    return { ok, cost: SEA_COST, needRu: `Нужен залив и удочка ур. ${SEA_ROD}`, needEn: `Needs the bay and rod lvl ${SEA_ROD}` };
  }
  const ok = s.unlocked.sea && speciesCount(s) >= TRENCH_SPECIES;
  return { ok, cost: TRENCH_COST, needRu: `Нужно море и ${TRENCH_SPECIES} видов рыб`, needEn: `Needs the sea and ${TRENCH_SPECIES} species` };
}

export function unlockPlace(p: PlaceId): boolean {
  const s = getState();
  const req = placeRequirement(s, p);
  if (s.unlocked[p]) return true;
  if (!req.ok || s.coins < req.cost) {
    haptic('error');
    return false;
  }
  setState((d) => {
    if (pay(d, req.cost)) {
      d.unlocked[p] = true;
      d.place = p;
    }
  });
  haptic('success');
  return true;
}

export function goPlace(p: PlaceId) {
  setState((d) => {
    if (d.unlocked[p]) d.place = p;
  });
}

export function hireCat(id: string): boolean {
  const c = CATS.find((x) => x.id === id)!;
  const s = getState();
  if (s.cats[id].hired) return false;
  if (s.coins < c.cost) {
    haptic('error');
    return false;
  }
  setState((d) => {
    if (pay(d, c.cost)) {
      d.cats[id].hired = true;
      d.cats[id].level = 1;
      d.cats[id].place = d.place === 'trench' ? 'pier' : d.place;
    }
  });
  haptic('success');
  return true;
}

export function upgradeCat(id: string): boolean {
  const c = CATS.find((x) => x.id === id)!;
  const s = getState();
  const lv = s.cats[id].level;
  if (lv >= MAX_LV) return false;
  const cost = catUpgCost(c, lv);
  if (s.coins < cost) {
    haptic('error');
    return false;
  }
  setState((d) => {
    if (pay(d, cost)) d.cats[id].level = lv + 1;
  });
  haptic('success');
  return true;
}

export function renameCat(id: string, name: string) {
  setState((d) => {
    d.cats[id].name = name.trim().slice(0, 18);
  });
}
export function setCatPlace(id: string, p: PlaceId) {
  setState((d) => {
    if (d.unlocked[p]) d.cats[id].place = p;
  });
}

export function buySkin(id: string): boolean {
  const sk = skin(id);
  const s = getState();
  if (s.owned.includes(id)) return true;
  if (sk.price == null) return false;
  if (s.coins < sk.price) {
    haptic('error');
    return false;
  }
  setState((d) => {
    if (pay(d, sk.price!)) d.owned.push(id);
  });
  haptic('success');
  return true;
}

export function equipSkin(id: string) {
  const sk = skin(id);
  setState((d) => {
    if (!d.owned.includes(id)) return;
    if (sk.cat === 'scene') d.equipped.scene = id;
    else (d.equipped as any)[sk.cat] = id;
  });
  haptic('light');
}
export function resetSkin(cat: 'rod' | 'bobber' | 'outfit' | 'scene') {
  setState((d) => {
    const def = { rod: 'rod_bamboo', bobber: 'bobber_classic', outfit: 'outfit_sailor', scene: 'auto' }[cat];
    (d.equipped as any)[cat] = def;
  });
}

export function setSetting<K extends keyof Save['settings']>(k: K, v: Save['settings'][K]) {
  setState((d) => {
    d.settings[k] = v;
  });
}

export function finishOnboarding() {
  setState((d) => {
    d.onboarded = true;
    if (!d.cats.kitten.hired) {
      // первый кот — бесплатно, но нанимается на экране котов; здесь ничего
    }
  });
}

// ---------- коты онлайн / офлайн ----------
const acc: Record<string, number> = {};

export function catsTick(seconds: number) {
  const s = getState();
  if (!Object.values(s.cats).some((c) => c.hired)) return;
  const res = runCats(s, seconds, acc);
  if (!res.added.length && !res.autoSold) return;
  setState((d) => {
    d.bucket.push(...res.added);
    d.coins += res.coins;
    d.stats.earned += res.coins;
    d.stats.sold += res.autoSold;
  });
}

export function applyOffline(awaySec: number) {
  const s = getState();
  if (awaySec < 120) return;
  if (!Object.values(s.cats).some((c) => c.hired)) return;
  const sec = Math.min(awaySec, offlineCap(s));
  const tmpAcc: Record<string, number> = {};
  const res = runCats(s, sec, tmpAcc);
  if (!res.added.length && !res.autoSold) return;
  setState((d) => {
    d.bucket.push(...res.added);
    d.coins += res.coins;
    d.stats.earned += res.coins;
    d.stats.sold += res.autoSold;
  });
  setUi({ welcome: { seconds: sec, perCat: res.perCat, toBucket: res.added.length, autoSold: res.autoSold, coins: res.coins } });
}

export { toast };
