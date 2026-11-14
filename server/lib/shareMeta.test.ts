// npx tsx --test server/lib/shareMeta.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionShareMeta, DEFAULT_SHARE_IMAGE, injectShareMeta, shareDescription } from "./shareMeta";

const session = {
  id: "s1",
  title: 'TC "Monday" <Social>',
  description: "Format: Mixed Doubles · Games to 4\n\nA **friendly** mixed doubles session.",
  coverImage: "data:image/png;base64,AAAA",
  organizationName: "Site Admin's Sessions",
  location: "Cahill Tennis Park",
};

test("share meta: title, plain description without the format line, a crawlable image, the permanent link", () => {
  const meta = buildSessionShareMeta(session, "https://www.tennisconnect.com.au", "Mon 9 Nov, 6:00 PM");
  assert.equal(meta.description, "A friendly mixed doubles session.");
  assert.equal(meta.image, DEFAULT_SHARE_IMAGE, "a data: URL can't be fetched by Facebook");
  assert.equal(meta.url, "https://www.tennisconnect.com.au/play/s1");
  assert.equal(shareDescription(null, "fallback"), "fallback");
});

test("tags are injected escaped, and the shell title is replaced", () => {
  const html = "<html><head><title>TennisConnect</title></head><body></body></html>";
  const out = injectShareMeta(html, buildSessionShareMeta(session, "https://x.test", "now"));
  assert.match(out, /<title>TC &quot;Monday&quot; &lt;Social&gt; \| TennisConnect<\/title>/);
  assert.match(out, /<meta property="og:url" content="https:\/\/x.test\/play\/s1" \/>/);
  assert.equal((out.match(/<title>/g) ?? []).length, 1);
  assert.ok(!out.includes("<Social>"), "nothing unescaped");
});
