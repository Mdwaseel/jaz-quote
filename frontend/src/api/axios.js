import axios from 'axios';
import { Endpoints } from './endpoints';
import { getCookie, setCookie, eraseCookie } from '../utils/cookies';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080/api/';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://127.0.0.1:8080/api/';

// Main API client (mirrors the original `Ce` axios instance).
const axiosServices = axios.create({ baseURL: API_URL });

// The original swaps baseURL to the auth host for auth calls.
const authPaths = [Endpoints.Login, Endpoints.Refresh, Endpoints.Logout];

// Public auth endpoints: a 401/400 here is a normal validation error
// (bad credentials, wrong OTP, expired reset link) — never trigger a token refresh.
const noRefreshPaths = [
  Endpoints.Login,
  Endpoints.VerifyOtp,
  Endpoints.ResendOtp,
  Endpoints.ForgotPassword,
  Endpoints.ResetPassword,
  Endpoints.Refresh,
  Endpoints.Logout
];

axiosServices.interceptors.request.use(
  (config) => {
    if (authPaths.includes(config.url)) {
      config.baseURL = AUTH_URL;
    }
    const token = getCookie('serviceToken');
    if (token && !config.headers.skipAuthRefresh) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

axiosServices.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const refreshToken = getCookie('refreshToken');
    const canRefresh =
      error.response?.status === 401 &&
      !original._retry &&
      !original.headers?.skipAuthRefresh &&
      !noRefreshPaths.includes(original.url) &&
      !!refreshToken; // no point refreshing when the user was never logged in
    if (canRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject })).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return axiosServices(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const res = await axios.post(`${AUTH_URL}${Endpoints.Refresh}`, { refreshToken });
        const newToken = res.data.accessToken;
        setCookie('serviceToken', newToken);
        setCookie('refreshToken', res.data.refreshToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return axiosServices(original);
      } catch (err) {
        processQueue(err, null);
        eraseCookie('serviceToken');
        eraseCookie('refreshToken');
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default axiosServices;
