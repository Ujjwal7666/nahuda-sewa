import { createHmac } from 'node:crypto';
export async function consumeRateLimit(db, secret, kind, specs, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  const expires_at = new Date((bucket + 1) * windowMs);
  // Reserve attempts before hashing; parallel requests cannot bypass the threshold.
  const rows = await db.$transaction(async (tx) => {
    const results = [];
    for (const [value] of specs) {
      const digest = createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
      const id = `${digest}:${bucket}`;
      // MySQL native atomic upsert avoids Prisma's read/create race on a new key.
      // Tagged values are bound parameters, never SQL string concatenation.
      await tx.$executeRaw`INSERT INTO auth_rate_limits (id, attempts, expires_at)
        VALUES (${id}, 1, ${expires_at}) ON DUPLICATE KEY UPDATE attempts = attempts + 1`;
      results.push(await tx.authRateLimit.findUnique({ where: { id } }));
    }
    return results;
  });
  return { allowed: rows.every((row, i) => row.attempts <= specs[i][1]),
    retryAfter: Math.max(1, Math.ceil((expires_at.getTime() - Date.now()) / 1000)) };
}
