const pending = new WeakMap();

export function cancelImageRequest(image) {
  pending.get(image)?.();
  image.onload = null; image.onerror = null;
  image.removeAttribute('src');
}

export function requestImage(image, url, settle, timeoutMs = 15000) {
  pending.get(image)?.();
  let finished = false;
  const cleanup = () => { clearTimeout(timer); pending.delete(image); image.onload = null; image.onerror = null; };
  const complete = ok => { if (finished) return; finished = true; cleanup(); settle(ok); if (!ok) image.removeAttribute('src'); };
  const timer = setTimeout(() => complete(false), timeoutMs);
  pending.set(image, () => { finished = true; cleanup(); });
  image.onload = () => complete(true);
  image.onerror = () => complete(false);
  image.src = url;
}
