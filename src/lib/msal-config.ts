import { Configuration, LogLevel } from '@azure/msal-browser';

const AZURE_CLIENT_ID = 'e9f08a61-0e07-4a60-b825-c6041cdf0505';
const AZURE_TENANT_ID = '05970e72-c674-4f1f-8033-6e35dd7f76aa';

const getRedirectUri = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/auth/callback';
  }
  return `${window.location.origin}/auth/callback`;
};

const REDIRECT_URI = getRedirectUri();

export const msalConfig: Configuration = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};
