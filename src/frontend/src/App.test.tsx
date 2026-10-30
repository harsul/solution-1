import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { renderWithTheme } from './test/render';

const forecasts = [
  { date: '2026-11-01', temperatureC: 20, temperatureF: 67, summary: 'Mild' },
  { date: '2026-11-02', temperatureC: -5, temperatureF: 24, summary: 'Chilly' },
];

function mockFetch(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('App weather forecast', () => {
  it('loads and shows the forecasts from the API', async () => {
    const fetchMock = mockFetch({ ok: true, json: async () => forecasts });

    renderWithTheme(<App />);

    expect(await screen.findByText('Mild')).toBeInTheDocument();
    expect(screen.getByText('Chilly')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/weatherforecast');
  });

  it('switches between Fahrenheit and Celsius', async () => {
    mockFetch({ ok: true, json: async () => forecasts });
    renderWithTheme(<App />);
    await screen.findByText('Mild');

    expect(screen.getByLabelText('Temperature: 67 degrees Fahrenheit')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Celsius' }));

    expect(screen.getByLabelText('Temperature: 20 degrees Celsius')).toBeInTheDocument();
  });

  it('shows an error when the API fails', async () => {
    mockFetch({ ok: false, status: 500 });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithTheme(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP error! status: 500');
  });
});
