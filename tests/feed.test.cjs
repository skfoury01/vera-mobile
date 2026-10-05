const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const media = load('src/lib/postMedia.ts');
const base = { mediaType: 'VIDEO', canView: true, mediaUrl: 'https://cdn.test/full.mp4', thumbnailUrl: 'https://cdn.test/thumb.jpg', previewMediaUrl: 'https://cdn.test/preview.mp4', allowPreview: true };
test('video selects full media only with affirmative backend entitlement', () => {
  assert.equal(media.selectVideoUrl(base), base.mediaUrl);
  for (const canView of [false, undefined, null]) {
    assert.equal(media.selectVideoUrl({ ...base, canView, allowPreview: false }), null);
    assert.equal(media.selectVideoUrl({ ...base, canView }), base.previewMediaUrl);
  }
});
test('locked videos never fall back to full media or thumbnails', () => {
  assert.equal(media.selectVideoUrl({ ...base, canView: false, previewMediaUrl: null }), null);
  assert.equal(media.selectVideoUrl({ ...base, mediaUrl: null }), null);
  assert.equal(media.selectVideoUrl({ ...base, canView: false, previewMediaUrl: '/images/private-post-lock.png' }), null);
});
test('locked image media is withheld and entitled images still work', () => {
  assert.equal(media.selectMediaUrl({ ...base, mediaType: 'IMAGE', canView: false }), null);
  assert.equal(media.selectMediaUrl({ ...base, mediaType: 'IMAGE' }), base.mediaUrl);
});
test('Mux refs are validated and videos do not use poster URLs', () => {
  assert.equal(media.muxPlaybackId('mux:playback:ABC123_def'), 'ABC123_def');
  assert.equal(media.muxPlaybackId('mux:playback:../secret'), null);
  assert.equal(media.selectVideoUrl({ ...base, mediaType: 'IMAGE' }), null);
});
test('like and bookmark normalization preserve explicit server false states', () => {
  assert.deepEqual(media.normalizeLike({ liked: false, likeCount: 7.9 }), { viewerHasLiked: false, likeCount: 7 });
  assert.deepEqual(media.normalizeLike({ liked: true, likeCount: -4 }), { viewerHasLiked: true, likeCount: 0 });
  assert.deepEqual(media.normalizeBookmark({ bookmarked: false }), { viewerHasBookmarked: false });
  for (const value of [null, {}, { liked: true, likeCount: NaN }, { liked: 'yes', likeCount: 3 }]) assert.throws(() => media.normalizeLike(value));
  assert.throws(() => media.normalizeBookmark({ bookmarked: 'yes' }));
});
let removed = 0;
const api = load('src/lib/api.ts', { './config': { API_URL: 'https://api.test' }, './sessionStorage': { clearSessionToken: async () => { removed++; }, getSessionToken: async () => 'native-token', setSessionToken: async () => true } });
const feed = load('src/lib/feedApi.ts', { '@/lib/api': api });
test('feed parsing rejects invalid response shapes', () => {
  assert.throws(() => feed.normalizeFeedResponse({ error: 'failure' }));
  assert.throws(() => feed.normalizeFeedResponse(null));
  assert.deepEqual(feed.normalizeFeedResponse({ posts: [], nextCursor: 'cursor' }).nextCursor, 'cursor');
});
test('shared request serializes JSON and native bearer auth without cookies', async () => {
  const previous = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.test/api/bookmarks');
    assert.equal(options.headers.get('Authorization'), 'Bearer native-token');
    assert.equal(options.body, '{"postId":"post1","action":"add"}');
    return new Response('{"bookmarked":true}', { headers: { 'content-type': 'application/json' } });
  };
  try { assert.deepEqual(await api.apiRequest('/api/bookmarks', { method: 'POST', token: 'native-token', body: { postId: 'post1', action: 'add' } }), { bookmarked: true }); }
  finally { global.fetch = previous; }
});
test('401 clears stored native session and throws consistent ApiError', async () => {
  const previous = global.fetch;
  global.fetch = async () => new Response('{"error":"invalid_mobile_session"}', { status: 401, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(api.apiRequest('/api/feed/fyp', { token: 'native-token' }), e => e instanceof api.ApiError && e.status === 401);
    assert.equal(removed, 1);
  } finally { global.fetch = previous; }
});
test('successful HTML and malformed JSON never become successful action responses', async () => {
  const previous = global.fetch;
  try {
    for (const response of [new Response('<html>Login</html>'), new Response('{bad', { headers: { 'content-type': 'application/json' } })]) {
      global.fetch = async () => response;
      await assert.rejects(api.apiRequest('/api/posts/1'), e => e instanceof api.ApiError && e.code === 'invalid_response');
    }
  } finally { global.fetch = previous; }
});
test('timeout and caller cancellation remain distinguishable', async () => {
  const previous = global.fetch;
  global.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  try {
    await assert.rejects(api.apiRequest('/slow', { timeoutMs: 5 }), e => e.code === 'request_timeout');
    const controller = new AbortController();
    const request = api.apiRequest('/cancel', { signal: controller.signal }); controller.abort();
    await assert.rejects(request, e => e.name === 'AbortError');
  } finally { global.fetch = previous; }
});
const postApi = load('src/lib/postApi.ts', { '@/lib/api': api, '@/lib/postMedia': media });
test('locked Mux preview never calls the full-media playback endpoint', async () => {
  const previous = global.fetch;
  global.fetch = async () => { throw new Error('Protected full media must never be requested'); };
  try {
    assert.equal(await postApi.resolveVideoUrl('locked', 'mux:playback:ABC123_def', undefined, false), null);
    assert.equal(await postApi.resolveVideoUrl('locked', 'https://cdn.test/preview.mp4', undefined, false), 'https://cdn.test/preview.mp4');
    assert.equal(postApi.postShareUrl('post1'), 'https://verapage.com/p/post1');
  } finally { global.fetch = previous; }
});
test('an old 401 cannot delete a newer stored session token', async () => {
  const previous = global.fetch;
  global.fetch = async () => new Response('{"error":"expired"}', { status: 401, headers: { 'content-type': 'application/json' } });
  const before = removed;
  try {
    await assert.rejects(api.apiRequest('/api/posts/1/like', { token: 'old-token' }), e => e.status === 401);
    assert.equal(removed, before);
  } finally { global.fetch = previous; }
});
test('one-time preview requires the real server allowed response', async () => {
  const previous = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.test/api/posts/locked/preview/use');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.get('Authorization'), 'Bearer native-token');
      return new Response('{"allowed":false,"reason":"already_used"}', { headers: { 'content-type': 'application/json' } });
    };
    await assert.rejects(postApi.claimPostPreview('locked'), /already used/);
    global.fetch = async () => new Response('{"allowed":true}', { headers: { 'content-type': 'application/json' } });
    await postApi.claimPostPreview('locked');
  } finally { global.fetch = previous; }
});
