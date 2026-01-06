// src/utils/cookie.helper.ts
import { Response } from 'express';

interface CookieOptions {
  httpOnly?: boolean;
  maxAge?: number;
}

export const setCookie = (
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(name, value, {
    httpOnly: options.httpOnly ?? false,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    ...(isProd && { domain: '.ielbanbuena.online' }),
    ...(options.maxAge && { maxAge: options.maxAge }),
  });
};

export const clearCookie = (res: Response, name: string) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie(name, {
    path: '/',
    ...(isProd && { domain: '.ielbanbuena.online' }),
  });
};
