const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, mod, mod.exports);
  return mod.exports;
}
const theme = load('src/lib/creatorTheme.ts');
const categories = load('src/lib/discoverCategories.ts');
const discover = load('src/lib/discoverApi.ts', { '@/lib/config': { API_URL: 'https://api.test' }, '@/lib/api': {}, '@/lib/discoverCategories': categories });
const music = load('src/lib/creatorMusic.ts', { '@/lib/discoverApi': discover });
let response;
const requests = [];
const postRequest = async (path, options) => { requests.push({ path, options }); return typeof response === 'function' ? response(path) : response; };
const creators = load('src/lib/creatorApi.ts', { '@/lib/creatorMusic': music, '@/lib/creatorTheme': theme, '@/lib/postApi': { postRequest }, '@/lib/discoverApi': discover, '@/lib/discoverCategories': categories });
const profile = load('src/lib/creatorProfileApi.ts', { '@/lib/creatorApi': creators, '@/lib/postApi': { postRequest } });
const raw = { creator: { id: 'c1', userId: 'u1', subscriptionPriceCents: 500, currency: 'cad', bannerUrl: '/banner.jpg', bannerPositionY: 20, theme: { key: 'royal', accent: '#fbbf24' }, stats: { posts: 12, likes: 1400, views: 8200 }, categories: ['MUSIC'], foundingCreator: true, canMessage: true, profile: { displayName: ' Artist ', username: '@artist', avatarUrl: '/avatar.jpg', bio: ' Bio ' } } };
const creator = creators.normalizeCreator(raw, 'c1');
const viewer = { loggedIn: true, subscribed: false, owner: false, ageConfirmed: true };
const row = { kind: 'CONTENT', moderationStatus: 'ACTIVE', id: 'p1', canView: true, mediaType: 'IMAGE', mediaUrl: 'https://cdn.test/full', thumbnailUrl: 'https://cdn.test/thumb', previewUrl: 'https://cdn.test/full-preview', previewMediaUrl: 'https://cdn.test/approved-preview', allowPreview: true, accessRequired: 'subscription', createdAt: '2026-10-01', likeCount: 2, commentCount: 3 };
const page = (posts = [row], extra = {}) => ({ posts, viewer, creator: { creatorUserId: 'u1' }, mode: 'public', nextCursor: null, ...extra });
const data = () => ({ creator, ...profile.normalizeCreatorPosts(page(), creator) });
class ApiError extends Error { constructor(status) { super('Unavailable'); this.status = status; this.userMessage = 'Unavailable'; } }
const { CreatorProfileLoader } = load('src/lib/creatorProfileLoader.ts', { '@/lib/creatorMusic': music, '@/lib/api': { ApiError }, '@/lib/creatorProfileApi': profile });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('public profile fetch resolves Creator.id then requests posts using User.id with no cookie or dashboard mode', async () => {
  requests.length = 0;
  response = path => path.includes('/id/') ? raw : page();
  const signal = new AbortController().signal;
  const result = await profile.getCreatorProfile('c1', signal);
  assert.equal(result.creator.profile.displayName, 'Artist');
  assert.deepEqual(requests.map(r => r.path), ['/api/creators/id/c1', '/api/creators/u1/posts']);
  for (const req of requests) { assert.equal(req.options.signal, signal); assert.equal(req.options.credentials, 'omit'); assert.equal(req.options.cache, 'no-store'); }
});
test('display names and usernames normalize, including missing names', () => {
  assert.equal(creator.profile.username, 'artist');
  assert.equal(creators.normalizeCreator({ creator: { ...raw.creator, profile: { username: '@@artist' } } }, 'c1').profile.displayName, 'artist');
  const absent = creators.normalizeCreator({ creator: { id: 'c1', userId: 'u1' } }, 'c1');
  assert.equal(absent.profile.displayName, 'Vera creator'); assert.equal(absent.profile.username, null); assert.equal(absent.profile.bio, null);
});
test('safe public image URLs, absent/broken fallback inputs and banner position bounds', () => {
  assert.equal(creator.bannerUrl, 'https://api.test/banner.jpg');
  const c = creators.normalizeCreator({ creator: { ...raw.creator, bannerUrl: 'javascript:alert(1)', bannerPositionY: 500, profile: { avatarUrl: 'storage:private' } } }, 'c1');
  assert.equal(c.bannerUrl, null); assert.equal(c.profile.avatarUrl, null); assert.equal(c.bannerPositionY, 100);
});
test('invalid accent and badge inputs cannot replace the Vera theme', () => {
  const c = creators.normalizeCreator({ creator: { ...raw.creator, theme: { accent: '#fff;background:red' }, foundingCreator: 'true' } }, 'c1');
  assert.equal(c.accent, theme.VERA_ACCENT); assert.equal(c.foundingCreator, false);
});
test('creator allowlist excludes admin, financial and verification fields', () => {
  const c = creators.normalizeCreator({ creator: { ...raw.creator, stripeAccountId: 'secret', email: 'secret', verificationProvider: 'secret', profile: { ...raw.creator.profile, address: 'secret' } } }, 'c1');
  assert.equal(JSON.stringify(c).includes('secret'), false); assert.throws(() => creators.normalizeCreator(raw, 'other'));
});
test('free accessible posts retain server-authorized image media', () => {
  const p = profile.normalizeCreatorPosts(page([{ ...row, accessRequired: null }]), creator).posts[0];
  assert.equal(p.mediaUrl, row.mediaUrl); assert.equal(p.canView, true); assert.equal(p.locked, false);
});
test('non-subscriber locked posts strip full media, thumbs, full preview and unmodeled carousel refs', () => {
  const p = profile.normalizeCreatorPosts(page([{ ...row, canView: false, media: [{ url: 'secret' }], admin: 'secret' }]), creator).posts[0];
  assert.equal(p.mediaUrl, null); assert.equal(p.thumbnailUrl, null); assert.equal(p.previewUrl, null); assert.equal(p.media, undefined); assert.equal(p.admin, undefined);
  assert.equal(p.locked, true);
});
test('approved video preview stays separate from full media and only permits opening Post Detail', () => {
  const p = profile.normalizeCreatorPosts(page([{ ...row, mediaType: 'VIDEO', canView: false }]), creator).posts[0];
  assert.equal(p.previewMediaUrl, row.previewMediaUrl); assert.equal(p.mediaUrl, null);
});
test('used, denied and age-restricted previews are withheld', () => {
  for (const patch of [{ previewUsed: true }, { allowPreview: false }, { isAgeLocked: true }]) {
    const p = profile.normalizeCreatorPosts(page([{ ...row, canView: false, ...patch }]), creator).posts[0];
    assert.equal(p.previewMediaUrl, null); assert.equal(p.allowPreview, false);
  }
  assert.equal(profile.normalizeCreatorPosts(page([{ ...row, isAgeLocked: true }]), creator).posts[0].mediaUrl, null);
});
test('subscription/owner flags never override per-post denial and subscribed viewers retain entitled media', () => {
  const p = profile.normalizeCreatorPosts(page([{ ...row, canView: false }], { viewer: { ...viewer, subscribed: true, owner: true } }), creator).posts[0];
  assert.equal(p.mediaUrl, null);
  assert.equal(profile.normalizeCreatorPosts(page([row], { viewer: { ...viewer, subscribed: true } }), creator).posts[0].mediaUrl, row.mediaUrl);
});
test('cross-creator response, dashboard data and missing entitlement are rejected', () => {
  for (const extra of [{ creator: { creatorUserId: 'other' } }, { mode: 'dashboard' }, { viewer: {} }]) assert.throws(() => profile.normalizeCreatorPosts(page([row], extra), creator));
  assert.throws(() => profile.normalizeCreatorPosts(page([{ ...row, creatorId: 'other' }]), creator));
  assert.throws(() => profile.normalizeCreatorPosts(page([{ ...row, canView: undefined }]), creator));
});
test('removed posts/placeholders are omitted and duplicate IDs are collapsed', () => {
  assert.deepEqual(profile.normalizeCreatorPosts(page([row, row, { ...row, id: 'removed', moderationStatus: 'REMOVED' }, { kind: 'PLACEHOLDER' }]), creator).posts.map(p => p.id), ['p1']);
});
test('membership CTAs reflect guest, subscribed and own profile state; URLs encode IDs without tokens', () => {
  assert.equal(profile.membershipLabel(viewer), 'Subscribe on website');
  assert.equal(profile.membershipLabel({ ...viewer, subscribed: true }), 'Membership active');
  assert.equal(profile.membershipLabel({ ...viewer, owner: true }), 'Your creator page');
  assert.equal(profile.creatorMembershipUrl('a/b'), 'https://verapage.com/c/a%2Fb#subscription');
  assert.equal(profile.creatorMessageUrl('u1'), 'https://verapage.com/messages?to=u1');
});
test('messaging availability is explicit and excludes guests and owners', () => {
  assert.equal(profile.canMessageCreator(creator, viewer), true);
  for (const v of [{ ...viewer, loggedIn: false }, { ...viewer, owner: true }]) assert.equal(profile.canMessageCreator(creator, v), false);
  assert.equal(profile.canMessageCreator({ ...creator, canMessage: false }, viewer), false);
});
test('creator not found, invalid auth and empty profiles have explicit states', async () => {
  for (const status of [404, 401]) {
    const loader = new CreatorProfileLoader(() => {}, async () => { throw new ApiError(status); });
    await loader.load('c1'); assert.equal(loader.state.data, null); assert.equal(loader.state.loading, false);
    assert.equal(loader.state.notFound, status === 404); assert.equal(loader.state.unauthorized, status === 401);
  }
  const loader = new CreatorProfileLoader(() => {}, async () => ({ ...data(), posts: [] }));
  await loader.load('c1'); assert.deepEqual(loader.state.data.posts, []); assert.equal(loader.state.error, null);
});
test('navigation and unmount abort stale requests, even if the transport ignores cancellation', async () => {
  const pending = [];
  const loader = new CreatorProfileLoader(() => {}, (id, signal) => { const p = deferred(); pending.push({ ...p, signal }); return p.promise; });
  const first = loader.load('old'); const second = loader.load('c1');
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(data()); await second; pending[0].resolve({ creator: { id: 'old' } }); await first;
  assert.equal(loader.state.data.creator.id, 'c1');
  const third = loader.load('new'); loader.cancel(); pending[2].reject(new Error('stale')); await third; assert.equal(loader.state.error, null);
});
test('refresh loads canonical state once, withholds cached signed media and rejects overlapping refresh', async () => {
  let calls = 0; const pending = deferred();
  const loader = new CreatorProfileLoader(() => {}, async () => ++calls === 1 ? data() : pending.promise);
  await loader.load('c1'); const refresh = loader.load('c1', true);
  assert.equal(loader.state.refreshing, true); assert.equal(loader.state.data, null);
  await loader.load('c1', true); assert.equal(calls, 2);
  pending.resolve({ ...data(), posts: [], viewer: { ...viewer, subscribed: false } }); await refresh;
  assert.equal(loader.state.refreshing, false); assert.deepEqual(loader.state.data.posts, []);
});
test('failed refresh withholds old access; pagination cursor and deduplication use canonical results', async () => {
  let fail = false;
  const loader = new CreatorProfileLoader(() => {}, async () => { if (fail) throw new Error('offline'); return { ...data(), nextCursor: 'p1' }; }, async (c, cursor) => {
    assert.equal(c.id, 'c1'); assert.equal(cursor, 'p1'); return { ...data(), posts: [data().posts[0], { ...data().posts[0], id: 'p2' }], nextCursor: null };
  });
  await loader.load('c1'); await loader.more(); assert.deepEqual(loader.state.data.posts.map(p => p.id), ['p1', 'p2']);
  fail = true; await loader.load('c1', true); assert.equal(loader.state.data, null); assert.ok(loader.state.error);
});
test('pagination viewer-access changes discard cached protected posts; expired auth discards the entire profile', async () => {
  const loader = new CreatorProfileLoader(() => {}, async () => ({ ...data(), nextCursor: 'p1' }), async () => ({ posts: [], viewer: { ...viewer, subscribed: true }, nextCursor: null }));
  await loader.load('c1'); await loader.more(); assert.deepEqual(loader.state.data.posts, []);
  const denied = new CreatorProfileLoader(() => {}, async () => ({ ...data(), nextCursor: 'p1' }), async () => { throw new ApiError(401); });
  await denied.load('c1'); await denied.more(); assert.equal(denied.state.data, null); assert.equal(denied.state.unauthorized, true);
});
// Small component-tree harness follows the project's dependency-free test convention.
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx, Fragment: 'Fragment' };
let hookState = [], hookIndex = 0;
const react = { useState(initial) { const i = hookIndex++; if (!(i in hookState)) hookState[i] = initial; return [hookState[i], next => { hookState[i] = next; }]; } };
const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: x => x, absoluteFill: { position: 'absolute' } } };
function nodes(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...nodes(node.props.children)];
}
const textOf = node => nodes(node).filter(n => typeof n === 'string').join(' ');
const header = load('src/components/creator/CreatorProfileHeader.tsx', { 'react/jsx-runtime': runtime, react, 'react-native': native, 'expo-image': { Image: 'Image' }, '@/lib/creatorTheme': theme, '@/lib/discoverCategories': categories, '@/lib/creatorProfileApi': profile });
function renderHeader(c = creator, v = viewer) { hookIndex = 0; return header.CreatorProfileHeader({ creator: c, viewer: v, onMembership() {}, onMessage() {} }); }
test('header renders public bio/badges/categories and broken avatar/banner fall back', () => {
  hookState = []; let tree = renderHeader(); assert.match(textOf(tree), /Bio/); assert.match(textOf(tree), /Founding creator/); assert.match(textOf(tree), /Music/);
  nodes(tree).filter(n => n.type === 'Image').forEach(n => n.props.onError());
  tree = renderHeader(); assert.equal(nodes(tree).filter(n => n.type === 'Image').length, 0); assert.match(textOf(tree), /VERA/); assert.match(textOf(tree), /A/);
  tree = renderHeader({ ...creator, profile: { ...creator.profile, bio: null, avatarUrl: null }, bannerUrl: null });
  assert.doesNotMatch(textOf(tree), /Bio/);
});
test('platinum header keeps dark surfaces/readable action colors and owner has no Subscribe CTA', () => {
  hookState = []; const tree = renderHeader({ ...creator, themeKey: 'platinum' }, { ...viewer, owner: true });
  assert.doesNotMatch(textOf(tree), /Subscribe on website/);
  assert.ok(nodes(tree).some(n => typeof n === 'object' && (JSON.stringify(n.props.style) || '').includes('#e2e8f0')));
  assert.equal(theme.creatorTheme('platinum').onAccent, '#12091F');
});
let navigation;
const router = { push: target => { navigation = target; } };
const card = load('src/components/feed/FeedPostCard.tsx', { 'react/jsx-runtime': runtime, 'react-native': native, 'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'Symbol' }, 'expo-router': { router }, '@/components/feed/FeedVideo': { FeedVideo: 'FeedVideo' }, '@/hooks/usePostActions': { usePostActions: post => ({ post }) }, '@/lib/postMedia': load('src/lib/postMedia.ts'), '@/lib/postApi': { REPORT_REASONS: [] } });
test('profile video thumbnails never mount a player; tap opens existing post detail', () => {
  const post = profile.normalizeCreatorPosts(page([{ ...row, mediaType: 'VIDEO' }]), creator).posts[0];
  const tree = card.FeedPostCard({ post, videoThumbnails: true, visible: false });
  assert.equal(nodes(tree).some(n => n.type === 'FeedVideo'), false);
  const button = nodes(tree).find(n => n.props?.accessibilityLabel === 'Open video post'); button.props.onPress();
  assert.deepEqual(navigation, { pathname: '/post/[postId]', params: { postId: 'p1' } });
  assert.equal(nodes(tree).some(n => n.type === 'Image' && n.props.source.uri === row.thumbnailUrl), true);
});
test('locked profile video shows no full/preview image and Home retains its existing player default', () => {
  const post = profile.normalizeCreatorPosts(page([{ ...row, mediaType: 'VIDEO', canView: false }]), creator).posts[0];
  const tree = card.FeedPostCard({ post, videoThumbnails: true, lockedMessage: 'Open this post for a preview.' });
  assert.equal(nodes(tree).some(n => n.type === 'FeedVideo'), false);
  assert.equal(nodes(tree).some(n => n.type === 'Image' && n.props.source.uri !== creator.profile.avatarUrl), false);
  assert.match(textOf(tree), /preview/);
  assert.equal(nodes(card.FeedPostCard({ post })).some(n => n.type === 'FeedVideo'), true);
});
test('Discover navigation still supplies the public Creator.id', () => {
  hookState = []; hookIndex = 0;
  const discoverCard = load('src/components/discover/DiscoverCreatorCard.tsx', { 'react/jsx-runtime': runtime, react, 'react-native': native, 'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'Symbol' }, 'expo-router': { router }, '@/lib/discoverCategories': categories });
  const tree = discoverCard.DiscoverCreatorCard({ creator: { id: 'c1', displayName: 'Artist', categories: [] } });
  tree.props.onPress(); assert.deepEqual(navigation, { pathname: '/creator/[creatorId]', params: { creatorId: 'c1' } });
});

test('public stats are validated, zero is real, missing totals stay absent and private metrics are discarded', () => {
  assert.deepEqual(creator.stats, { posts: 12, likes: 1400, views: 8200 });
  const normalize = stats => creators.normalizeCreator({ creator: { ...raw.creator, stats } }, 'c1').stats;
  for (const stats of [null, undefined, {}, { posts: -1, likes: 0, views: 0 }, { posts: 1, likes: '2', views: 3 }, { posts: 1, likes: 2, views: NaN }]) assert.equal(normalize(stats), null);
  assert.deepEqual(normalize({ posts: 0, likes: 0, views: 0, revenue: 'secret', subscribers: 999 }), { posts: 0, likes: 0, views: 0 });
});
test('header displays exactly the public stats labels, omits missing stats and keeps exact accessibility counts', () => {
  hookState = [];
  let tree = renderHeader();
  const labels = nodes(tree).filter(n => n.props?.accessibilityLabel?.match(/^\d+ (posts|likes|views)$/)).map(n => n.props.accessibilityLabel);
  assert.deepEqual(labels, ['12 posts', '1400 likes', '8200 views']);
  assert.match(textOf(tree), /Likes/); assert.match(textOf(tree), /Views/); assert.doesNotMatch(textOf(tree), /Followers|Subscribers|Revenue/);
  tree = renderHeader({ ...creator, stats: null });
  assert.doesNotMatch(textOf(tree), /Likes|Views/);
});
test('Message is an enabled secondary button only when server-authorized, otherwise disabled without an action', () => {
  for (const c of [creator, { ...creator, canMessage: false }]) {
    hookState = []; const tree = renderHeader(c);
    const button = nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel?.startsWith('Message'));
    assert.equal(button.props.disabled, !c.canMessage);
    assert.equal(button.props.accessibilityState.disabled, !c.canMessage);
    assert.equal(typeof button.props.onPress, c.canMessage ? 'function' : 'undefined');
    assert.equal(textOf(button), c.canMessage ? 'Message' : 'Message unavailable');
    assert.ok(button.props.style.some(s => s?.borderColor === theme.creatorTheme(c.themeKey).accent));
  }
});
test('creator key chooses canonical accent, ignores arbitrary API colors and missing/unknown keys fall back to Vera', () => {
  for (const [key, accent] of Object.entries(theme.CREATOR_THEME_ACCENTS)) {
    const c = creators.normalizeCreator({ creator: { ...raw.creator, theme: { key, accent: '#000000' } } }, 'c1');
    assert.equal(c.themeKey, key); assert.equal(c.accent, accent);
  }
  for (const key of [undefined, null, 'invalid', 'constructor', '__proto__']) assert.equal(theme.creatorTheme(key).accent, theme.VERA_ACCENT);
});
const profileCard = load('src/components/creator/CreatorProfilePostCard.tsx', { 'react/jsx-runtime': runtime, 'react-native': native, 'expo-router': { router }, 'expo-symbols': { SymbolView: 'Symbol' }, '@/components/feed/FeedPostCard': card, '@/lib/creatorProfileApi': profile, '@/lib/creatorTheme': theme });
const lockedPost = patch => profile.normalizeCreatorPosts(page([{ ...row, mediaType: 'VIDEO', canView: false, ...patch }]), creator).posts[0];
function renderProfileCard(post) { return profileCard.CreatorProfilePostCard({ post, themeKey: creator.themeKey, onMembership() { navigation = 'membership'; } }); }
test('compact locked profile panel without preview says Subscribe to unlock, uses membership and loads no protected media', () => {
  const tree = renderProfileCard(lockedPost({ allowPreview: false }));
  assert.match(textOf(tree), /Subscribe to unlock/); assert.doesNotMatch(textOf(tree), /Locked video|Watch preview/);
  assert.equal(nodes(tree).some(n => n.type === 'FeedVideo'), false);
  assert.equal(nodes(tree).some(n => n.type === 'Image' && n.props.source.uri !== creator.profile.avatarUrl), false);
  nodes(tree).find(n => n.props?.accessibilityLabel === 'View membership').props.onPress(); assert.equal(navigation, 'membership');
});
test('approved video preview exposes Watch preview and a separate membership CTA; tap routes to existing Post Detail', () => {
  const tree = renderProfileCard(lockedPost({}));
  assert.match(textOf(tree), /Preview available/); assert.match(textOf(tree), /Subscribe to unlock the full post/);
  nodes(tree).find(n => n.props?.accessibilityLabel === 'Watch preview').props.onPress();
  assert.deepEqual(navigation, { pathname: '/post/[postId]', params: { postId: 'p1' } });
  assert.equal(nodes(tree).some(n => n.type === 'FeedVideo'), false);
});
test('preview eligibility requires the server flag, separate asset, video type, unused claim and no age restriction', () => {
  assert.equal(profile.hasCreatorPostPreview(lockedPost({})), true);
  for (const patch of [{ allowPreview: false }, { previewMediaUrl: null }, { previewUsed: true }, { isAgeLocked: true }, { mediaType: 'IMAGE' }, { previewMediaUrl: 'mux:playback:FULL1234' }, { previewMediaUrl: '/images/private-post-lock.png' }]) {
    const post = lockedPost(patch); assert.equal(profile.hasCreatorPostPreview(post), false);
    assert.doesNotMatch(textOf(renderProfileCard(post)), /Watch preview/);
  }
});
test('used preview returns to subscription CTA; age-restricted posts retain age confirmation', () => {
  const tree = renderProfileCard(lockedPost({ previewUsed: true }));
  assert.match(textOf(tree), /Subscribe to unlock the full post/); assert.doesNotMatch(textOf(tree), /Watch preview/);
  const age = renderProfileCard(lockedPost({ isAgeLocked: true }));
  assert.match(textOf(age), /Age confirmation required/); assert.ok(nodes(age).some(n => n.props?.accessibilityLabel === 'Confirm age on website'));
});
test('subscribed entitled viewer receives normal post media, not the locked profile panel', () => {
  const post = profile.normalizeCreatorPosts(page([{ ...row, mediaType: 'VIDEO' }], { viewer: { ...viewer, subscribed: true } }), creator).posts[0];
  const tree = renderProfileCard(post); assert.doesNotMatch(textOf(tree), /Subscribe to unlock|Watch preview/);
  assert.ok(nodes(tree).some(n => n.type === 'Image' && n.props.source.uri === row.thumbnailUrl));
});
test('refresh reloads changed preview flag, canonical duration and removed posts without independent preview cache', async () => {
  let settings = { allowPreview: true, previewDurationSeconds: 8, previewStartSeconds: 2 };
  const loader = new CreatorProfileLoader(() => {}, async () => ({ creator, ...profile.normalizeCreatorPosts(page([{ ...row, mediaType: 'VIDEO', canView: false, ...settings }]), creator) }));
  await loader.load('c1'); assert.equal(profile.hasCreatorPostPreview(loader.state.data.posts[0]), true); assert.equal(loader.state.data.posts[0].previewDurationSeconds, 8);
  settings = { allowPreview: false, previewDurationSeconds: 3 };
  await loader.load('c1', true); assert.equal(profile.hasCreatorPostPreview(loader.state.data.posts[0]), false); assert.equal(loader.state.data.posts[0].previewDurationSeconds, 3);
  settings = { moderationStatus: 'REMOVED' }; await loader.load('c1', true); assert.deepEqual(loader.state.data.posts, []);
});
