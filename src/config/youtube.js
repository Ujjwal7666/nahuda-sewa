// Store only a canonical YouTube watch URL; never accept embed markup or arbitrary hosts.
export function youtubeVideo(value) {
  if(typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url=new URL(value);
    if(url.protocol !== 'https:' || url.username || url.password || url.port || !['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be','www.youtube-nocookie.com'].includes(url.hostname)) return null;
    let id;
    if(['youtu.be','www.youtu.be'].includes(url.hostname)) id=/^\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    else if(url.pathname === '/watch' && url.searchParams.getAll('v').length === 1 && url.hostname !== 'www.youtube-nocookie.com') id=url.searchParams.get('v');
    else id=/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    if(!/^[A-Za-z0-9_-]{11}$/.test(id||'')) return null;
    return {id,watch:`https://www.youtube.com/watch?v=${id}`,embed:`https://www.youtube-nocookie.com/embed/${id}`};
  } catch {return null;}
}
