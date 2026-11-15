// One place that decides what "your session expired" means, so every
// section of the app reacts the same way when the server says 401.
export function isSessionExpired(err) {
  return Boolean(err && err.status === 401);
}
