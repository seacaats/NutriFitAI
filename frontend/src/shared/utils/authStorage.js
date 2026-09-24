import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The refresh token lives in an httpOnly cookie set by the backend (authController.js )
 * and is never touched here — only the short-lived access token is stored client-side, 
 * for attaching to Authorization headers on authenticated requests
 */
const ACCESS_TOKEN_KEY = "nutrifit.accessToken";

let cachedToken = null;

export async function setAccessToken(token) {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export async function getAccessToken() {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return cachedToken;
}

export async function clearAccessToken() {
  cachedToken = null;
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}