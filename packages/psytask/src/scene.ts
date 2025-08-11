import type { LooseObject } from '../types';
import type { App } from './app';
import { _Disposable, h, promiseWithResolvers } from './util';

type SceneCloseOn = `mouse:${'left' | 'middle' | 'right'}` | `key:${string}`;
export type SceneOptions = {
  /** Milliseconds */
  duration?: number;
  /**
   * All keys:
   * [MDN](https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_key_values)
   */
  close_on?: SceneCloseOn | SceneCloseOn[];
  on_frame?: (lastFrameTime: number) => void;
};

export type SceneSetup<T extends {} = any> = (
  /** This scene */
  self: Scene<never>,
) => (props: T) => void;
export type SceneProps<F> = F extends SceneSetup<infer P> ? P : never;

export class Scene<T extends {}> extends _Disposable {
  /** Root element of the scene */
  root = h('div');
  /** Show generated data */
  data: Readonly<{ start_time: number; frame_times: number[] }> & LooseObject =
    { start_time: 0, frame_times: [] };
  update: (props: T) => void;
  #shown = true;
  #showPromiseWithResolvers?: ReturnType<
    typeof promiseWithResolvers<typeof this.data>
  >;
  constructor(
    public app: App,
    /**
     * Setup function to create the scene
     *
     * @returns Update function to update the scene each show
     */
    setup: SceneSetup<T>,
    private defaultProps: T,
    public options: SceneOptions = {},
  ) {
    super();

    // initialize
    this.addCleanup(() => this.app.root.removeChild(this.root));
    this.close();

    //@ts-ignore
    this.update = setup(this);
    this.update(defaultProps);
    if (process.env.NODE_ENV === 'development' && this.#shown) {
      throw new Error("Scene shouldn't be shown in setup or update function");
    }

    // add close event listener
    if (typeof options.close_on !== 'undefined') {
      const close_ons = Array.isArray(options.close_on)
        ? options.close_on
        : [options.close_on];
      for (const close_on of close_ons) {
        const [type, key] = close_on.split(':');
        if (type === 'mouse') {
          this.useEventListener(this.root, 'click', (e) => {
            if (
              (e.button === 0 && key === 'left') ||
              (e.button === 1 && key === 'middle') ||
              (e.button === 2 && key === 'right')
            )
              this.close();
          });
        } else if (type === 'key') {
          this.useEventListener(this.root, 'keydown', (e) => {
            if (e.key === key) this.close();
          });
        }
      }
    }
  }
  /** Override config */
  config(options: Partial<SceneOptions>) {
    Object.assign(this.options, options);
    return this;
  }
  close() {
    if (!this.#shown) {
      console.warn('Scene is already closed');
      return;
    }
    this.#shown = false;
    this.root.style.transform = 'scale(0)';
    this.#showPromiseWithResolvers?.resolve(this.data);
  }
  /** Show the scene with parameters */
  show(props?: Partial<T>) {
    if (this.#shown) {
      console.warn('Scene is already shown');
      return this.#showPromiseWithResolvers!.promise;
    }
    this.#shown = true;
    this.root.style.transform = 'scale(1)';
    this.#showPromiseWithResolvers = promiseWithResolvers();

    this.update({ ...this.defaultProps, ...props });

    const frame_ms = this.app.data.frame_ms;
    const duration = this.options.duration;

    // check duration
    if (
      process.env.NODE_ENV === 'development' &&
      typeof duration !== 'undefined'
    ) {
      const theoreticalDuration = Math.round(duration / frame_ms) * frame_ms;
      const error = theoreticalDuration - duration;
      if (Math.abs(error) >= 1) {
        console.warn(
          `Scene duration is not a multiple of frame_ms, theoretical duration is ${theoreticalDuration} ms, but got ${duration} ms (error: ${error} ms)`,
        );
      }
    }

    /**
     * Render
     *
     * ## Scene render logic
     *
     * ```text
     * scene_1.show ->
     * call_rAF_cb -> render -> vsync -> scene_1.start_time -> ... ->
     * call_rAF_cb(scene_2.show) -> render -> vsync -> scene_2.start_time -> ... ->
     * call_rAF_cb(scene_3.show) -> render -> vsync -> scene_3.start_time -> ...
     * ```
     *
     * ## Closing condition
     *
     * |    symbol/expression    | description         |
     * | :---------------------: | ------------------- |
     * |            t            | current frame time  |
     * |           t_0           | start frame time    |
     * |            D            | duration            |
     * |         \delta          | next frame duration |
     * |     e = t - t_0 - D     | duration error      |
     * | \|e\| <= \|e + \delta\| | closing condition   |
     *
     * Inference:
     *
     * ```text
     * For |e| <= |e + \delta|, given that \delta > 0
     * if e >= 0 then e <= e + \delta -> true
     * if e < 0 then -e <= |e + \delta|
     *     if e + \delta >= 0 then -e <= e + \delta -> e >= -\delta / 2
     *     if e + \delta < 0 then -e <= -e - \delta -> false
     * ```
     */
    const onFrame = (lastFrameTime: number) => {
      this.data.frame_times.push(lastFrameTime);

      if (typeof duration !== 'undefined') {
        if (lastFrameTime - this.data.start_time >= duration - frame_ms * 1.5) {
          // console.log(
          //     'frame durations',
          //     this.data.frame_times.reduce(
          //         (acc, e, i, arr) => (i > 0 && acc.push(e - arr[i - 1]!), acc),
          //     [] as number[],
          //   ),
          // );
          this.close();
          return;
        }
      }

      this.options.on_frame?.(lastFrameTime);
      window.requestAnimationFrame(onFrame);
    };
    window.requestAnimationFrame((lastFrameTime) => {
      //@ts-ignore
      this.data.start_time = lastFrameTime;
      this.data.frame_times.length = 0;
      onFrame(lastFrameTime);
    });

    return this.#showPromiseWithResolvers.promise;
  }
}
