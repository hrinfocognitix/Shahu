import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { setupInterceptors } from './api/interceptors';
import { App } from './App';
import { store } from './redux/store/store';
import { ThemeProvider } from './theme/ThemeProvider';
import './translations/i18n';
import './styles/global.css';

setupInterceptors();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
