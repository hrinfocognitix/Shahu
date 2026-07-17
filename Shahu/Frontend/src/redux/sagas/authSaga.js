import { call, put, takeLatest } from 'redux-saga/effects';
import { toast } from 'react-toastify';
import { authService } from '../../services/auth.service';
import { loginFailure, loginRequest, loginSuccess } from '../slices/authSlice';

function* loginWorker(action) {
  try {
    const data = yield call(authService.login, action.payload);
    yield put(loginSuccess(data));
    toast.success('Logged in successfully');
  } catch (error) {
    yield put(loginFailure(error.response?.data?.message || 'Login failed'));
  }
}

export function* authSaga() {
  yield takeLatest(loginRequest.type, loginWorker);
}
