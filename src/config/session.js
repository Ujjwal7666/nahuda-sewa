export const cookieName = 'nahuda.admin.sid';
export function cookieOptions(config) {
  return { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/admin',
    maxAge: config.sessionLifetimeMs };
}
