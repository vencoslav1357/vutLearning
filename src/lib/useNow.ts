"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Aktuální čas použitelný během renderu.
 *
 * Proč vůbec hook: `Date.now()` v těle komponenty je nečistá funkce. Klientské
 * komponenty se renderují i na serveru, takže by serverové HTML vzniklo s jiným
 * číslem než první render v prohlížeči a hydratace by se rozešla.
 *
 * Hook proto vrací `null` na serveru i při hydratačním renderu a skutečný čas
 * dodá až po připojení. Volající se musí s `null` vypořádat – to je záměr,
 * nutí to rozhodnout, co se ukáže, než je čas známý.
 */

type Listener = () => void;

interface Clock {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => number | null;
}

/**
 * Hodiny žijí mimo React. Čas se měří až v `subscribe`, což běží po připojení –
 * do serverového HTML se tedy nemá jak dostat.
 */
function createClock(intervalMs: number): Clock {
  const listeners = new Set<Listener>();
  let now: number | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  function tick() {
    now = Date.now();
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      // První odběratel čas změří; React si hned potom přečte nový snímek.
      if (now === null) tick();
      if (intervalMs > 0 && timer === undefined) timer = setInterval(tick, intervalMs);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    getSnapshot: () => now,
  };
}

/** Na serveru čas neexistuje – komponenta se musí umět vykreslit i bez něj. */
const serverSnapshot = () => null;

/**
 * Čas připojení komponenty, nebo `null`, dokud se komponenta nepřipojila.
 *
 * Výchozí chování je jednorázové měření: hodnota se po připojení už nemění.
 * `intervalMs > 0` zapne pravidelné obnovování pro odpočty a podobně; bere se
 * z prvního renderu, pozdější změna se ignoruje.
 */
export function useNow(intervalMs = 0): number | null {
  // Hodiny jsou vlastní pro každou komponentu, aby si dvě místa v aplikaci
  // navzájem nepřepisovala čas a nepřekreslovala se kvůli sobě.
  const [clock] = useState(() => createClock(intervalMs));
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, serverSnapshot);
}
