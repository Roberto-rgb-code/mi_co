import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { maybeAutoStartTour, startTour, tourIdFromPath, type TourId } from '../tours';
import './TourButton.css';

export function TourButton() {
  const { pathname } = useLocation();
  const tourId = tourIdFromPath(pathname);

  useEffect(() => {
    if (!tourId) return;
    maybeAutoStartTour(tourId);
  }, [tourId, pathname]);

  if (!tourId) return null;

  return (
    <button
      type="button"
      className="tour-fab"
      data-tour="tour-btn"
      title="Ver tour de esta pantalla"
      aria-label="Iniciar tour guiado"
      onClick={() => startTour(tourId as TourId, { force: true })}
    >
      ?
    </button>
  );
}
