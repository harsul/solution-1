import { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiFetch } from '../../api/apiFetch';

interface WeatherForecast {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary: string;
}

type TemperatureUnit = 'F' | 'C';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit>('F');

  const fetchWeatherForecast = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/api/weatherforecast');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: WeatherForecast[] = await response.json();
      setWeatherData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
      console.error('Error fetching weather forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherForecast();
  }, []);

  const unitName = unit === 'C' ? 'Celsius' : 'Fahrenheit';

  return (
    <Card component="section" aria-labelledby="weather-heading" variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <Typography id="weather-heading" variant="h5" component="h2">
            Weather Forecast
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={unit}
              onChange={(_, value: TemperatureUnit | null) => value && setUnit(value)}
              aria-label="Temperature unit"
            >
              <ToggleButton value="F" aria-label="Fahrenheit">
                °F
              </ToggleButton>
              <ToggleButton value="C" aria-label="Celsius">
                °C
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              onClick={fetchWeatherForecast}
              disabled={loading}
              aria-label={loading ? 'Loading weather forecast' : 'Refresh weather forecast'}
              startIcon={
                <RefreshIcon
                  sx={{
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                  }}
                />
              }
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {loading && weatherData.length === 0 && (
          <Box role="status" aria-label="Loading weather data" sx={forecastGrid}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={120} aria-hidden="true" />
            ))}
          </Box>
        )}

        {weatherData.length > 0 && (
          <Box sx={forecastGrid}>
            {weatherData.map((forecast) => {
              const temperature = unit === 'C' ? forecast.temperatureC : forecast.temperatureF;
              return (
                <Paper
                  key={forecast.date}
                  component="article"
                  variant="outlined"
                  aria-label={`Weather for ${formatDate(forecast.date)}`}
                  sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  <Typography variant="subtitle2" component="h3" color="text.secondary">
                    <time dateTime={forecast.date}>{formatDate(forecast.date)}</time>
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {forecast.summary}
                  </Typography>
                  <Box aria-label={`Temperature: ${temperature} degrees ${unitName}`}>
                    <Typography variant="h4" component="span" color="primary" aria-hidden="true">
                      {temperature}°
                    </Typography>
                    <Typography variant="caption" color="text.secondary" aria-hidden="true" sx={{ ml: 0.5 }}>
                      {unitName}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

const forecastGrid = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
} as const;
