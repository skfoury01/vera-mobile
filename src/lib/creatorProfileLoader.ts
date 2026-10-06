import { defaultProfileSection, type ProfileSection } from '@/lib/creatorMusic';
import { ApiError } from '@/lib/api';
import { getCreatorProfile, getCreatorPosts, type CreatorProfileData } from '@/lib/creatorProfileApi';

export type ProfileState = { data: CreatorProfileData | null; loading: boolean; refreshing: boolean; loadingMore: boolean; error: string | null; paginationError: string | null; notFound: boolean; unauthorized: boolean; section: ProfileSection };
export const initialProfileState: ProfileState = { data: null, loading: true, refreshing: false, loadingMore: false, error: null, paginationError: null, notFound: false, unauthorized: false, section: 'POSTS' };
export class CreatorProfileLoader {
  state = initialProfileState;
  private controller: AbortController | null = null;
  private revision = 0;
  constructor(private publish: (state: ProfileState) => void, private fetchProfile = getCreatorProfile, private fetchPosts = getCreatorPosts) {}
  private update(patch: Partial<ProfileState>) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  selectSection(section: ProfileSection) { if (this.state.data) this.update({ section }); }
  cancel() { this.revision++; this.controller?.abort(); this.controller = null; }
  async load(id: string, refresh = false) {
    if (refresh && this.controller) return;
    this.cancel();
    const revision = this.revision;
    const controller = new AbortController(); this.controller = controller;
    this.update({ data: null, loading: !refresh, refreshing: refresh, loadingMore: false, error: null, paginationError: null, notFound: false, unauthorized: false });
    try {
      const data = await this.fetchProfile(id, controller.signal);
      if (controller.signal.aborted || revision !== this.revision) return;
      this.update({ data, section: defaultProfileSection(data.creator.pageFocus, data.creator.musicReleases ?? []) });
    } catch (error) {
      if (controller.signal.aborted || revision !== this.revision) return;
      // Refresh failures withhold old signed media and viewer access state.
      this.update({ data: null, unauthorized: error instanceof ApiError && error.status === 401, notFound: error instanceof ApiError && error.status === 404, error: error instanceof ApiError ? error.userMessage : 'Unable to load this creator. Please try again.' });
    } finally {
      if (!controller.signal.aborted && revision === this.revision) { this.controller = null; this.update({ loading: false, refreshing: false }); }
    }
  }
  async more() {
    const data = this.state.data;
    if (this.controller || !data?.nextCursor) return;
    const revision = this.revision;
    const controller = new AbortController(); this.controller = controller;
    this.update({ loadingMore: true, paginationError: null });
    try {
      const page = await this.fetchPosts(data.creator, data.nextCursor, controller.signal);
      if (controller.signal.aborted || revision !== this.revision) return;
      const seen = new Set<string>();
      // If canonical viewer access changed, discard previously cached protected posts.
      const sameViewer = JSON.stringify(page.viewer) === JSON.stringify(data.viewer);
      const posts = [...(sameViewer ? data.posts : []), ...page.posts].filter(post => !seen.has(post.id) && Boolean(seen.add(post.id)));
      this.update({ data: { creator: data.creator, ...page, posts } });
    } catch (error) {
      if (controller.signal.aborted || revision !== this.revision) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) this.update({ data: null, unauthorized: error.status === 401, error: 'This creator is no longer available. Please refresh.', notFound: error.status === 404 });
      else this.update({ paginationError: 'Unable to load more posts. Please try again.' });
    } finally {
      if (!controller.signal.aborted && revision === this.revision) { this.controller = null; this.update({ loadingMore: false }); }
    }
  }
}
