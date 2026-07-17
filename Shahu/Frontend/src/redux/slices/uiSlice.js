import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    themeMode: localStorage.getItem('theme-mode') || 'light',
    locale: localStorage.getItem('locale') || 'en'
  },
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setThemeMode(state, action) {
      state.themeMode = action.payload;
      localStorage.setItem('theme-mode', action.payload);
    },
    setLocale(state, action) {
      state.locale = action.payload;
      localStorage.setItem('locale', action.payload);
    }
  }
});

export const { toggleSidebar, setThemeMode, setLocale } = uiSlice.actions;
export default uiSlice.reducer;
