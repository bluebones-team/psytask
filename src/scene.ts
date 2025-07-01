import type { App } from './app';
import { h } from './util';

export type SceneConfig = {
  /**milliseconds */
  duration?: number;
  close_on?: HTMLElementEventType | HTMLElementEventType[];
  frame?: (lastFrameTime: number) => void;
};
export type SceneSetup<P extends unknown[] = never> = (
  self: Scene<never>,
) => (...e: P) => void;
export class Scene<P extends unknown[]> {
  root = h('div');
  update: (...e: P) => void;
  data: LooseObject = {};
  #isShown = true;
  #showPromiseWithResolvers: null | PromiseWithResolvers<void> = null;
  constructor(
    public app: App,
    setup: SceneSetup<P>,
    public options: SceneConfig = {},
  ) {
    // initialize
    this.close();
    this.update = setup(this);
    // add close event listener
    const closeKeys =
      typeof options.close_on === 'undefined'
        ? []
        : typeof options.close_on === 'string'
        ? [options.close_on]
        : options.close_on;
    for (const key of closeKeys) {
      this.root.addEventListener(key, () => {
        this.close();
      });
    }
  }
  /**override config */
  config(options: Partial<SceneConfig>) {
    Object.assign(this.options, options);
    return this;
  }
  close() {
    if (!this.#isShown) {
      throw new Error('Scene is already closed');
    }
    this.#isShown = false;
    this.root.style.transform = 'scale(0)';
    this.#showPromiseWithResolvers?.resolve();
  }
  show(...e: P) {
    if (this.#isShown) {
      throw new Error('Scene is already shown');
    }
    this.#isShown = true;
    this.root.style.transform = 'scale(1)';
    this.#showPromiseWithResolvers = Promise.withResolvers<void>();
    // update element
    this.update(...e);
    // render
    if (
      typeof this.options.duration !== 'undefined' &&
      this.options.duration < this.app.data.per_frame
    ) {
      console.warn(
        'Duration is shorter than per_frame, it will show one frame',
      );
    }
    const onFrame = (lastFrameTime: number) => {
      const elapsedTime = lastFrameTime - this.data.start_time;
      if (
        typeof this.options.duration !== 'undefined' &&
        elapsedTime >= this.options.duration - this.app.data.per_frame * 1.5 //TODO: explain this magic number
      ) {
        this.close();
        return;
      }
      this.options.frame?.(lastFrameTime);
      window.requestAnimationFrame(onFrame);
    };
    // it will be called after first frame and before second frame
    window.requestAnimationFrame((lastFrameTime) => {
      this.data.start_time = lastFrameTime;
      onFrame(lastFrameTime);
    });
    return this.#showPromiseWithResolvers.promise;
  }
}
