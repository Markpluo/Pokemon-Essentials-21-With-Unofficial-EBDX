# Audio list: what plays where, and how to replace it

Every sound in the game is a **key** (`harbour`, `battle_rival`, `bike_bell`...). `pack.json` → `"audio"`
says which file each key plays. To replace a placeholder with your own track, drop the OGG into
`packs/hafnia/assets/audio/` and change that one line to `"pack:assets/audio/<file>.ogg"`.
Which map uses which key is in `src/music.ts` (`MAP_MUSIC`); battle music by trainer class is
`battleMusic()` in the same file.

Placeholders today:
- **MIDI** = an Essentials MIDI rendered to OGG with the repo's soundfont (`node tools/render-music.mjs`).
- **OGG** = a file already in the Essentials `Audio/` folder.
- **Synth** = generated from code by `node tools/make-sfx.mjs` (free to use, no samples).

The MIDIs and B2W2/EBDX OGGs are borrowed fan-game assets: replace them before anything public.

## Area music

| Key | Maps | Placeholder | Target feel |
|---|---|---|---|
| `title` | title screen | OGG Title | Harbour at dawn, full Pact melody |
| `norrebro` | Nørrebro | MIDI Lappet Town | Busy, warm, hip-hop swing, bike bells |
| `town_night` | Nørrebro, Nyhavn, Christianshavn, Vesterbro at night | MIDI Radio - Lullaby | The town themes slowed and muted |
| `home` | Home, Lukas's flat | MIDI New Start | Cosy piano |
| `route_lakes` | Dronning Louises Bro, Route 1 | MIDI Route 1 | Open, lakeside strings |
| `lab` | Botanical Garden, Palm House | MIDI Lab | Curious woodwinds (Ørsted) |
| `cave` | Steam Tunnels, Storm Drain | MIDI Cave | Low, hissing |
| `city` | Indre By | MIDI Cedolan City | Big-city brass, cobblestones |
| `tower` | Rundetårn (all floors), CopenHill | MIDI Ingido Plateau | Climbing, starry, a little solemn |
| `harbour` | Nyhavn, Islands Brygge, Østerbro | MIDI Lerucean Town | Accordion sea shanty |
| `cafe` | cafés, bakery, Kasper's kitchen | MIDI Poke Mart | Light, chatty |
| `industrial` | Refshaleøen, Kødbyen, the shipyards, East Quay, the Great Crane | MIDI Safari Zone | Clanking, tense |
| `route_city` | Route 2, Route 4 | MIDI Route 2 | Cycling through the city |
| `route_bike` | Route 3 (Cykelslangen) | OGG Bicycle | The bike theme |
| `freetown` | Christianshavn & Freetown | MIDI Natural Park | Laid-back guitars |
| `park` | Stadsgraven, Frederiksberg | MIDI Safari Zone exterior | Gardens, light |
| `forest` | Dyrehaven | MIDI Safari Zone exterior | Deer park, woodland |
| `village` | Dragør, Lyngby | MIDI Tiall | Rustic, yellow houses |
| `vesterbro` | Vesterbro | MIDI Route 3 | Hip, a bit gritty |
| `cemetery` | Assistens Kirkegård | MIDI Radio - Lullaby | Quiet, lanterns, a music-box hint of the Pact melody |
| `cisterns` | The Cisterns | MIDI Cave | Dripping, echoing, underwater |
| `kastellet` | Kastellet | MIDI Radio - March | Military march, drums |
| `route_coast` | Route 8 Strandvejen | MIDI Islands | Seaside road, breezy |
| `bakken` | Bakken | MIDI Game Corner | Funfair organ |
| `vanguard` | Sub-station D-7, Siphon Chamber | MIDI Triple Triad | Clean, cold electronic |
| `fleet` | Black Fleet houseboat, lighthouse, gun battery | MIDI Radio - Oak | Freja's theme: low brass, broken Pact melody |
| `sea` | Trekroner Sea Fort | OGG Surfing | Open water, bobbing |
| `palace` | Slotsholmen, Børsen | MIDI Hall of Fame | Grand, old money |
| `copenhill` | CopenHill | MIDI Ingido Plateau | Wind turbines, ski slope, uplifting |
| `center` | every Pokémon Center | MIDI Poke Center | Standard and recognisable |
| `gym` | every gym | MIDI Gym | Gym theme |
| `bike` | any outdoor map while riding | OGG Bicycle | One bike theme for the whole game |
| `overworld` | fallback for maps not in the table | OGG Bicycle | |

## Battle music

| Key | Who | Placeholder |
|---|---|---|
| `battle_wild` / `battle_trainer` | default | OGG Battle wild / trainer |
| `battle_rival` | Lukas, Maja | MIDI Battle roaming |
| `battle_leader` | gym leaders | MIDI Battle Gym Leader |
| `battle_fleet` | Deckhands, Bosun, Sailors | MIDI Battle Frontier |
| `battle_vanguard` | Grid Enforcers, Engineers, Vanguard staff, survey drones | OGG B2W2 PWT Final Round |
| `battle_boss` | Freja (Captain), Kaas (Commander) | MIDI Battle Champion |
| `battle_legend` | Langelira, Kronvakt | MIDI Battle Champion |
| `battle_lowhp` | your Pokémon under 1/4 HP | OGG EBDX Low HP Battle |
| `victory_*` | after a win | OGG |

## Area sounds (quiet loops under the music, on the Sound volume)

| Key | Maps | Placeholder |
|---|---|---|
| `amb_waves` | harbours, Route 4, Route 8, Trekroner, Dragør | Synth surf + distant gulls |
| `amb_drips` | Cisterns, Storm Drain | Synth drips |
| `amb_wind` | Assistens, Kastellet, Trinitatis loft, lighthouse, crane, CopenHill | Synth wind |
| `amb_birds` | Route 1, gardens, parks, Lyngby, Dyrehaven | Synth birdsong |
| `amb_machinery` | Refshaleøen drydock, shipyards | Synth hum and clanks |
| `amb_hum` | Sub-station, Siphon Chamber, Gym 8 | Synth mains hum |
| `amb_steam` | Steam Tunnels | Synth steam bursts |

## New sound effects (Synth)

| Key | Where it plays now |
|---|---|
| `bike_bell` | getting on the bike |
| `spray` | Superkilen Gym spray vents |
| `scan_ping` | Ørsted's Bio-Resonance scan |
| `crane` | moving the drydock crane hook |
| `ship_horn` | Dragør ferry, Trekroner hydrofoil run, fort alarms |
| `cannon` | the tremor at the end of Chapter 4 |
| `coaster` | Bakken coaster carts |
| `turbine` | Dyrehaven sub-station lights coming on |
| `coins` | Børsen merchant tokens |
| `explosion`, `bell_toll`, `drip`, `rotom`, `steam` | ready for scripts (`s.sfx('<key>')`) |
