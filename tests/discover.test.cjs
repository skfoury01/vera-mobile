const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
class ApiError extends Error { constructor(message) { super(message); this.userMessage = message; } }
const categories = load('src/lib/discoverCategories.ts');
const requests = [];
let response = { creators: [] };
const row = { id: 'creator-id', userId: 'different-user-id', status: 'APPROVED', isSearchVisible: true, categories: ['MUSIC'], username: 'artist', displayName: 'Artist', avatarUrl: '/avatar.png', foundingCreator: true };
const api = load('src/lib/discoverApi.ts', {
  '@/lib/config': { API_URL: 'https://api.test' },
  '@/lib/discoverCategories': categories,
  '@/lib/api': { apiRequest: async (path, options) => { requests.push({ path, options }); return response; } },
});
const { DiscoverLoader } = load('src/lib/discoverLoader.ts', { '@/lib/discoverApi': api, '@/lib/api': { ApiError } });
const options = (category = 'all', query = '', sort = 'default') => ({ category, query, sort });
const params = opts => new URL(api.discoverRequestPath(opts), 'https://api.test').searchParams;

test('category identifiers and labels exactly match website CategoryOption', () => {
  assert.deepEqual(categories.CREATOR_CATEGORIES, ['GAMING', 'FITNESS', 'ART', 'LIFESTYLE', 'MUSIC', 'EDUCATION', 'OTHER']);
  assert.equal(categories.categoryLabel('GAMING'), 'Gaming');
  assert.equal(categories.categoryLabel('all'), 'All');
});
test('All omits the category filter; selecting each category changes the public request', () => {
  assert.equal(params(options()).has('category'), false);
  for (const category of categories.CREATOR_CATEGORIES) assert.equal(params(options(category)).get('category'), category);
});
test('category normalization uses website uppercase and empty-array singular fallback', () => {
  assert.deepEqual(categories.creatorCategories(['music', 'MUSIC', 'UNKNOWN'], 'ART'), ['MUSIC']);
  assert.deepEqual(categories.creatorCategories([], 'gaming'), ['GAMING']);
  assert.equal(categories.normalizeCategory('ALL'), 'all');
  assert.equal(categories.normalizeCategory('Fitness'), 'FITNESS');
});
test('regression: Gaming exists only in Featured while organic creators is empty', () => {
  const gaming = { ...row, id: 'gaming', categories: ['GAMING', 'LIFESTYLE', 'OTHER'], featuredSource: 'ORGANIC' };
  const data = { creators: [], featuredCreators: [gaming] };
  assert.equal(api.normalizeDiscoverResponse(data, 'GAMING')[0].id, 'gaming');
  assert.equal(api.normalizeDiscoverResponse(data, 'LIFESTYLE')[0].placement, 'featured');
  assert.deepEqual(api.normalizeDiscoverResponse(data, 'MUSIC'), []);
});
test('featured and organic creators are deduplicated without client ranking and sponsorship stays labeled', () => {
  const data = { creators: [row, { ...row, id: 'second' }], featuredCreators: [{ ...row, isSponsored: true }] };
  const result = api.normalizeDiscoverResponse(data);
  assert.deepEqual(result.map(c => c.id), ['creator-id', 'second']);
  assert.equal(result[0].placement, 'sponsored');
  assert.equal(result[1].placement, null);
});
test('hidden, banned, unapproved and malformed records never surface in either pool', () => {
  for (const patch of [{ isSearchVisible: false }, { isSearchVisible: undefined }, { status: 'PENDING' }, { status: undefined }, { bannedAt: 'today' }, { userBannedAt: 'today' }, { id: '' }]) {
    const hidden = { ...row, ...patch };
    assert.deepEqual(api.normalizeDiscoverResponse({ creators: [hidden], featuredCreators: [hidden] }), []);
  }
  assert.deepEqual(api.normalizeDiscoverResponse({ creators: [null, {}, 1] }), []);
  for (const invalid of [null, {}, { creators: null }, { creators: [], featuredCreators: {} }]) assert.throws(() => api.normalizeDiscoverResponse(invalid));
});
test('search respects category, name, username, bio and website fallback filtering', async () => {
  response = { creators: [row], featuredCreators: [{ ...row, id: 'other', categories: ['ART'], displayName: 'Someone', username: 'different' }] };
  const signal = new AbortController().signal;
  const result = await api.getDiscoverCreators(options('MUSIC', '@@ARTIST', 'new'), signal);
  assert.equal(result.length, 1);
  const req = requests.at(-1);
  assert.equal(new URL(req.path, 'https://api.test').pathname, '/api/discover/creators');
  assert.equal(new URL(req.path, 'https://api.test').searchParams.get('q'), 'artist');
  assert.equal(new URL(req.path, 'https://api.test').searchParams.get('sort'), 'new');
  assert.equal(req.options.signal, signal);
  assert.equal(req.options.credentials, 'omit');
  assert.deepEqual(api.normalizeDiscoverResponse(response, 'MUSIC', 'no match'), []);
  assert.equal(api.normalizeDiscoverResponse({ creators: [{ ...row, bio: 'Unique bio' }] }, 'MUSIC', 'unique').length, 1);
});
test('ranking modes map to website default/all, trending, new and top_pick', () => {
  assert.deepEqual(categories.DISCOVER_MODES.map(mode => mode.value), ['default', 'trending', 'new', 'top_pick']);
  assert.equal(params(options()).has('sort'), false);
  for (const mode of ['trending', 'new', 'top_pick']) assert.equal(params(options('GAMING', 'name', mode)).get('sort'), mode);
  assert.equal(params(options()).has('limit'), false); // Same backend default of 50.
  assert.equal(categories.DISCOVER_PAGE_SIZE, 12); // Website progressive reveal.
});
test('missing profile data stays missing and unsafe avatar sources are rejected', () => {
  const [creator] = api.normalizeDiscoverResponse({ creators: [{ ...row, username: null, displayName: ' ', bio: undefined, avatarUrl: 'javascript:alert(1)', foundingCreator: 'true' }] });
  assert.equal(creator.username, null);
  assert.equal(creator.displayName, null);
  assert.equal(creator.bio, null);
  assert.equal(creator.avatarUrl, null);
  assert.equal(creator.foundingCreator, false);
  assert.equal(api.avatarSource('storage:private/avatar'), null);
  assert.equal(api.avatarSource('/avatar.png'), 'https://api.test/avatar.png');
});
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
test('switching categories immediately clears results and stale successes/errors cannot overwrite the new category', async () => {
  const pending = [];
  const loader = new DiscoverLoader(() => {}, (opts, signal) => {
    const request = deferred(); pending.push({ ...request, opts, signal }); return request.promise;
  });
  loader.schedule(options('MUSIC'));
  await tick();
  loader.schedule(options('GAMING'));
  assert.equal(loader.state.loading, true);
  assert.deepEqual(loader.state.creators, []);
  assert.equal(pending[0].signal.aborted, true);
  await tick();
  pending[1].resolve([{ id: 'gaming' }]); await tick();
  pending[0].resolve([{ id: 'music' }]); await tick();
  assert.deepEqual(loader.state.creators, [{ id: 'gaming' }]);
  loader.schedule(options('ART')); await tick();
  loader.schedule(options('OTHER')); await tick();
  pending[2].reject(new Error('stale error')); await tick();
  assert.equal(loader.state.error, null);
  assert.equal(loader.state.loading, true);
  pending[3].resolve([]); await tick();
  assert.equal(loader.state.loading, false);
  assert.deepEqual(loader.state.creators, []);
  loader.cancel();
});
test('search debounce cancels earlier scheduled requests and unmount prevents writes', async () => {
  const calls = [];
  const pending = deferred();
  const loader = new DiscoverLoader(() => {}, opts => { calls.push(opts); return pending.promise; });
  loader.schedule(options('MUSIC', 'a'), 15);
  loader.schedule(options('MUSIC', 'artist'), 15);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].query, 'artist');
  loader.cancel();
  pending.resolve([{ id: 'late' }]); await tick();
  assert.deepEqual(loader.state.creators, []);
});
test('empty categories finish loading; API errors stay recoverable and refresh cannot overlap', async () => {
  let count = 0;
  const loader = new DiscoverLoader(() => {}, async () => { count++; if (count === 1) throw new ApiError('Connection unavailable'); return []; });
  await loader.load(options());
  assert.equal(loader.state.error, 'Connection unavailable');
  assert.equal(loader.state.loading, false);
  await loader.load(options());
  assert.equal(loader.state.error, null);
  assert.deepEqual(loader.state.creators, []);
  const pending = deferred();
  let refreshes = 0;
  const refreshLoader = new DiscoverLoader(() => {}, () => { refreshes++; return pending.promise; });
  const initial = refreshLoader.load(options());
  await refreshLoader.load(options(), true);
  assert.equal(refreshes, 1);
  pending.resolve([]); await initial;
});
const jsx = (type, props) => ({ type, props });
let navigation;
const { DiscoverCreatorCard } = load('src/components/discover/DiscoverCreatorCard.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  react: { useState: value => [value, () => {}] },
  'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
  'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'SymbolView' },
  'expo-router': { router: { push: route => { navigation = route; } } },
  '@/lib/discoverCategories': categories,
});
function renderedText(node) {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  return renderedText(node.props?.children);
}
test('selected category results render native card labels and navigate using Creator.id', () => {
  const [creator] = api.normalizeDiscoverResponse({ creators: [], featuredCreators: [{ ...row, categories: ['gaming'], featuredSource: 'ORGANIC' }] }, 'GAMING');
  const card = DiscoverCreatorCard({ creator });
  assert.match(renderedText(card), /Gaming/);
  assert.match(renderedText(card), /Featured/);
  assert.match(renderedText(card), /Artist/);
  card.props.onPress();
  assert.deepEqual(navigation, { pathname: '/creator/[creatorId]', params: { creatorId: 'creator-id' } });
});
