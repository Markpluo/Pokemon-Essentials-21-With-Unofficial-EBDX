// Visits every map in the Debug warp list by day and at night and screenshots it, so a human or an
// agent can look over bot/results/shots/ after a change to art, maps or the day-night tint.
import { test, expect } from '../lib/bot';
import { afterStarter } from '../lib/saves';

const MAPS = ['norrebro', 'route1', 'garden', 'tunnels', 'indreby', 'nyhavn', 'drydock', 'route4', 'christianshavn', 'stadsgraven', 'dragor', 'route2', 'vesterbro', 'kodbyen', 'route3', 'islandsbrygge', 'assistens', 'frederiksberg', 'osterbro', 'route8', 'lyngby', 'dyrehaven', 'bakken', 'trekroner', 'slotsholmen', 'shipyards', 'copenhill', 'helsingor', 'stormhill', 'kalvebod', 'kalvebodrange', 'route10', 'roskilde', 'tivoli'];

for (const time of ['day', 'night'] as const) {
  test(`every map by ${time} @maps`, async ({ bot }) => {
    await bot.loadSave(afterStarter());
    await bot.debug('Toggle wild encounters');
    if (time === 'night') { await bot.debug('Clock +6 hours'); await bot.debug('Clock +6 hours'); }
    for (const map of MAPS) {
      const s = await bot.warp(map);
      expect(s.map).toBe(`hafnia:${map}`);
      await bot.shot(`${map}-${time}`);
    }
  });
}
