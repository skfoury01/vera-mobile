/* eslint-disable react-hooks/immutability -- expo-video exposes a mutable native SharedObject; its documented API sets muted/currentTime. */
import { useEvent, useEventListener } from 'expo';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ApiError } from '@/lib/api';
import { claimPostPreview, resolveVideoUrl } from '@/lib/postApi';

// Home and detail share the playback coordinator.
let pausePrevious: (() => void) | null = null;

type Props = {
  postId: string;
  url: string;
  preview?: boolean;
  previewStart?: number;
  previewDuration?: number;
  visible?: boolean;
};

export function FeedVideo({ postId, url, preview = false, previewStart = 0, previewDuration = 30, visible = true }: Props) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [focused, setFocused] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishPreview = useCallback(() => setFinished(true), []);
  const claimController = useRef<AbortController | null>(null);
  const { handleUnauthorized, isAuthenticated } = useAuth();
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => () => claimController.current?.abort(), []);

  useEffect(() => {
    if (preview && !authorized) return;
    const controller = new AbortController();
    resolveVideoUrl(postId, url, controller.signal, !preview).then(value => {
      if (controller.signal.aborted) return;
      setSource(value);
      if (!value) setError('Video unavailable');
    }).catch(async e => {
      if (controller.signal.aborted) return;
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      if (!controller.signal.aborted) setError('Unable to load video');
    });
    return () => controller.abort();
  }, [postId, url, preview, authorized, handleUnauthorized]);

  const startPreview = async () => {
    if (!isAuthenticated) { router.push('/sign-in'); return; }
    if (claimController.current || authorized) return;
    const controller = new AbortController();
    claimController.current = controller;
    setClaiming(true);
    setError(null);
    try {
      await claimPostPreview(postId, controller.signal);
      if (!controller.signal.aborted) setAuthorized(true);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        router.push('/sign-in');
      }
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Preview unavailable');
    } finally {
      if (!controller.signal.aborted) setClaiming(false);
      claimController.current = null;
    }
  };

  if (finished) return <View style={styles.wait}><Text style={styles.text}>Preview ended</Text></View>;
  if (preview && !authorized) return (
    <View style={styles.wait}>
      {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Play one-time preview" disabled={claiming} onPress={startPreview} style={styles.previewButton}>
        {claiming ? <ActivityIndicator color="#C084FC" /> : <Text style={styles.text}>Play preview</Text>}
      </Pressable>
    </View>
  );
  return source ? (
    <Player key={source} source={source} active={focused && visible} muted={muted}
      onMute={() => setMuted(value => !value)} preview={preview}
      previewStart={Math.max(0, previewStart)} previewDuration={Math.min(30, Math.max(1, previewDuration))}
      onFinished={finishPreview} />
  ) : (
    <View style={styles.wait}>{error ? <Text style={styles.text}>{error}</Text> : <ActivityIndicator color="#C084FC" />}</View>
  );
}

type PlayerProps = {
  source: string;
  active: boolean;
  muted: boolean;
  onMute: () => void;
  preview: boolean;
  previewStart: number;
  previewDuration: number;
  onFinished: () => void;
};

function Player({ source, active, muted, onMute, preview, previewStart, previewDuration, onFinished }: PlayerProps) {
  const player = useVideoPlayer(source, value => { value.muted = true; value.loop = false; value.timeUpdateEventInterval = 0.25; });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack });
  const ratio = videoTrack?.size?.width && videoTrack?.size?.height ? videoTrack.size.width / videoTrack.size.height : 4 / 5;
  const previewStarted = useRef(false);
  const [previewRunning, setPreviewRunning] = useState(false);
  const pause = useCallback(() => player.pause(), [player]);

  useEffect(() => { player.muted = muted; }, [player, muted]);
  useEffect(() => { if (!active) player.pause(); }, [active, player]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    return () => {
      subscription.remove();
      if (pausePrevious === pause) pausePrevious = null;
    };
  }, [pause]);

  useEffect(() => {
    if (!preview || !active || status !== 'readyToPlay' || previewStarted.current) return;
    previewStarted.current = true;
    pausePrevious?.();
    pausePrevious = pause;
    player.currentTime = previewStart;
    player.play();
    queueMicrotask(() => setPreviewRunning(true));
  }, [preview, active, status, pause, player, previewStart]);

  useEffect(() => {
    if (!previewRunning) return;
    const timer = setTimeout(() => { player.pause(); onFinished(); }, previewDuration * 1000);
    return () => clearTimeout(timer);
  }, [previewRunning, previewDuration, player, onFinished]);

  useEventListener(player, 'playToEnd', () => { if (preview) onFinished(); });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (preview && previewStarted.current && currentTime >= previewStart + previewDuration) {
      player.pause();
      onFinished();
    }
  });

  const toggle = () => {
    if (player.playing) player.pause();
    else if (active && status === 'readyToPlay') {
      pausePrevious?.();
      pausePrevious = pause;
      if (!preview && player.duration && player.currentTime >= player.duration) player.currentTime = 0;
      player.play();
    }
  };
  return <View style={{ width: '100%', aspectRatio: ratio }}>
    <VideoView player={player} nativeControls={false} contentFit="contain" style={StyleSheet.absoluteFill} />
    <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} onPress={toggle} style={styles.tap}>
      {status === 'loading' ? <ActivityIndicator color="#C084FC" /> : status === 'error' ? <Text style={styles.text}>Video unavailable</Text> : !isPlaying ? <Text style={styles.play}>▶</Text> : null}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'} hitSlop={8} onPress={onMute} style={styles.mute}>
      <SymbolView
        name={muted
          ? { ios: 'speaker.slash.fill', android: 'volume_off', web: 'volume_off' }
          : { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
        tintColor="#F8F5FC"
        size={18}
        pointerEvents="none"
        accessible={false}
      />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wait: { aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  text: { color: '#F8F5FC' },
  tap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  play: { color: 'white', fontSize: 36 },
  mute: { position: 'absolute', bottom: 12, right: 12, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#160D20CC', borderWidth: 1, borderColor: '#C084FC33' },
  previewButton: { minHeight: 44, padding: 14, backgroundColor: '#9B5CFF', borderRadius: 16 },
});
