import { useDispatch, useSelector } from 'react-redux';
import { loginRequest, logout } from '../redux/slices/authSlice';

export function useAuth() {
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);
  return {
    ...auth,
    isAuthenticated: Boolean(auth.accessToken),
    login: payload => dispatch(loginRequest(payload)),
    logout: () => dispatch(logout())
  };
}
