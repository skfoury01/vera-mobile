const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => { if (name in imports) return imports[name]; throw new Error(`Unexpected dependency ${name}`); }, mod, mod.exports);
  return mod.exports;
}
const music = load('src/lib/creatorMusic.ts', { '@/lib/discoverApi': { avatarSource: x => typeof x === 'string' && /^https?:\/\//.test(x) ? x : null } });
const theme = load('src/lib/creatorTheme.ts');
const raw = { id: 'r1', creatorId: 'c1', title: 'Song', artist: 'Artist', status: 'PUBLISHED', visibility: 'PUBLIC', hasPreview: true };
const releases = music.normalizeCreatorMusic([raw], 'c1');
const { CreatorProfileLoader } = load('src/lib/creatorProfileLoader.ts', { '@/lib/creatorMusic': music, '@/lib/api': { ApiError: class extends Error {} }, '@/lib/creatorProfileApi': {} });
function data(focus) { return { creator: { id: 'c1', pageFocus: focus, musicReleases: releases }, posts: [{ id: 'locked', canView: false, mediaUrl: null, previewMediaUrl: 'approved-preview' }], viewer: {}, nextCursor: null }; }
for (const focus of ['POSTS', 'MUSIC', undefined, 'invalid']) test(`initial profile follows ${String(focus)} preference`, async () => {
  const loader = new CreatorProfileLoader(() => {}, async () => data(focus)); await loader.load('c1');
  assert.equal(loader.state.section, focus === 'MUSIC' ? 'MUSIC' : 'POSTS');
});
test('website MUSIC preference falls back to Posts when there are no public releases', () => assert.equal(music.defaultProfileSection('MUSIC', []), 'POSTS'));
test('local switches preserve preference and posts without any refetch or mutation request', async () => {
  let calls = 0; const original = data('MUSIC');
  const loader = new CreatorProfileLoader(() => {}, async () => { calls++; return original; }); await loader.load('c1');
  loader.selectSection('POSTS'); assert.equal(loader.state.section, 'POSTS'); loader.selectSection('MUSIC');
  assert.equal(calls, 1); assert.equal(loader.state.data, original); assert.equal(original.creator.pageFocus, 'MUSIC');
  assert.equal(original.posts[0].mediaUrl, null); assert.equal(original.posts[0].previewMediaUrl, 'approved-preview');
});
test('refresh and reopening reset viewer selection to canonical creator preference', async () => {
  const loader = new CreatorProfileLoader(() => {}, async () => data('MUSIC')); await loader.load('c1'); loader.selectSection('POSTS');
  await loader.load('c1', true); assert.equal(loader.state.section, 'MUSIC'); loader.selectSection('POSTS');
  await loader.load('c1'); assert.equal(loader.state.section, 'MUSIC');
});
test('music rejects unpublished, private, foreign creator and duplicate releases, preserving public order', () => {
  const rows = [raw, {...raw, id:'draft',status:'DRAFT'}, {...raw,id:'private',visibility:'PRIVATE'}, {...raw,id:'foreign',creatorId:'other'}, raw, {...raw,id:'second'}];
  assert.deepEqual(music.normalizeCreatorMusic(rows, 'c1').map(x => x.id), ['r1','second']);
});
test('music metadata never retains protected audio, files, stems, downloads or private analytics', () => {
  const result = music.normalizeCreatorMusic([{ ...raw, fullAudioUrl:'SECRET', audioFileRef:'SECRET', previewAudioRef:'SECRET', downloadOptions:[{fileUrl:'SECRET'}], stems:'SECRET', revenue:'SECRET', coverArtUrl:'javascript:bad' }], 'c1');
  assert.equal(JSON.stringify(result).includes('SECRET'), false); assert.equal(result[0].coverArtUrl,null);
  assert.deepEqual(music.normalizeCreatorMusic(undefined,'c1'),[]); assert.throws(() => music.normalizeCreatorMusic({},'c1'));
  assert.equal(music.musicReleaseUrl('a/b'), 'https://verapage.com/music/a%2Fb');
});
const jsx = (type, props) => ({type,props:props || {}});
const runtime = {jsx,jsxs:jsx};
const native = {Pressable:'Pressable',View:'View',Text:'Text',ActivityIndicator:'Spinner',FlatList:'FlatList',RefreshControl:'RefreshControl',StyleSheet:{create:x=>x,absoluteFill:{}},AppState:{currentState:'active',addEventListener:()=>({remove(){}})}};
function walk(node) { if (Array.isArray(node)) return node.flatMap(walk); if (!node || typeof node !== 'object') return []; return [node,...walk(node.props?.children)]; }
const tabs = load('src/components/creator/CreatorContentTabs.tsx', {'react/jsx-runtime':runtime,'react-native':native,'@/lib/creatorTheme':theme});
test('selected tab uses canonical creator accent, accessible selection and comfortable touch targets', () => {
  let selected; const tree = tabs.CreatorContentTabs({selected:'MUSIC',themeKey:'royal',onSelect:x=>selected=x});
  const buttons = walk(tree).filter(n=>n.type==='Pressable');
  assert.equal(buttons[1].props.accessibilityState.selected,true); assert.equal(buttons[0].props.accessibilityState.selected,false);
  assert.equal(buttons[1].props.style[1].borderBottomColor,theme.creatorTheme('royal').accent); assert.ok(buttons[1].props.style[0].minHeight>=44);
  buttons[0].props.onPress(); assert.equal(selected,'POSTS');
});
function screen(section) {
  const state = {data:{creator:{id:'c1',profile:{displayName:'Artist'},musicReleases:[],themeKey:'royal'},posts:[],viewer:{}},section};
  const mod = load('src/app/creator/[creatorId].tsx', {'react/jsx-runtime':runtime,react:{useState:x=>[typeof x==='function'?x():state,()=>{}],useRef:x=>({current:x}),useEffect(){},useCallback:x=>x},'expo-router':{useLocalSearchParams:()=>({creatorId:'c1'}),useFocusEffect(){},router:{}},'expo-web-browser':{},'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@/auth/AuthProvider':{useAuth:()=>({user:null})},'@/components/creator/CreatorContentTabs':tabs,'@/components/creator/CreatorMusicCard':{},'@/components/creator/CreatorProfileHeader':{},'@/components/creator/CreatorProfilePostCard':{},'@/lib/creatorMusic':music,'@/lib/creatorProfileApi':{},'@/lib/creatorProfileLoader':{initialProfileState:state,CreatorProfileLoader:class {state=state}}});
  const root = mod.default(); return walk(root.type(root.props)).find(n=>n.type==='FlatList');
}
for (const [section,label] of [['POSTS','No posts yet'],['MUSIC','No music released yet']]) test(`${section} empty state renders with tabs visible`, () => {
  const list = screen(section); assert.deepEqual(list.props.data,[]); assert.ok(walk(list.props.ListEmptyComponent).some(n=>n.props.children===label)); assert.ok(walk(list.props.ListHeaderComponent).some(n=>n.type===tabs.CreatorContentTabs));
  if(section==='MUSIC') assert.equal(list.props.ListFooterComponent,null);
});
test('music card opens release flow and only indicates availability, without requesting protected audio', () => {
  let opened = false;
  const card = load('src/components/creator/CreatorMusicCard.tsx', {'react/jsx-runtime':runtime,react:{useState:x=>[x,()=>{}]},'react-native':native,'expo-image':{Image:'Image'},'@/lib/creatorTheme':theme});
  const tree = card.CreatorMusicCard({release:releases[0],themeKey:'royal',onOpen:()=>opened=true});
  assert.ok(walk(tree).some(n=>n.props.children==='Preview available')); tree.props.onPress(); assert.equal(opened,true);
});
