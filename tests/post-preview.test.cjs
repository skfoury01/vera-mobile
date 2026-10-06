const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => { if (name in imports) return imports[name]; throw new Error(name); }, mod, mod.exports);
  return mod.exports;
}
const jsx = (type, props) => ({ type, props });
function harness() {
  const root = { states: [], refs: [] }, playerState = { states: [], refs: [] };
  let context, index, refIndex, effects, calls = [], claimError = null, signedOut = false;
  const events = {};
  const nativePlayer = { playing: false, status: 'readyToPlay', duration: 60, currentTime: 0, play() { this.playing = true; }, pause() { this.playing = false; } };
  const react = {
    useState(initial) { const box = context.states, i = index++; if (!(i in box)) box[i] = initial; return [box[i], v => { box[i] = typeof v === 'function' ? v(box[i]) : v; }]; },
    useRef(initial) { const box = context.refs, i = refIndex++; return box[i] ?? (box[i] = { current: initial }); },
    useCallback: fn => fn,
    useEffect: fn => { effects.push(fn); },
  };
  class ApiError extends Error { constructor() { super('Invalid session'); this.status = 401; } }
  const module = load('src/components/feed/FeedVideo.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, react,
    expo: { useEvent: (_, event, fallback) => fallback, useEventListener: (_, event, fn) => { events[event] = fn; } },
    'expo-router': { router: { push: path => calls.push(['navigate', path]) }, useFocusEffect: fn => fn() },
    'expo-symbols': { SymbolView: 'Symbol' },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: (_, init) => { init(nativePlayer); return nativePlayer; } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'Spinner', StyleSheet: { create: x => x }, AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/auth/AuthProvider': { useAuth: () => ({ isAuthenticated: true, handleUnauthorized: async () => { signedOut = true; } }) },
    '@/lib/api': { ApiError },
    '@/lib/postApi': {
      claimPostPreview: async id => { calls.push(['claim', id]); if (claimError) throw claimError; },
      resolveVideoUrl: async (id, url, signal, full) => { calls.push(['resolve', id, url, full]); return url; },
    },
  });
  const props = { postId: 'p1', url: 'https://cdn.test/separate-preview.mp4', preview: true, previewStart: 4, previewDuration: 8 };
  function render(fn, box, args) { context = box; index = 0; refIndex = 0; effects = []; return fn(args); }
  return { props, calls, events, nativePlayer, ApiError, get signedOut() { return signedOut; }, deny: error => { claimError = error; },
    root: overrides => render(module.FeedVideo, root, { ...props, ...overrides }),
    player: node => render(node.type, playerState, node.props), flush: () => { effects.forEach(fn => fn()); },
  };
}
function walk(n) {
  if (!n || typeof n !== 'object') return [];
  if (Array.isArray(n)) return n.flatMap(walk);
  return [n, ...walk(n.props.children)];
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
test('Post Detail player does not resolve any preview media until server claim approval', async () => {
  const h = harness(); let tree = h.root(); h.flush(); await tick(); assert.deepEqual(h.calls, []);
  await walk(tree).find(n => n.props.accessibilityLabel === 'Play one-time preview').props.onPress();
  tree = h.root(); h.flush(); await tick(); tree = h.root();
  assert.equal(typeof tree.type, 'function');
  assert.deepEqual(h.calls, [['claim', 'p1'], ['resolve', 'p1', h.props.url, false]]);
});
test('denied/used claims and invalid Bearer cannot mount a player or resolve full/preview media', async () => {
  for (const invalid of [false, true]) {
    const h = harness(); h.deny(invalid ? new h.ApiError() : new Error('You have already used this preview.'));
    const tree = h.root(); h.flush(); await walk(tree).find(n => n.props.accessibilityLabel === 'Play one-time preview').props.onPress();
    const denied = h.root(); h.flush(); await tick();
    assert.equal(denied.type, 'View'); assert.equal(h.calls.some(c => c[0] === 'resolve'), false); assert.equal(h.signedOut, invalid);
  }
});
test('preview playback uses the canonical start/duration and pauses on both deadline and media-time boundary', async () => {
  const h = harness(); let tree = h.root();
  await walk(tree).find(n => n.props.accessibilityLabel === 'Play one-time preview').props.onPress();
  h.root(); h.flush(); await tick(); const playerNode = h.root();
  assert.equal(playerNode.props.previewStart, 4); assert.equal(playerNode.props.previewDuration, 8);
  const originalTimeout = global.setTimeout; const timers = [];
  global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return 1; };
  try {
    h.player(playerNode); h.flush(); await tick(); assert.equal(h.nativePlayer.currentTime, 4); assert.equal(h.nativePlayer.playing, true);
    h.player(playerNode); h.flush(); assert.equal(timers[0].ms, 8000);
    h.events.timeUpdate({ currentTime: 12 }); assert.equal(h.nativePlayer.playing, false);
    h.nativePlayer.playing = true; timers[0].fn(); assert.equal(h.nativePlayer.playing, false);
    tree = h.root(); assert.equal(tree.type, 'View');
  } finally { global.setTimeout = originalTimeout; }
});
test('playback never expands a normal server duration and caps malformed excessive durations at website maximum', async () => {
  const h = harness(); const tree = h.root();
  await walk(tree).find(n => n.props.accessibilityLabel === 'Play one-time preview').props.onPress();
  h.root(); h.flush(); await tick();
  for (const duration of [2, 8, 15, 30]) assert.equal(h.root({ previewDuration: duration }).props.previewDuration, duration);
  assert.equal(h.root({ previewDuration: 900 }).props.previewDuration, 30);
});
// Exercise the existing website preview endpoint read-only when the sibling repo exists.
const route = '../fanbase-mvp/src/app/api/posts/[id]/preview/use/route.ts';
test('canonical server claim permits only active video previews and denies duplicate/concurrent claims', { skip: !fs.existsSync(route) }, async () => {
  let existing = false, enabled = true, type = 'VIDEO', active = true, access = false, duplicate = false;
  class PrismaError extends Error { constructor() { super(); this.code = 'P2002'; } }
  const { POST } = load(route, {
    '@/lib/postRequestSession': { getPostRequestSession: async () => ({ userId: 'viewer' }) }, '@/lib/authz': { isAuthzError: () => false },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: PrismaError } },
    '@/lib/access': { hasActiveCreatorAccess: async () => access },
    '@/lib/db': { prisma: {
      post: { findUnique: async () => ({ creatorId: 'creator', visibility: 'SUBSCRIBERS_ONLY', moderationStatus: active ? 'ACTIVE' : 'REMOVED', allowPreview: enabled, mediaType: type, previewMediaUrl: 'preview-asset' }) },
      user: { findUnique: async () => ({ role: 'VIEWER' }) },
      postPreviewView: { findUnique: async () => existing ? { id: 'used' } : null, create: async () => { if (duplicate) throw new PrismaError(); existing = true; } },
    } },
  });
  const call = () => POST({}, { params: Promise.resolve({ id: 'p1' }) });
  assert.equal((await call()).body.allowed, true); assert.equal((await call()).body.reason, 'already_used');
  existing = false; enabled = false; assert.equal((await call()).body.reason, 'preview_unavailable');
  enabled = true; type = 'IMAGE'; assert.equal((await call()).body.reason, 'preview_unavailable');
  type = 'VIDEO'; duplicate = true; assert.equal((await call()).body.reason, 'already_used');
  duplicate = false; access = true; assert.equal((await call()).body.reason, 'already_has_access');
  active = false; assert.equal((await call()).status, 404);
});
test('creator focus fetches once on entry, cancels stale work on blur and refreshes after returning from Post Detail', async () => {
  const calls = []; let focus; const cleanups = [];
  class Loader {
    state = { data: null };
    async load(id, refresh) { calls.push(['load', id, refresh]); this.state.data = { loaded: true }; }
    cancel() { calls.push(['cancel']); }
  }
  const { default: Screen } = load('src/app/creator/[creatorId].tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: initial => ({ current: initial }), useEffect: fn => { cleanups.push(fn()); }, useCallback: fn => fn },
    'expo-router': { router: {}, useLocalSearchParams: () => ({ creatorId: 'c1' }), useFocusEffect: fn => { focus = fn; } },
    'expo-web-browser': {},
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: 'FlatList', RefreshControl: 'RefreshControl', ActivityIndicator: 'Spinner', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/auth/AuthProvider': { useAuth: () => ({ user: { id: 'viewer' }, handleUnauthorized() {} }) },
    '@/components/creator/CreatorContentTabs': {}, '@/components/creator/CreatorMusicCard': {}, '@/lib/creatorMusic': {}, '@/components/creator/CreatorProfileHeader': {}, '@/components/creator/CreatorProfilePostCard': {}, '@/lib/creatorProfileApi': {},
    '@/lib/creatorProfileLoader': { CreatorProfileLoader: Loader, initialProfileState: { data: null, loading: true } },
  });
  const entry = Screen(); entry.type(entry.props);
  let blur = focus(); await tick(); assert.deepEqual(calls.filter(c => c[0] === 'load'), [['load', 'c1', false]]);
  blur(); blur = focus(); await tick(); assert.deepEqual(calls.filter(c => c[0] === 'load'), [['load', 'c1', false], ['load', 'c1', true]]);
  blur(); const before = calls.filter(c => c[0] === 'load').length; blur = focus(); blur(); await tick(); assert.equal(calls.filter(c => c[0] === 'load').length, before);
  cleanups.filter(fn => typeof fn === 'function').forEach(fn => fn());
});
