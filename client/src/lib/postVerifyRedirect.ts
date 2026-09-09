// Registering used to log a user straight in, so auth.tsx could just
// read ?returnTo/?joinSession off the current URL and redirect
// immediately. Now registration only sends a verification email - the
// person confirms it (often the same device, but a fresh page load,
// sometimes a different tab entirely) before any session exists, so
// there's no request left carrying those query params by the time
// verify-email.tsx runs. This stashes them at registration time and
// verify-email.tsx picks them back up after a successful confirmation,
// so "register to join this session" still lands them back on the
// session instead of just their own profile.
//
// localStorage, not sessionStorage: the verification link is very
// likely to be opened in a new tab (mail client "open link" behaviour),
// which sessionStorage wouldn't share with the tab that started
// registration.

const STORAGE_KEY = "tc_post_verify_redirect";

interface PostVerifyRedirect {
  returnTo: string;
  joinSession?: string;
}

export function savePostVerifyRedirect(redirect: PostVerifyRedirect) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(redirect));
  } catch {
    // Private browsing / storage disabled - not worth failing
    // registration over, the person just lands on /complete-profile
    // instead of back where they started.
  }
}

export function consumePostVerifyRedirect(): PostVerifyRedirect | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
