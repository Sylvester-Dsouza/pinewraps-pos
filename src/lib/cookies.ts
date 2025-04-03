'use client';

import Cookies from 'js-cookie';

const TOKEN_NAME = 'firebase-token';

export async function setAuthToken(token: string): Promise<boolean> {
  try {
    Cookies.set(TOKEN_NAME, token, {
      expires: 1, // 1 day
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    return true;
  } catch (error) {
    console.error('Error setting auth token:', error);
    return false;
  }
}

export async function getAuthToken(): Promise<string | undefined> {
  try {
    return Cookies.get(TOKEN_NAME);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return undefined;
  }
}

export async function removeAuthToken(): Promise<void> {
  try {
    Cookies.remove(TOKEN_NAME, { path: '/' });
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
}
