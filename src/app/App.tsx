import { useCallback, useState } from 'react';
import { navigate, useRoute } from './router';
import { useIsTouch } from './useIsTouch';
import { useServices } from './services';
import { useUpdateCheck } from './useUpdateCheck';
import { StartPage } from '../ui/pages/StartPage';
import { GamePage } from '../ui/pages/GamePage';

/** Two pages: the start page (#/) and the fight (#/fight), with a view transition between them. */
export function App() {
  const route = useRoute();
  const touch = useIsTouch();
  const { audio } = useServices();
  const [muted, setMuted] = useState(audio.muted);
  const updateAvailable = useUpdateCheck();

  const fight = useCallback(() => {
    audio.unlock(); // user gesture: allowed to start Web Audio
    navigate('fight');
  }, [audio]);
  const menu = useCallback(() => navigate('start'), []);
  const toggleMute = useCallback(() => {
    audio.setMuted(!audio.muted);
    setMuted(audio.muted);
  }, [audio]);

  return (
    <div className={`sn-ui${touch ? ' touch' : ''}`}>
      {route === 'start'
        ? <StartPage key="start" touch={touch} onFight={fight} updateAvailable={updateAvailable} />
        : <GamePage key="fight" touch={touch} muted={muted} onToggleMute={toggleMute} onMenu={menu} updateAvailable={updateAvailable} />}
    </div>
  );
}
