# Audio list: what plays where, and how to replace it

Every sound in the game is a **key** (`harbour`, `battle_rival`, `bike_bell`...). `pack.json` → `"audio"`
says which file each key plays. To replace a track with your own, drop the OGG into
`packs/hafnia/assets/audio/` and change that one line to `"pack:assets/audio/<file>.ogg"`.
Which map uses which key is in `src/music.ts` (`MAP_MUSIC`); battle music by trainer class is
`battleMusic()` in the same file.

## Where the files come from
- **Music** is made by Google's Lyria RealTime model (free, instrumental) from the prompts in
  `assets/audio/lyria/prompts.json`: `GEMINI_API_KEY=... python3 tools/lyria-music.py [key ...]`.
  Each track is ~77 s, crossfaded end-to-start so it loops. Change a prompt and re-run that key to
  get a new take. Output carries Google's SynthID watermark.
- **Sound effects and area sounds** are synthesised from code: `node tools/make-sfx.mjs` (free to use).
- **Jingles and battle sounds** (`me_*`, `victory_*`, hits, ball shakes...) are still the Essentials
  files; replace them before anything public.

## Music
| Key | Where | Prompt |
|---|---|---|
| `title` | title screen | Hopeful orchestral overture, harbour at dawn, gentle strings and horn melody, glockenspiel, adventure begins, video game title theme |
| `norrebro` | Nørrebro | Warm upbeat town theme, laid-back hip-hop swing drums, Rhodes piano, bicycle bell accents, friendly multicultural city neighbourhood, video game |
| `town_night` | Christianshavn & Freetown, Nyhavn, Nørrebro, Vesterbro | Quiet night-time town theme, soft muted piano and music box, slow, sleepy city streets under lamplight, video game |
| `home` | Home, Lukas's flat, Ranger Hut | Cosy home theme, solo piano and soft acoustic guitar, warm and gentle, morning in a small flat, video game |
| `route_lakes` | Dronning Louises Bro, Route 1: Søerne Path | Bright open route theme, lakeside strings and flute, light percussion, adventurous walking music, video game overworld |
| `lab` | Botanical Garden, The Palm House | Curious playful laboratory theme, woodwinds and pizzicato strings, marimba, botanical greenhouse, science and wonder, video game |
| `cave` | Steam Tunnels, Storm Drain | Dark underground tunnel ambience music, low synth drones, distant metallic percussion, steam pipes, mysterious, video game dungeon |
| `city` | Indre By: Strøget | Big city theme, brass and strings, cobblestone streets, busy shopping street, confident and bustling, video game town |
| `tower` | Bibliotekssalen, Rundetårn, Rundetårn: the Ramp, Trinitatis Loft | Climbing an old observatory tower, harpsichord and celesta, starry and solemn, slowly rising arpeggios, video game dungeon |
| `harbour` | Islands Brygge, Nyhavn, Østerbro: Langelinie | Cheerful harbour town theme, accordion and fiddle sea shanty, acoustic guitar, colourful houses by the canal, video game |
| `cafe` | Bageriet, Café in Nyhavn, Kaffebaren, Kasper's Kitchen | Light jazzy cafe music, brushed drums, upright bass, vibraphone, relaxed and chatty, video game shop |
| `industrial` | Kødbyen, Refshaleøen, Refshaleøen Shipyards, Refshaleøen: East Quay, The Great Crane | Tense industrial shipyard theme, clanking metal percussion, low brass, driving bass, cranes and containers, video game |
| `route_city` | Route 2: Den Grønne Sti, Route 4: Knippelsbro | Energetic cycling route through the city, funky bass, electric guitar, synth lead, sunny day, video game overworld |
| `bike` | any outdoor map while riding (also `route_bike`, `overworld`) | Fast fun bicycle riding theme, bright synth lead, bouncy bass, upbeat drums, wind in your hair, video game |
| `freetown` | Christianshavn & Freetown | Laid-back hippie neighbourhood theme, reggae-tinged acoustic guitars, hand percussion, relaxed and free, video game town |
| `park` | Frederiksberg, Stadsgraven | Peaceful garden park theme, flute and harp, light strings, birdsong feel, sunny afternoon, video game |
| `forest` | Dyrehaven | Ancient deer forest theme, oboe and pizzicato strings, soft hand drums, misty woodland, gentle mystery, video game route |
| `village` | Dragør, Lyngby: Frilandsmuseet | Rustic seaside village theme, folk fiddle, accordion and acoustic guitar, yellow houses, old fishing harbour, video game |
| `vesterbro` | Vesterbro | Hip gritty city district theme, lo-fi beat, jazzy guitar, a bit of grit, street art and cafes, video game town |
| `cemetery` | Assistens Kirkegård | Quiet old cemetery theme at dusk, music box melody, soft strings, lanterns, melancholic and a little eerie, video game |
| `cisterns` | The Cisterns | Echoing underground water cisterns, dripping water percussion, deep reverb pads, glassy bells, mysterious, video game dungeon |
| `kastellet` | Kastellet | Military fortress theme, marching snare drums, brass fanfare, proud and disciplined, star-shaped citadel, video game |
| `route_coast` | Route 8: Strandvejen | Breezy coastal road theme, acoustic guitar and strings, sea view, light and open, summer drive, video game overworld |
| `bakken` | Bakken | Old amusement park theme, carousel organ waltz, calliope, playful and slightly crazy, funfair, video game |
| `vanguard` | Trekroner: Siphon Chamber, Vanguard Sub-station D-7 | Cold corporate villain base theme, clean electronic synths, pulsing bass, sterile and tense, power plant, video game |
| `fleet` | The Black Fleet's Houseboat, The Fleet Safehouse, Trekroner Lighthouse, Trekroner: Gun Battery | Pirate crew hideout theme, low brass and cello, minor-key sea shanty, mysterious captain, melancholic and proud, video game |
| `sea` | Trekroner Sea Fort | Open sea surfing theme, bobbing rhythm, steel drums and strings, sea fort on the horizon, video game |
| `palace` | Børsen, Slotsholmen | Grand palace and old stock exchange theme, harpsichord and string quartet, regal and refined, old money, video game |
| `copenhill` | CopenHill, CopenHill Slope, The Smokestack Ring | Uplifting mountain top theme, wind turbines, ski slope on a power plant roof, soaring synth and strings, video game |
| `center` | every Pokémon Center | Calm healing centre theme, soft electric piano and bells, comforting and familiar, video game Pokemon Center style |
| `gym` | every gym | Gym battle arena theme, driving drums, electric guitar riff, confident and competitive, video game gym |
| `metro` | M-Ring Tunnels | Underground metro tunnel theme, pulsing electronic bass, distant train rumble, echoing synth arps, tense, video game dungeon |
| `ruins` | Absalon's Ruins, Hammershus Depths, The Deep Sound, The Royal Crypt | Ancient medieval ruins and deep caves, low choir pads, slow tribal drums, stone echoes, mysterious and ancient, video game dungeon |
| `castle` | Hammershus, Helsingør, Kronborg Casemates | Renaissance castle theme, lute, recorder and strings, Hamlet's fortress by the sea, noble and slightly ominous, video game |
| `island` | Peberholm Reserve, Route 14: Bornholm Coast, Rønne, Bornholm | Sunny Baltic island theme, acoustic guitar, fiddle and light percussion, rocky coast and smokehouses, relaxed holiday, video game |
| `route_bridge` | Route 13: Øresund Bridge | Long bridge across the sea, sweeping strings and synth pads, driving rhythm, wind and open sky, video game overworld |
| `wilds` | Kalvebod Wilds, Vestamager Firing Range | Wild marshland nature reserve, hand drums, wooden flute, open grassland, a little untamed, video game safari route |
| `route_country` | Route 10: Roskilde Road | Country road through farmland, acoustic guitar and accordion, light folk percussion, golden fields, video game overworld |
| `viking` | Roskilde, Viking Ship Museum | Viking town theme, nordic folk, hurdy-gurdy, frame drum, low horn, longships in the harbour, proud and old, video game |
| `cathedral` | Roskilde Cathedral | Old cathedral theme, pipe organ and choir, reverent and solemn, royal tombs, video game |
| `tivoli` | Dæmonen Tower, Pantomime Theatre, Tivoli Concert Hall, Tivoli Gardens | Magical evening amusement garden theme, sparkling celesta, waltzing strings, fairy lights, joyful and enchanted, video game |
| `league` | Christiansborg Tower, Christiansborg: League Hall, The Admiral's Hall, The Great Hall, The Royal Stables, The Tower Stairs | Pokemon League palace theme, majestic brass and timpani, grand marble halls, tension before the final challenge, video game |
| `crisis` | Nyhavn (flooded) | City in crisis theme, flooding harbour, urgent strings ostinato, pounding drums, alarm-like synth, video game emergency |

## Battle music
| Key | Who | Prompt |
|---|---|---|
| `battle_wild` | wild Pokémon | Exciting wild monster battle theme, fast drums, synth brass stabs, energetic bass, video game JRPG battle music |
| `battle_trainer` | other trainers | Trainer battle theme, energetic rock drums, synth lead melody, punchy bass, video game JRPG battle music |
| `battle_rival` | Lukas, Maja | Rival battle theme, intense synth and electric guitar duel, driving drums, competitive and heroic, video game battle music |
| `battle_leader` | gym leaders | Gym leader battle theme, epic orchestral rock, brass and electric guitar, high stakes, video game boss battle music |
| `battle_boss` | Freja, Kaas, Enforcer Captain, Director | Villain boss battle theme, dark orchestral, low brass, choir pads, pounding drums, dramatic, video game final boss |
| `battle_fleet` | Deckhands, Bosun, Sailors | Pirate crew battle theme, minor-key sea shanty at battle tempo, fiddle and accordion with rock drums, video game battle |
| `battle_vanguard` | Grid Enforcers, Engineers, Vanguard staff, drones | Corporate villain grunt battle theme, cold electronic synths, aggressive bass, industrial drums, video game battle |
| `battle_legend` | Langelira, Kronvakt, Kronikon, The Last Echo | Legendary creature battle theme, majestic orchestra and choir, harp glissandos, awe and danger, video game legendary battle |
| `battle_lowhp` | your Pokémon under 1/4 HP | Urgent low health battle theme, tense staccato strings, alarm-like synth pulses, fast drums, video game danger music |
| `battle_elite` | Elite Four | Elite Four battle theme, epic orchestral rock, choir stabs, heroic and intense, video game elite battle music |
| `battle_champion` | the Champion | Champion final battle theme, grand orchestra with electric guitar and choir, triumphant and climactic, video game champion battle |
| `battle_lumen` | Lumen Nord | Sleek tech corporation villain battle theme, glossy cold synthwave, aggressive arps, ominous bass, video game boss battle |
| `victory_*` | after a win | Essentials OGG |

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
