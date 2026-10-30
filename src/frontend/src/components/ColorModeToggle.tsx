import type { ReactNode } from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { useColorScheme } from '@mui/material/styles';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';

type ColorMode = 'light' | 'system' | 'dark';

const options: { value: ColorMode; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light mode', icon: <LightModeIcon fontSize="small" /> },
  { value: 'system', label: 'System mode', icon: <SettingsBrightnessIcon fontSize="small" /> },
  { value: 'dark', label: 'Dark mode', icon: <DarkModeIcon fontSize="small" /> },
];

/** Light / system / dark switch for the app bar. The choice is remembered by MUI in localStorage. */
export default function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();

  // mode is undefined until MUI has read the stored preference.
  if (!mode) {
    return null;
  }

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      onChange={(_, value: ColorMode | null) => value && setMode(value)}
      aria-label="Color mode"
      sx={{
        bgcolor: 'rgba(255, 255, 255, 0.12)',
        '& .MuiToggleButton-root': { color: 'common.white', border: 0 },
        '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
          color: 'common.white',
          bgcolor: 'rgba(255, 255, 255, 0.3)',
        },
      }}
    >
      {options.map(({ value, label, icon }) => (
        <Tooltip key={value} title={label}>
          <ToggleButton value={value} aria-label={label}>
            {icon}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
