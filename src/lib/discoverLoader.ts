import { ApiError } from '@/lib/api';
import { getDiscoverCreators, type DiscoverCreator, type DiscoverOptions } from '@/lib/discoverApi';

export type DiscoverState = { creators: DiscoverCreator[]; loading: boolean; refreshing: boolean; error: string | null };
const INITIAL_STATE: DiscoverState = { creators: [], loading: true, refreshing: false, error: null };
// Owns cancellation across typing, categories, modes, refresh and unmount.
export class DiscoverLoader {
  state: DiscoverState = INITIAL_STATE;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  constructor(private publish: (state: DiscoverState) => void, private fetchCreators = getDiscoverCreators) {}
  private update(patch: Partial<DiscoverState>) {
    this.state = { ...this.state, ...patch };
    this.publish(this.state);
  }
  cancel() {
    this.revision++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
  }
  schedule(options: DiscoverOptions, delay = 0) {
    this.cancel();
    this.update({ creators: [], loading: true, refreshing: false, error: null });
    this.timer = setTimeout(() => { this.timer = null; void this.load(options); }, delay);
  }
  async load(options: DiscoverOptions, refresh = false) {
    if (refresh && (this.controller || this.timer !== null || this.state.loading)) return;
    this.cancel();
    const revision = this.revision;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ loading: !refresh, refreshing: refresh, error: null });
    try {
      const creators = await this.fetchCreators(options, controller.signal);
      if (this.revision !== revision || controller.signal.aborted) return;
      this.update({ creators });
    } catch (error) {
      if (this.revision !== revision || controller.signal.aborted) return;
      this.update({ creators: [], error: error instanceof ApiError ? error.userMessage : 'Unable to load creators. Please try again.' });
    } finally {
      if (this.revision === revision && !controller.signal.aborted) {
        this.controller = null;
        this.update({ loading: false, refreshing: false });
      }
    }
  }
}
