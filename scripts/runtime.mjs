import fs from 'node:fs';
import path from 'node:path';

export function requireNew(paths) {
  for (const file of paths) {
    try { fs.lstatSync(file); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    throw Error(`Output already exists: ${path.basename(file)}`);
  }
}

export function publish(source, target) { fs.linkSync(source, target); }

export function assetPath(root, requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  const relativeUrl = pathname === '/' ? 'studio.html' : pathname.slice(1);
  if (relativeUrl.split('/').some(part => part.startsWith('.'))) return null;
  const allowed = relativeUrl === 'studio.html' || relativeUrl === 'config.json' ||
    /^(src|assets)\/(?!.*(?:^|\/)\.)[^?]*\.(js|css|png|jpg|webp|svg|woff2)$/.test(relativeUrl);
  if (!allowed) return null;
  const file = fs.realpathSync(path.resolve(root, relativeUrl));
  const relative = path.relative(fs.realpathSync(root), file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(file).isFile()) return null;
  return file;
}
