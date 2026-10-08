import { createContext, useContext } from 'react';
import type { Audio } from '../audio/index';
import type { GameController } from '../game/controller';
import type { InputController } from '../game/input';

/** Long-lived, non-React game services, created once during loading (see main.tsx). */
export interface Services {
  audio: Audio;
  input: InputController;
  game: GameController;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('useServices: missing <ServicesContext.Provider>');
  return s;
}
