import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import * as client from 'openid-client';
import { URL } from 'url';
import configLoader from './configLoader.js';
import { getUserModel } from '../models/User.js';
import { authLogger as logger } from './logger.js';
import { t } from './i18n.js';

// Store OIDC configurations globally
const oidcConfigurations = new Map();

const matchDomain = (email, pattern) => {
  if (pattern === '*') {
    return true;
  }
  if (pattern.startsWith('*@')) {
    const domain = pattern.slice(2);
    return email.endsWith(`@${domain}`);
  }
  if (pattern.startsWith('O=')) {
    // Handle Distinguished Name organization patterns
    return email.includes(pattern);
  }
  return email === pattern;
};

const matchClaim = (userinfo, rule) => {
  const claimValue = userinfo[rule.claim];
  if (!claimValue) {
    return false;
  }

  if (Array.isArray(claimValue)) {
    return rule.values.some(value => claimValue.includes(value));
  }

  return rule.values.includes(claimValue);
};

export const resolveUserPermissions = (email, userinfo) => {
  const authConfig = configLoader.getAuthenticationConfig();
  const strategy = authConfig.permission_strategy || 'domain_based';
  const permissions = [];

  if (strategy === 'domain_based') {
    const domainMappings = authConfig.domain_mappings || {};

    // Use original email (DN) for permission matching
    const originalEmail = userinfo.email || email;

    const terminalAccessDomains = domainMappings.terminal_access || [];
    if (terminalAccessDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      permissions.push('terminal_access');
    }

    const terminalAdminDomains = domainMappings.terminal_admin || [];
    if (terminalAdminDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      permissions.push('terminal_admin');
    }
  } else if (strategy === 'claims_based') {
    const claimsMappings = authConfig.claims_mappings || {};

    const terminalAccessClaims = claimsMappings.terminal_access || [];
    if (terminalAccessClaims.some(rule => matchClaim(userinfo, rule))) {
      permissions.push('terminal_access');
    }

    const terminalAdminClaims = claimsMappings.terminal_admin || [];
    if (terminalAdminClaims.some(rule => matchClaim(userinfo, rule))) {
      permissions.push('terminal_admin');
    }
  }

  return permissions;
};

export const resolveUserRole = (provider, email, userinfo) => {
  const authConfig = configLoader.getAuthenticationConfig();
  const strategy = authConfig.permission_strategy || 'domain_based';

  if (strategy === 'domain_based') {
    // Use provider-specific role mappings for domain-based strategy
    const providerConfig = authConfig.oidc_providers[provider];
    const roleMappings = providerConfig?.role_mappings || {};

    // Use original email (DN) for role matching
    const originalEmail = userinfo.email || email;

    // Check admin role first
    const adminDomains = roleMappings.admin || [];
    if (adminDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      return 'admin';
    }

    // Check user role
    const userDomains = roleMappings.user || [];
    if (userDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      return 'user';
    }
  } else if (strategy === 'claims_based') {
    // For claims-based strategy, check if userinfo contains role claim
    const roleClaim = userinfo.role || userinfo.roles;

    if (roleClaim) {
      // Handle both string and array role claims
      const roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];

      // Check for admin role variations
      if (
        roles.some(role => ['admin', 'administrator', 'superuser'].includes(role.toLowerCase()))
      ) {
        return 'admin';
      }

      // Default to user role if other roles present
      if (roles.length > 0) {
        return 'user';
      }
    }
  }

  // Default role if no mapping matches
  return 'user';
};

export const handleOidcUser = async (provider, userinfo) => {
  const User = getUserModel();
  let { email } = userinfo;

  // Handle DN format when no email provided using fallback_domain
  if (email && email.startsWith('CN=') && !email.includes('@')) {
    const authConfig = configLoader.getAuthenticationConfig();
    const providerConfig = authConfig.oidc_providers[provider];
    const fallbackDomain = providerConfig?.fallback_domain;

    if (fallbackDomain) {
      const cnMatch = email.match(/CN=(?<name>[^/]+)/);
      if (cnMatch) {
        const userName = cnMatch.groups.name.toLowerCase().replace(/\s+/g, '.');
        email = `${userName}@${fallbackDomain}`;

        logger.info(t('logs.convertedDnToEmail'), {
          originalDN: userinfo.email,
          convertedEmail: email,
          fallbackDomain,
          provider,
        });
      }
    }
  }

  const name = userinfo.name || userinfo.given_name || userinfo.CN || email.split('@')[0];
  const subject = userinfo.sub;
  const providerKey = `oidc-${provider}`;

  let user = await User.findOne({
    where: { provider: providerKey, subject },
  });

  if (!user) {
    const permissions = resolveUserPermissions(email, userinfo);
    const role = resolveUserRole(provider, email, userinfo);

    user = await User.create({
      email,
      name,
      provider: providerKey,
      subject,
      permissions,
      role,
      last_login: new Date(),
    });

    logger.info(t('logs.createdNewOidcUser', { email, role, permissions: permissions.join(', ') }));
  } else {
    const permissions = resolveUserPermissions(email, userinfo);
    const role = resolveUserRole(provider, email, userinfo);
    await user.update({
      permissions,
      role,
      last_login: new Date(),
    });

    logger.info(t('logs.updatedOidcUser', { email, role, permissions: permissions.join(', ') }));
  }

  return user;
};

// Get OIDC configuration for a provider
export const getOidcConfiguration = providerName => oidcConfigurations.get(providerName);

// Generate authorization URL for a provider
export const buildAuthorizationUrl = async (providerName, redirectUri, state, codeVerifier) => {
  const config = oidcConfigurations.get(providerName);
  if (!config) {
    throw new Error(`OIDC configuration not found for provider: ${providerName}`);
  }

  const authConfig = configLoader.getAuthenticationConfig();
  const providerConfig = authConfig.oidc_providers[providerName];

  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  const authParams = {
    redirect_uri: redirectUri,
    scope: providerConfig.scope || 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  };

  logger.info(t('logs.authorizationUrlDebug'), {
    provider: providerName,
    clientId: providerConfig.client_id,
    authParams,
  });

  const authUrl = client.buildAuthorizationUrl(config, authParams);

  logger.info(t('logs.generatedAuthorizationUrl'), {
    provider: providerName,
    url: authUrl.toString(),
    clientIdInUrl: authUrl.searchParams.get('client_id'),
  });

  return authUrl;
};

// Generate end session URL for RP-initiated logout
export const buildEndSessionUrl = (providerName, postLogoutRedirectUri, state, idTokenHint) => {
  const config = oidcConfigurations.get(providerName);
  if (!config) {
    throw new Error(`OIDC configuration not found for provider: ${providerName}`);
  }

  if (!config.serverMetadata().end_session_endpoint) {
    logger.warn(
      `Provider ${providerName} does not support end_session_endpoint, skipping RP-initiated logout`
    );
    return null;
  }

  const endSessionParams = {
    post_logout_redirect_uri: postLogoutRedirectUri,
    state,
    id_token_hint: idTokenHint,
  };

  logger.info(t('logs.endSessionUrlDebug'), {
    provider: providerName,
    endSessionParams,
    endSessionEndpoint: config.serverMetadata().end_session_endpoint,
  });

  const endSessionUrl = client.buildEndSessionUrl(config, endSessionParams);

  logger.info(t('logs.generatedEndSessionUrl'), {
    provider: providerName,
    url: endSessionUrl.toString(),
  });

  return endSessionUrl;
};

// Handle OIDC callback
export const handleOidcCallback = async (providerName, currentUrl, state, codeVerifier) => {
  const config = oidcConfigurations.get(providerName);
  if (!config) {
    throw new Error(`OIDC configuration not found for provider: ${providerName}`);
  }

  try {
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      expectedState: state,
      pkceCodeVerifier: codeVerifier,
    });

    const userinfo = tokens.claims();
    const user = await handleOidcUser(providerName, userinfo);

    return { user, tokens };
  } catch (error) {
    logger.error(`OIDC callback error for ${providerName}:`, error);
    throw error;
  }
};

export const setupPassportStrategies = async () => {
  const authConfig = configLoader.getAuthenticationConfig();

  // Setup JWT strategy
  passport.use(
    'jwt',
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: authConfig.jwt_secret,
        issuer: 'web-terminal',
        audience: 'web-terminal-users',
      },
      async (payload, done) => {
        try {
          const User = getUserModel();
          const user = await User.findByPk(payload.userId);

          if (!user) {
            return done(null, false, { message: t('auth.invalidTokenUserNotFound') });
          }

          return done(null, {
            userId: user.id,
            email: user.email,
            name: user.name,
            provider: user.provider,
            permissions: user.permissions,
            role: user.role,
          });
        } catch (error) {
          logger.error(t('logs.jwtStrategyError'), { error: error.message });
          return done(error, false);
        }
      }
    )
  );

  // Setup OIDC configurations
  const oidcProviders = authConfig.oidc_providers || {};

  const providerPromises = Object.entries(oidcProviders)
    .filter(([, providerConfig]) => providerConfig.enabled)
    .filter(([providerName, providerConfig]) => {
      if (!providerConfig.issuer || !providerConfig.client_id || !providerConfig.client_secret) {
        logger.error(t('logs.invalidOidcProviderConfig', { provider: providerName }));
        return false;
      }
      return true;
    })
    .map(async ([providerName, providerConfig]) => {
      try {
        logger.info(t('logs.settingUpOidcProvider', { provider: providerName }));

        const authMethod = providerConfig.token_endpoint_auth_method || 'client_secret_basic';
        logger.info(t('logs.usingAuthMethod', { authMethod, provider: providerName }));

        // Create custom fetch function for debugging and Basic auth fix
        const customFetch = async (url, options = {}) => {
          // Fix Basic auth URL encoding bug for token endpoint requests
          if (url.toString().includes('/token') && authMethod === 'client_secret_basic') {
            const credentials = `${providerConfig.client_id}:${providerConfig.client_secret}`;
            const base64Credentials = Buffer.from(credentials, 'utf-8').toString('base64');

            logger.info(t('logs.customBasicAuthFix'), {
              originalCredentials: credentials,
              base64Encoded: base64Credentials,
              authHeader: `Basic ${base64Credentials}`,
            });

            options.headers = {
              ...options.headers,
              authorization: `Basic ${base64Credentials}`,
            };
          }

          // Debug logging
          logger.debug(t('logs.debuggingOutgoingHttpRequest'), {
            url: url.toString(),
            method: options.method || 'GET',
            headers: options.headers || {},
            hasBody: !!options.body,
            bodyPreview: options.body ? options.body.toString().substring(0, 200) : null,
          });

          // Special attention to Authorization header
          if (options.headers?.authorization || options.headers?.Authorization) {
            const authHeader = options.headers.authorization || options.headers.Authorization;
            logger.info(t('logs.authorizationHeaderDetails'), {
              authHeader,
              isBasic: authHeader.startsWith('Basic '),
              length: authHeader.length,
            });

            if (authHeader.startsWith('Basic ')) {
              const base64Part = authHeader.substring(6);
              try {
                const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
                logger.info(t('logs.decodedBasicAuth'), {
                  base64: base64Part,
                  decoded,
                  expectedPattern: 'downloads:clientsecret',
                });
              } catch (decodeError) {
                logger.error(t('logs.basicAuthDecodeError'), { error: decodeError.message });
              }
            }
          }

          // Call the actual fetch
          const response = await fetch(url, options);

          logger.info(t('logs.httpResponse'), {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          });

          return response;
        };

        // Create standard client authentication method
        let clientAuth;
        switch (authMethod) {
          case 'client_secret_basic':
            clientAuth = client.ClientSecretBasic(providerConfig.client_secret);
            break;
          case 'client_secret_post':
            clientAuth = client.ClientSecretPost(providerConfig.client_secret);
            break;
          case 'none':
            clientAuth = client.None();
            break;
          default:
            clientAuth = client.ClientSecretBasic(providerConfig.client_secret);
        }

        // Discover issuer and create configuration with custom fetch
        const config = await client.discovery(
          new URL(providerConfig.issuer),
          providerConfig.client_id,
          providerConfig.client_secret,
          clientAuth,
          {
            [client.customFetch]: customFetch,
          }
        );

        // Store configuration for later use
        oidcConfigurations.set(providerName, config);

        logger.info(t('logs.oidcProviderConfigured', { provider: providerName }));
        return { success: true, provider: providerName };
      } catch (error) {
        logger.error(t('logs.failedToSetupOidcProvider', { provider: providerName }), {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name,
          code: error.code,
        });
        return { success: false, provider: providerName, error };
      }
    });

  await Promise.allSettled(providerPromises);
};

export default passport;
