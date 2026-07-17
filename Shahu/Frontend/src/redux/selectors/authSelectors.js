export const selectIsAuthenticated = state => Boolean(state.auth.accessToken);
export const selectCurrentUser = state => state.auth.user;
