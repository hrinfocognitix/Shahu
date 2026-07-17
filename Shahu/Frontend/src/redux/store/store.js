import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import authReducer from '../slices/authSlice';
import uiReducer from '../slices/uiSlice';
import { persistMiddleware } from '../middleware/persistMiddleware';
import { rootSaga } from '../sagas/rootSaga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware, persistMiddleware)
});

sagaMiddleware.run(rootSaga);
