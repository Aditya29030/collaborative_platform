// src/utils/api.js
// A single axios instance used everywhere, so we don't repeat the base URL
// and token-attaching logic in every component.

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// "Interceptor" = code that runs automatically before every request.
// Here we grab the JWT from localStorage (if we're logged in) and attach
// it to the Authorization header, so protected backend routes accept us.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
