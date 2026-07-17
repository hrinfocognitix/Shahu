import { STORAGE_KEYS } from '../../constants';

export const persistMiddleware = store => next => action => {
  const result = next(action);
  const auth = store.getState().auth;
  if (action.type === 'auth/logout') localStorage.removeItem(STORAGE_KEYS.auth);
  else localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(auth));
  return result;
};
