import { JWT } from 'google-auth-library';

let authCache: JWT | null = null;

export function getServiceAccountAuth(): JWT {
  if (authCache) return authCache;

  authCache = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '')
      .replace(/\\n/g, '\n')
      .replace(/"/g, ''),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return authCache;
}
