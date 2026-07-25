import * as SecureStore from 'expo-secure-store';

export const VERA_MOBILE_SESSION_TOKEN_KEY = 'vera.mobile.auth.bearerToken';

async function isSecureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSessionToken() {
  try {
    if (!(await isSecureStoreAvailable())) {
      return null;
    }

    return await SecureStore.getItemAsync(VERA_MOBILE_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string) {
  try {
    if (!(await isSecureStoreAvailable())) {
      return false;
    }

    await SecureStore.setItemAsync(VERA_MOBILE_SESSION_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export async function clearSessionToken() {
  try {
    if (!(await isSecureStoreAvailable())) {
      return false;
    }

    await SecureStore.deleteItemAsync(VERA_MOBILE_SESSION_TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}
