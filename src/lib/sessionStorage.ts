import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'vera.mobile.sessionToken';

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

    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string) {
  try {
    if (!(await isSecureStoreAvailable())) {
      return false;
    }

    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
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

    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}
