// Bag items for the demo (systems.md §5.2). Prices are in kroner; Marts sell an item once the
// player has `minBadges` badges. Battle and field use both go through these definitions.
import type { StatusId } from './protocol';

export type Pocket = 'medicine' | 'balls' | 'tms' | 'key' | 'other';

export interface ItemDef {
  name: string;
  pocket: Pocket;
  price: number;
  minBadges?: number;        // when Marts start selling it; absent = never sold
  desc: string;
  heal?: number;             // HP restored (Infinity = full)
  cures?: StatusId[] | 'all';
  revive?: number;           // fraction of max HP a fainted Pokémon comes back with
  ball?: number;             // catch-rate multiplier
  repel?: number;            // steps
  breeding?: boolean;        // given to Vuggestuen with a Pokémon (Everstone, Destiny Knot)
  tm?: string;               // move taught (reusable)
  evolve?: string;           // evolution item: species.json "Item" evolutions with this parameter (DUSKSTONE)
  exp?: number;              // Exp. Candy: experience points given
}

export const ITEMS: Record<string, ItemDef> = {
  potion: { name: 'Potion', pocket: 'medicine', price: 200, minBadges: 0, heal: 20, desc: 'Restores 20 HP.' },
  superpotion: { name: 'Super Potion', pocket: 'medicine', price: 700, minBadges: 1, heal: 60, desc: 'Restores 60 HP.' },
  antidote: { name: 'Antidote', pocket: 'medicine', price: 200, minBadges: 0, cures: ['psn', 'tox'], desc: 'Cures poison.' },
  paralyzeheal: { name: 'Paralyze Heal', pocket: 'medicine', price: 300, minBadges: 0, cures: ['par'], desc: 'Cures paralysis.' },
  awakening: { name: 'Awakening', pocket: 'medicine', price: 100, minBadges: 0, cures: ['slp'], desc: 'Wakes a sleeping Pokémon.' },
  burnheal: { name: 'Burn Heal', pocket: 'medicine', price: 300, minBadges: 0, cures: ['brn'], desc: 'Heals a burn.' },
  fullheal: { name: 'Full Heal', pocket: 'medicine', price: 400, minBadges: 2, cures: 'all', desc: 'Cures any status condition.' },
  revive: { name: 'Revive', pocket: 'medicine', price: 2000, minBadges: 3, revive: 0.5, desc: 'Revives a fainted Pokémon with half its HP.' },
  hyperpotion: { name: 'Hyper Potion', pocket: 'medicine', price: 1500, minBadges: 4, heal: 120, desc: 'Restores 120 HP.' },
  pokeball: { name: 'Poké Ball', pocket: 'balls', price: 200, minBadges: 0, ball: 1, desc: 'A ball for catching wild Pokémon.' },
  greatball: { name: 'Great Ball', pocket: 'balls', price: 600, minBadges: 2, ball: 1.5, desc: 'Catches better than a Poké Ball.' },
  ultraball: { name: 'Ultra Ball', pocket: 'balls', price: 1200, minBadges: 4, ball: 2, desc: 'A high-performance ball. Catches better than a Great Ball.' },
  repel: { name: 'Repel', pocket: 'other', price: 400, minBadges: 0, repel: 100, desc: 'Keeps weaker wild Pokémon away for 100 steps.' },
  oranberry: { name: 'Oran Berry', pocket: 'medicine', price: 20, heal: 10, desc: 'A berry that restores 10 HP.' },
  netball: { name: 'Net Ball', pocket: 'balls', price: 1000, minBadges: 2, ball: 1, desc: 'A ball that works well on Water and Bug types.' },
  pearl: { name: 'Pearl', pocket: 'other', price: 1400, desc: 'A pretty pearl. Shops buy it for a good price.' },
  tmbulletseed: { name: 'TM Bullet Seed', pocket: 'tms', price: 0, tm: 'bulletseed', desc: 'Teaches Bullet Seed. Can be used again and again.' },
  tmacidspray: { name: 'TM Acid Spray', pocket: 'tms', price: 0, tm: 'acidspray', desc: 'Teaches Acid Spray. Can be used again and again.' },
  tmmagicalleaf: { name: 'TM Magical Leaf', pocket: 'tms', price: 0, tm: 'magicalleaf', desc: 'Teaches Magical Leaf. Can be used again and again.' },
  tmround: { name: 'TM Round', pocket: 'tms', price: 0, tm: 'round', desc: 'Teaches Round. Can be used again and again.' },
  tmwaterpulse: { name: 'TM Water Pulse', pocket: 'tms', price: 0, tm: 'waterpulse', desc: 'Teaches Water Pulse. Can be used again and again.' },
  tmicywind: { name: 'TM Icy Wind', pocket: 'tms', price: 0, tm: 'icywind', desc: 'Teaches Icy Wind. Can be used again and again.' },
  bikelamp: { name: 'Bike Lamp', pocket: 'key', price: 0, desc: 'A Rotom-powered lamp for the Cargo-Bike. Lights the way at night.' },
  hydrofoils: { name: 'Hydrofoils', pocket: 'key', price: 0, desc: 'Fold-down foils that let the Cargo-Bike skim calm water.' },
  mussels: { name: 'Harbour Mussels', pocket: 'key', price: 0, desc: 'From the harbour bath ladder at Islands Brygge. For Kasper.' },
  buckthorn: { name: 'Sea Buckthorn', pocket: 'key', price: 0, desc: 'Sour orange berries from the Kalvebod edge. For Kasper.' },
  icesalt: { name: 'Smoked-Ice Salt', pocket: 'key', price: 0, desc: 'Kasper\'s secret seasoning, rescued from his locker.' },
  tmhex: { name: 'TM Hex', pocket: 'tms', price: 0, tm: 'hex', desc: 'Teaches Hex. Can be used again and again.' },
  duskstone: { name: 'Dusk Stone', pocket: 'other', price: 3000, evolve: 'DUSKSTONE', desc: 'A dark stone. Some Pokémon evolve when it touches them (Lampent, Misdreavus).' },
  thunderstone: { name: 'Thunder Stone', pocket: 'other', price: 3000, evolve: 'THUNDERSTONE', desc: 'A stone with a thunderbolt pattern. Some Pokémon evolve when it touches them (Pikachu, Magneton).' },
  reapercloth: { name: 'Reaper Cloth', pocket: 'other', price: 2000, desc: 'A cloth that hums when ghosts are near. Collectors pay well for it.' },
  expcandym: { name: 'Exp. Candy M', pocket: 'medicine', price: 0, exp: 3000, desc: 'A candy packed with energy. Gives a Pokémon 3,000 Exp. Points.' },
  kanelsnegl: { name: 'Kanelsnegl', pocket: 'key', price: 0, desc: 'A warm cinnamon swirl from the Vesterbro bakery. For delivery before 8.' },
  poembook: { name: 'Søren\'s Poem Book', pocket: 'key', price: 0, desc: 'Ghost stories from Assistens, written out by hand. One page is still blank.' },
  firstverse: { name: 'The First Verse', pocket: 'key', price: 0, desc: '"Where the king\'s water sleeps beneath the hill, / the mermaid\'s price is written still."' },
  lensobjective: { name: 'Objective Lens', pocket: 'key', price: 0, desc: 'The great front lens of Rundetårn\'s telescope. It fell into the library hall in the tremor.' },
  lenseyepiece: { name: 'Eyepiece Lens', pocket: 'key', price: 0, desc: 'The telescope\'s eyepiece. A Murkrow carried it off to the Trinitatis loft.' },
  gyro: { name: 'Bike Gyro', pocket: 'key', price: 0, desc: 'A spinning brass gyroscope for the Cargo-Bike. Keeps it steady in mid-air for skyway jumps.' },
  tmpsyshock: { name: 'TM Psyshock', pocket: 'tms', price: 0, tm: 'psyshock', desc: 'Teaches Psyshock. Can be used again and again.' },
  sifcodes: { name: 'Sif\'s Codes', pocket: 'key', price: 0, desc: 'A strip of paper with shutdown codes for Vanguard sub-station D-7, in Navigator Sif\'s tidy hand.' },
  snorkel: { name: 'Dive Snorkel', pocket: 'key', price: 0, desc: 'A brass snorkel and air bladder for the Cargo-Bike. Lets it dive under deep water.' },
  ferrycharts: { name: 'Old Ferry Charts', pocket: 'key', price: 0, desc: 'The old ferry routes across the harbour, from Pierrot. "Voices can be taken. Not destroyed."' },
  batterykey: { name: 'Battery Keys', pocket: 'key', price: 0, desc: 'A heavy ring of old iron keys from the Trekroner lighthouse. They open the gun-battery cells.' },
  siphonkey: { name: 'Siphon Keycard', pocket: 'key', price: 0, desc: 'A Vanguard keycard Maja lifted off a guard. It opens the steel door at Trekroner.' },
  stormshield: { name: 'Storm Shield', pocket: 'key', price: 0, desc: 'A copper wind-guard for your bike, from Margrethe. It keeps you upright when the weather turns.' },
  ledger2: { name: 'Second Ledger', pocket: 'key', price: 0, desc: 'The second half of the Pact ledger, from Børsen\'s vault. "Wake the Sleeper beneath Kronborg."' },
  shutdownseq: { name: 'Shutdown Sequence', pocket: 'key', price: 0, desc: 'Dr. Brix\'s notes for shutting down the Bifrost Reactor. "It needs a voice to close the circuit. Literally."' },
  torquegears: { name: 'High-Torque Gears', pocket: 'key', price: 0, desc: 'Astrid\'s gear set for the Cargo-Bike. Low enough to climb a ski slope in a storm.' },
  overloaddata: { name: 'Overload Data', pocket: 'key', price: 0, desc: 'Astrid\'s readings: the Grid puts out three times what every turbine in Hafnia could make.' },
  kronkey: { name: 'Kronvakt\'s Key', pocket: 'key', price: 0, desc: 'A granite key from Absalon\'s altar, warm when the eight badges are near. It wakes the Sleeper beneath Kronborg.' },
  pactsong: { name: 'The Pact Song', pocket: 'key', price: 0, desc: 'The old Dragør melody, copied from Freja\'s grandfather\'s log. The Pact is sung, not signed.' },
  tmdazzlinggleam: { name: 'TM Dazzling Gleam', pocket: 'tms', price: 0, tm: 'dazzlinggleam', desc: 'Teaches Dazzling Gleam. Can be used again and again.' },
  expcandyl: { name: 'Exp. Candy L', pocket: 'medicine', price: 0, exp: 10000, desc: 'A big candy packed with energy. Gives a Pokémon 10,000 Exp. Points.' },
  mermaidtear: { name: 'Mermaid\'s Tear', pocket: 'key', price: 0, desc: 'A shard of green copper from the new statue on Langelinie. It hums both notes of the Coil at once: Harmony.' },
  echoshard: { name: 'Echo Shard', pocket: 'key', price: 0, desc: 'A sliver of Langelira\'s frozen song from a Resonance Rift. Dr. Brix is collecting them to give the song back.' },
  lastecho: { name: 'The Last Echo', pocket: 'key', price: 0, desc: 'The biggest Echo of all, folded small in your hands. It hums the last verse of Langelira\'s song.' },
  rangerpermit: { name: 'Ranger Permit', pocket: 'key', price: 0, desc: 'Bjørk\'s signature on a soggy card. Lets you down the ramp to Peberholm Reserve.' },
  ledgercopy: { name: 'Andersen\'s Ledger', pocket: 'key', price: 0, desc: 'A copy of the Pact ledger from the Sunken Archive, in H.C. Andersen\'s hand.' },
  bike: { name: 'Rotom Cargo-Bike', pocket: 'key', price: 0, desc: 'Ørsted\'s prototype. Ride it from the menu outdoors.' },
  oldrod: { name: 'Old Rod', pocket: 'key', price: 0, desc: 'Old Knud\'s rod. Face water and press A to fish.' },
  coppernail: { name: 'Copper Hull Nail', pocket: 'key', price: 0, desc: 'From the old ships. Lets the Coil make Patina armour.' },
  lighthouselog: { name: 'Lighthouse Log', pocket: 'key', price: 0, desc: 'Yellowed pages from a lighthouse keeper\'s log.' },
  everstone: { name: 'Everstone', pocket: 'other', price: 3000, breeding: true, desc: 'Leave it at Vuggestuen with a Pokémon and the Egg gets its nature.' },
  destinyknot: { name: 'Destiny Knot', pocket: 'other', price: 20000, breeding: true, desc: 'Leave it at Vuggestuen with a Pokémon and the Egg inherits 5 IVs.' }
};

export const itemName = (id: string) => ITEMS[id]?.name ?? id;

/** What an item would do to a Pokémon with this HP and status, or null if it would do nothing. */
export function itemEffect(it: ItemDef, hp: number, maxhp: number, status: StatusId): { hp: number; cure: boolean } | null {
  if (it.revive) return hp <= 0 ? { hp: Math.max(1, Math.floor(maxhp * it.revive)), cure: true } : null;
  if (hp <= 0) return null;
  const cure = !!status && (it.cures === 'all' || !!it.cures?.includes(status));
  const heal = it.heal ? Math.min(maxhp, hp + it.heal) : hp;
  if (heal === hp && !cure) return null;
  return { hp: heal, cure };
}
