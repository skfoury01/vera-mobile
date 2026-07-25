const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

function normalizeApiUrl(value: string | undefined) {
  if (!value) {
    if (__DEV__) {
      throw new Error(
        'Missing EXPO_PUBLIC_API_URL. Set it to the Vera API origin for mobile development.'
      );
    }

    return '';
  }

  return value.replace(/\/+$/, '');
}

export const API_URL = normalizeApiUrl(rawApiUrl);
