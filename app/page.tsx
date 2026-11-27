import WeatherDashboard from '@/components/WeatherDashboard';
import { getGoogleMapsApiKey } from '@/lib/maps-config';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const mapsApiKey = getGoogleMapsApiKey();

  return <WeatherDashboard mapsApiKey={mapsApiKey} />;
}
