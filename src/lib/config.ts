const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_URL =
  configuredApiUrl && configuredApiUrl.length > 0
    ? configuredApiUrl.replace(/\/+$/, '')
    : 'https://verapage.com';
