export function notFound(req, res) {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.status(404).render('errors/status', {
    title: res.locals.t.notFound, status: 404,
    heading: res.locals.t.notFound, description: res.locals.t.notFoundBody,
    robots: 'noindex, nofollow', seo: {},
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  // Never log raw messages/URLs here: database errors can contain credentials.
  console.error(`[request-error] ${req.method} ${res.statusCode >= 400 ? res.statusCode : 500}`);
  if (req.app.get('env') !== 'production' && typeof error.stack === 'string') {
    // Show source locations locally without the error message or request values.
    const frames = error.stack.split('\n').filter((line) => /^\s+at /.test(line)).slice(0, 8);
    console.error(frames.join('\n'));
  }
  const status = ['entity.too.large', 'parameters.too.many'].includes(error.type) ? 413 : 500;
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.status(status).render('errors/status', {
    title: res.locals.t.error, status,
    heading: res.locals.t.error, description: res.locals.t.errorBody,
    robots: 'noindex, nofollow', seo: {},
  });
}
