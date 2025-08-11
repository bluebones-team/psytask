import { effect, reactive } from './reactive';
import { Scene, type SceneFunction, type SceneOptions } from './scene';
import { TextStim } from './scenes';
import { _Disposable, detectFPS, h, on } from './util';

export class App extends _Disposable {
  readonly data = {
    /** Frame duration */
    frame_ms: 16.67,
    /** Number of times the user has left the page */
    leave_count: 0,
    /** Device pixel ratio */
    dpr: window.devicePixelRatio,
    /** Screen physical size */
    screen_wh_pix: [window.screen.width, window.screen.height] as const,
    /** Window physical size */
    window_wh_pix: [window.innerWidth, window.innerHeight] as const,
  };
  constructor(
    /** Root element of the app */
    public root: Element,
  ) {
    super();
    this.data = reactive(this.data);
    effect(() => {
      const dpr = this.data.dpr;
      Object.assign(this.data, {
        screen_wh_pix: [window.screen.width * dpr, window.screen.height * dpr],
        window_wh_pix: [window.innerWidth * dpr, window.innerHeight * dpr],
      });
    });

    // check styles
    if (
      window.getComputedStyle(this.root).getPropertyValue('--psytask') === ''
    ) {
      throw new Error('Please import psytask CSS file in your HTML file');
    }

    // add event listeners
    this.addCleanup(
      // warn before unloading the page, not compatible with IOS
      on(window, 'beforeunload', (e) => {
        e.preventDefault();
        return (e.returnValue =
          'Leaving the page will discard progress. Are you sure?');
      }),
    );
    this.addCleanup(
      // alert when the page is hidden
      on(document, 'visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.data.leave_count++;
          window.setTimeout(() =>
            alert(
              'Please keep the page visible on the screen during the task running',
            ),
          );
        }
      }),
    );
    this.addCleanup(
      // update device pixel ratio on resolution change
      (() => {
        let cleanup: () => void;
        effect(() => {
          cleanup?.();
          cleanup = on(
            window.matchMedia(`(resolution: ${this.data.dpr}dppx)`),
            'change',
            () => {
              this.data.dpr = window.devicePixelRatio;
            },
          );
        });
        return () => cleanup();
      })(),
    );
    this.addCleanup(
      // update window size on resize
      on(window, 'resize', () => {
        const dpr = this.data.dpr;
        this.data.window_wh_pix = [
          window.innerWidth * dpr,
          window.innerHeight * dpr,
        ];
      }),
    );

    // show last message
    this.addCleanup(() => {
      this.root.appendChild(
        h('div', { className: 'psytask-center' }, 'Thanks for participating!'),
      );
    });
  }
  /** Load resources to RAM */
  async load(urls: string[]) {
    const container = this.root.appendChild(
      h('div', { className: 'psytask-center' }),
    );

    const tasks = urls.map(async (url) => {
      const el = container.appendChild(h('p', { title: url }));

      const res = await fetch(url);
      if (res.body == null) {
        el.style.color = 'red';
        el.textContent = `Failed to load`;
        throw new Error(el.textContent + ': ' + url);
      }

      // no progress
      const totalStr = res.headers.get('Content-Length');
      if (totalStr == null) {
        el.textContent = `Loading...`;
        return res.blob();
      }
      const total = +totalStr;

      // show progress
      const reader = res.body.getReader();
      const chunks = [];
      for (let loaded = 0; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        el.textContent = `Loading...` + ((loaded / total) * 100).toFixed(2);
        chunks.push(value);
      }

      return new Blob(chunks);
    });

    const datas = await Promise.all(tasks);
    this.root.removeChild(container);
    return datas;
  }
  /** Create a scene */
  scene<T extends SceneFunction>(
    ...e: ConstructorParameters<typeof Scene<T>> extends [infer L, ...infer R]
      ? R
      : never
  ) {
    return new Scene(this, ...e);
  }
  /** Shortcut to create a text scene */
  text(content?: string, options?: Partial<SceneOptions<typeof TextStim>>) {
    return this.scene(TextStim, {
      defaultProps: { children: content, ...options?.defaultProps },
      ...options,
    });
  }
}
/**
 * Create app and detect environment
 *
 * @example
 *   using app = await createApp();
 *   using fixation = app.text('+', { duration: 500 });
 *   using blank = app.text('', { duration: 1000 });
 *   using guide = app.text('Welcome to the task!', { close_on: 'key: ' });
 */
export async function createApp(options?: Parameters<typeof detectFPS>[0]) {
  const opts = {
    root: document.body,
    framesCount: 60,
    ...options,
  };
  if (!opts.root.isConnected) {
    console.warn(
      'Root element is not connected to the document, it will be mounted to document.body',
    );
    document.body.appendChild(opts.root);
  }

  const app = new App(opts.root);

  const panel = h('div', { className: 'psytask-center' });
  opts.root.appendChild(panel);
  app.data.frame_ms = await detectFPS({ ...opts, root: panel });
  opts.root.removeChild(panel);

  return app;
}
