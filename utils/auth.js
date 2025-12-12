import configLoader from '../config/configLoader.js';

/**
 * Validate user credentials against local users in config
 * Simplified: Just validates credentials, no role checking
 */
export const isValidUser = credentials => {
  const users = configLoader.getAuthUsers();
  const foundUser = users.find(
    userItem => userItem.username === credentials.name && userItem.password === credentials.pass
  );

  return foundUser || false;
};

/**
 * Get user permissions (simplified for terminal app)
 * Returns empty array since authentication is binary: authenticated = can access terminal
 */
export const getUserPermissions = () =>
  // Simplified: Permissions kept in JWT for future extensibility but not actively used
  // Authentication is handled by requireAuthentication middleware
  [];
