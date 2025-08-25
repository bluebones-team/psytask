import type { DeepReadonly, LooseObject, Merge } from '../types';
import type { App } from './app';
import { reactive, type Reactive } from './reactive';
import { _Disposable, h, on, promiseWithResolvers } from './util';

const createShowInfo = () => ({ start_time: 0, frame_times: [] as number[] });
type SceneShowInfo = ReturnType<typeof createShowInfo>;
type ForbiddenSceneData = { [K in keyof SceneShowInfo]?: never };

export type SceneSetup<
  P extends LooseObject = any,
  D extends LooseObject = LooseObject & ForbiddenSceneData,
> = (
  props: Reactive<P>,
  self: Scene<never>,
) => { element: Node | Node[]; data?: () => D };
type SceneShow<
  P extends LooseObject = any,
  D extends LooseObject = LooseObject,
> = (patchProps?: Partial<P>) => Promise<Merge<D, SceneShowInfo>>;
export type SceneFunction = SceneSetup | SceneShow;

type SceneEventMap = {
  'scene:show': null;
  'scene:frame': number;
  'scene:close': null;
} & {
  [K in `mouse:${'left' | 'middle' | 'right' | 'unknown'}`]: MouseEvent;
} & { [K in `key:${string}`]: KeyboardEvent } & HTMLElementEventMap;
type SceneEventType = keyof SceneEventMap;
export type SceneOptions<T extends SceneFunction> = DeepReadonly<{
  defaultProps: T extends SceneSetup<infer P> ? P : LooseObject;
  /** @unit ms */
  duration?: number;
  /**
   * All keys:
   * [MDN](https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_key_values)
   */
  close_on?: SceneEventType | SceneEventType[];
  /** Whether to log frame times */
  frame_times?: boolean;
}>;

const buttonTypeMap = ['mouse:left', 'mouse:middle', 'mouse:right'] as const;
/** Just for type infer, do nothing in runtime. */
const setup2show: {
  <P extends LooseObject, D extends LooseObject & ForbiddenSceneData = {}>(
    f: SceneSetup<P, D>,
  ): SceneShow<P, D>;
} = (f) => f as any;
export { setup2show as generic };
export class Scene<T extends SceneFunction> extends _Disposable {
  /** Root element */
  readonly root = h('div', {
    className: 'psytask-scene',
    tabIndex: -1, // support keyboard events
    oncontextmenu: (e) => e.preventDefault(),
  });
  /** Show params */
  readonly props: Reactive<SceneOptions<T>['defaultProps']>;
  data: T extends SceneSetup<infer P, infer D> ? () => D : () => LooseObject;
  //@ts-ignore
  show: T extends SceneSetup<infer P, infer D> ? SceneShow<P, D> : T =
    this.#show;
  private options: SceneOptions<T>;
  private listeners: {
    [K in SceneEventType]?: Set<(e: SceneEventMap[K]) => void>;
  } = {};
  #showPromiseWithResolvers?: ReturnType<typeof promiseWithResolvers<null>>;
  constructor(
    public readonly app: App,
    setup: T,
    public readonly defaultOptions: SceneOptions<T>,
  ) {
    super();

    // initialize
    this.addCleanup(() => this.app.root.removeChild(this.root));
    this.close();
    this.options = defaultOptions;

    // setup
    this.props = reactive({ ...defaultOptions.defaultProps });
    //@ts-ignore
    const { element, data } = setup(this.props, this);
    this.data = data ?? (() => ({}));

    Array.isArray(element)
      ? this.root.append(...element)
      : this.root.append(element);
    app.root.appendChild(this.root);
  }
  config(patchOptions: Partial<SceneOptions<T>>) {
    this.options = { ...this.defaultOptions, ...patchOptions };
    return this;
  }
  /** Add event listener */
  on<K extends SceneEventType>(
    type: K,
    listener: (e: SceneEventMap[K]) => void,
  ) {
    (this.listeners[type] ??= new Set<any>()).add(listener);
    return this;
  }
  /** Remove event listener */
  off<K extends SceneEventType>(
    type: K,
    listener: (e: SceneEventMap[K]) => void,
  ) {
    this.listeners[type]?.delete(listener);
    return this;
  }
  /** Add one-time event listener */
  once<K extends SceneEventType>(
    type: K,
    listener: (e: SceneEventMap[K]) => void,
  ) {
    const wrapper = (e: SceneEventMap[K]) => {
      try {
        listener(e);
      } finally {
        this.off(type, wrapper);
      }
    };
    this.on(type, wrapper);
    return this;
  }
  /** Emit event listeners */
  emit<K extends SceneEventType>(type: K, event: SceneEventMap[K]) {
    const listeners = this.listeners[type];
    if (listeners) for (const listener of listeners) listener(event);
  }
  close() {
    this.root.style.transform = 'scale(0)';
    this.#showPromiseWithResolvers?.resolve(null);
  }
  async #show(patchProps?: Partial<LooseObject>) {
    this.root.focus();
    this.root.style.transform = 'scale(1)';
    this.#showPromiseWithResolvers = promiseWithResolvers();

    const { defaultProps, duration, close_on, frame_times } = this.options;
    Object.assign(this.props, defaultProps, patchProps);
    if (process.env.NODE_ENV === 'development') {
      //@ts-ignore
      window['s'] = this;
    }
    this.emit('scene:show', null);

    // add event listener
    if (typeof close_on !== 'undefined') {
      const close_ons = Array.isArray(close_on) ? close_on : [close_on];
      const close = () => this.close();
      for (const close_on of close_ons) {
        this.on(close_on, close);
        this.once('scene:close', () => this.off(close_on, close));
      }
    }
    const eventTypes = Object.keys(this.listeners) as SceneEventType[];
    const hasSpecialType: [mouse: boolean, key: boolean] = [false, false];
    for (const type of eventTypes) {
      if (!hasSpecialType[0] && type.startsWith('mouse:')) {
        hasSpecialType[0] = true;
        this.once(
          'scene:close',
          on(this.root, 'mousedown', (e) =>
            this.emit(buttonTypeMap[e.button] ?? 'mouse:unknown', e),
          ),
        );
        continue;
      }
      if (!hasSpecialType[1] && type.startsWith('key:')) {
        hasSpecialType[1] = true;
        this.once(
          'scene:close',
          on(this.root, 'keydown', (e) => this.emit(`key:${e.key}`, e)),
        );
        continue;
      }
      if (!type.startsWith('scene:')) {
        this.once(
          'scene:close',
          //@ts-ignore
          on(this.root, type, (e) => this.emit(type, e)),
        );
      }
    }

    // check duration
    const frame_ms = this.app.data.frame_ms;
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

    // render
    /**
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
    const showInfo = createShowInfo();
    const onFrame = (lastFrameTime: number) => {
      frame_times && showInfo.frame_times.push(lastFrameTime);

      if (
        typeof duration !== 'undefined' &&
        lastFrameTime - showInfo.start_time >= duration - frame_ms * 1.5
      ) {
        // console.log(
        //   'frame durations',
        //   showInfo.frame_times.reduce(
        //     (acc, e, i, arr) => (i > 0 && acc.push(e - arr[i - 1]!), acc),
        //     [] as number[],
        //   ),
        // );
        this.close();
        return;
      }

      this.emit('scene:frame', lastFrameTime);
      window.requestAnimationFrame(onFrame);
    };
    window.requestAnimationFrame((lastFrameTime) => {
      showInfo.start_time = lastFrameTime;
      onFrame(lastFrameTime);
    });

    await this.#showPromiseWithResolvers.promise;
    this.emit('scene:close', null);
    this.options = this.defaultOptions;
    return Object.assign(this.data(), showInfo);
  }
}
