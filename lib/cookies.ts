'use client';

/**
 * Cookie utility functions for managing client-side cookies
 */

interface CookieOptions {
  days?: number;
  path?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Set a cookie with the given name and value
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') return;

  const {
    days = 365, // Default to 1 year
    path = '/',
    secure = window.location.protocol === 'https:',
    sameSite = 'lax'
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    cookieString += `; expires=${date.toUTCString()}`;
  }
  
  cookieString += `; path=${path}`;
  
  if (secure) {
    cookieString += '; secure';
  }
  
  cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    let c = cookie.trim();
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length));
    }
  }
  
  return null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string, path: string = '/'): void {
  if (typeof document === 'undefined') return;
  
  setCookie(name, '', { days: -1, path });
}