import type { App } from './app';
import { h } from './util';

export type SceneConfig = {
  /** Milliseconds */
  duration?: number;
  close_on?: HTMLElementEventType | HTMLElementEventType[];
  frame?: (lastFrameTime: number) => void;
};
export type SceneSetup<P extends unknown[] = never> = (
  /** This scene */
  self: Scene<never>,
) => (...e: P) => void;
export class Scene<P extends unknown[]> {
  /** Root element of the scene */
  root = h('div');
  /** Show generated data */
  data: Readonly<{ start_time: number }> & LooseObject = { start_time: 0 };
  update: (...e: P) => void;
  #isShown = true;
  #showPromiseWithResolvers?: PromiseWithResolvers<typeof this.data>;
  constructor(
    public app: App,
    /**
     * Setup function to create the scene
     *
     * @returns Update function to update the scene each show
     */
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
  /** Override config */
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
    this.#showPromiseWithResolvers?.resolve(this.data);
  }
  /** Show the scene with parameters */
  show(...e: P) {
    if (this.#isShown) {
      throw new Error('Scene is already shown');
    }
    this.#isShown = true;
    this.root.style.transform = 'scale(1)';
    this.#showPromiseWithResolvers = Promise.withResolvers();
    // update element
    this.update(...e);
    // render
    if (
      typeof this.options.duration !== 'undefined' &&
      this.options.duration < this.app.data.frame_ms
    ) {
      console.warn(
        'Duration is shorter than per_frame, it will show one frame',
      );
    }
    const onFrame = (lastFrameTime: number) => {
      const elapsedTime = lastFrameTime - this.data.start_time;
      if (
        typeof this.options.duration !== 'undefined' &&
        elapsedTime >= this.options.duration - this.app.data.frame_ms * 1.4 //TODO: explain this magic number
      ) {
        this.close();
        return;
      }
      this.options.frame?.(lastFrameTime);
      window.requestAnimationFrame(onFrame);
    };
    // it will be called after first frame and before second frame
    window.requestAnimationFrame((lastFrameTime) => {
      //@ts-ignore
      this.data.start_time = lastFrameTime;
      onFrame(lastFrameTime);
    });
    return this.#showPromiseWithResolvers.promise;
  }
}

// compatibility
Promise.withResolvers ??= function withResolvers<T>() {
  let resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  //@ts-ignore
  return { promise, resolve, reject };
};
