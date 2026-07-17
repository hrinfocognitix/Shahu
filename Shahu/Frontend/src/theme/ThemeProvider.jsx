import { createContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { darkTheme } from './darkTheme';
import { lightTheme } from './lightTheme';

export const ThemeContext = createContext(lightTheme);

export function ThemeProvider({ children }) {
  const mode = useSelector(state => state.ui.themeMode);
  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  return (
    <ThemeContext.Provider value={theme}>
      <div data-theme={mode}>{children}</div>
    </ThemeContext.Provider>
  );
}
