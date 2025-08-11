import { Scene, type SceneOptions, type SceneProps } from './scene';
import { textSetup } from './scenes';
import { _Disposable, detectEnvironment, h } from './util';

export class App extends _Disposable {
  constructor(
    /** Root element of the app */
    public root: Element,
    /** Detected environment data */
    public data: Awaited<ReturnType<typeof detectEnvironment>>,
  ) {
    super();

    // check styles
    if (
      window.getComputedStyle(this.root).getPropertyValue('--psytask') === ''
    ) {
      throw new Error('Please import psytask CSS file in your HTML file');
    }

    // add event listeners
    this.useEventListener(window, 'beforeunload', (e) => {
      // warn before unloading the page, not compatible with IOS
      e.preventDefault();
      return (e.returnValue =
        'Leaving the page will discard progress. Are you sure?');
    });
    this.useEventListener(document, 'visibilitychange', () => {
      // alert when the page is hidden
      if (document.visibilityState === 'hidden') {
        alert(
          'Please keep the page visible on the screen during the task running',
        );
      }
    });
  }
  /** Load resources to RAM */
  async load(urls: string[]) {
    const container = this.root.appendChild(
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
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
  scene<T extends {}>(
    ...e: ConstructorParameters<typeof Scene<T>> extends [infer L, ...infer R]
      ? R
      : never
  ) {
    const scene = new Scene(this, ...e);
    scene.root.classList.add('psytask-scene');
    this.root.appendChild(scene.root);
    return scene;
  }
  /** Shortcut to create a text scene */
  text(props: string | SceneProps<typeof textSetup>, options?: SceneOptions) {
    if (typeof props === 'string') {
      props = { children: props };
    }
    return this.scene(textSetup, props, options);
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
export async function createApp(
  options?: Parameters<typeof detectEnvironment>[0],
) {
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
  return new App(opts.root, await detectEnvironment(opts));
}
