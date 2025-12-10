import axios from "axios";

/**
 * Configured axios instance for API calls
 * Includes base URL, credentials, and JSON headers
 */
const api = axios.create({
  baseURL: window.location.origin,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle revoked tokens from backchannel logout
    if (
      error.response?.status === 401 &&
      error.response?.data?.error === "token_revoked"
    ) {
      // Clear any local state and redirect to login
      window.location.href = "/login?session=expired";
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

/**
 * Gets available authentication methods
 * @param {Object} params - Query parameters for filtering auth methods
 * @returns {Promise<Object>} Authentication methods configuration
 */
export const getAuthMethods = async (params = {}) => {
  const response = await api.get("/auth/methods", { params });
  return response.data;
};

/**
 * Authenticates user with username/password
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} Authentication response
 */
export const loginBasic = async (username, password) => {
  const response = await api.post("/auth/login/basic", { username, password });
  return response.data;
};

/**
 * Logs out current user
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

/**
 * Gets current authentication status
 * @returns {Promise<Object>} Authentication status
 */
export const getAuthStatus = async () => {
  const response = await api.get("/auth/status");
  return response.data;
};

export default api;
