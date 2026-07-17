import { useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../theme/ThemeProvider';
import { setThemeMode } from '../redux/slices/uiSlice';

export function useTheme() {
  const theme = useContext(ThemeContext);
  const dispatch = useDispatch();
  const mode = useSelector(state => state.ui.themeMode);
  const toggleTheme = () => dispatch(setThemeMode(mode === 'dark' ? 'light' : 'dark'));
  return { theme, mode, toggleTheme };
}
