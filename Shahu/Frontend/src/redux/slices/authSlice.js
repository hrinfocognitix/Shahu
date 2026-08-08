import { createSlice } from '@reduxjs/toolkit';
import { STORAGE_KEYS } from '../../constants';

const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.auth) || 'null');

const initialState = persisted || {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginRequest(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action) {
      state.loading = false;
      state.user = action.payload.user;
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
    },
    loginFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    refreshTokenSuccess(state, action) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    passwordChanged(state) {
      if (state.user) state.user.mustChangePassword = false;
    },
    profileUpdated(state, action) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
    logout() {
      return { user: null, accessToken: null, refreshToken: null, loading: false, error: null };
    },
  },
});

export const {
  loginRequest,
  loginSuccess,
  loginFailure,
  refreshTokenSuccess,
  passwordChanged,
  profileUpdated,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
