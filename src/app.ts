import { Scene, SceneConfig } from './scene';
import { detectEnvironment, h } from './util';

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  return (e.returnValue =
    'Leaving the page will discard progress. Are you sure?');
}
export class App {
  constructor(
    /** Root element of the app */
    public root: Element,
    /** Detected environment data */
    public data: Awaited<ReturnType<typeof detectEnvironment>>,
  ) {
    if (this.data.browser === 'ie') {
      throw new Error(
        (this.root.innerHTML =
          'Internet Explorer is not supported. Please use a modern browser.'),
      );
    }
    // check styles
    if (
      getComputedStyle(document.documentElement).getPropertyValue(
        '--psytask',
      ) === ''
    ) {
      throw new Error('Please import psytask CSS file in your HTML file');
    }
    // Warn before unloading the page.
    // NOTE: but it is not compatible with IOS
    window.addEventListener('beforeunload', onBeforeUnload);
  }
  [Symbol.dispose]() {
    window.removeEventListener('beforeunload', onBeforeUnload);
  }
  /** Create a scene */
  scene<P extends unknown[]>(
    ...e: ConstructorParameters<typeof Scene<P>> extends [infer L, ...infer R]
      ? R
      : never
  ) {
    const scene = new Scene(this, ...e);
    scene.root.classList.add('psytask-scene');
    this.root.appendChild(scene.root);
    return scene;
  }
  /** Shortcut to create a text scene */
  text(text: string, options?: SceneConfig) {
    return this.scene(function (self) {
      const el = h('p', { textContent: text });
      self.root.appendChild(
        h('div', { style: { textAlign: 'center', lineHeight: '100dvh' } }, el),
      );
      return (
        props?: Partial<{ text: string; size: string; color: string }>,
      ) => {
        const p = { ...props };
        if (p.text) {
          el.textContent = p.text;
        }
        if (p.size) {
          el.style.fontSize = p.size;
        }
        if (p.color) {
          el.style.color = p.color;
        }
      };
    }, options);
  }
  /** Shortcut to create a fixation scene */
  fixation(options?: SceneConfig) {
    return this.text('+', options);
  }
  /** Shortcut to create a blank scene */
  blank(options?: SceneConfig) {
    return this.text('', options);
  }
  /**
   * Create a scene with jsPsych Plugin
   *
   * @example
   *   const scene = app.jsPsych({
   *     type: jsPsychHtmlKeyboardResponse,
   *     stimulus: 'Hello world',
   *     choices: ['f', 'j'],
   *   });
   */
  jsPsych(
    jsPsychTrialDescription: LooseObject & {
      type: (new (...args: any[]) => any) & { info: LooseObject };
    },
  ) {
    const JsPsychPlugin = jsPsychTrialDescription.type;
    // set default parameters
    for (const key in JsPsychPlugin.info.parameters) {
      if (!Object.prototype.hasOwnProperty.call(jsPsychTrialDescription, key)) {
        jsPsychTrialDescription[key] =
          JsPsychPlugin.info.parameters[key].default;
      }
    }
    // create scene
    const plugin = new JsPsychPlugin(
      new Proxy(
        {
          finishTrial(data: LooseObject) {
            jsPsychTrialDescription.on_finish?.(
              Object.assign(scene.data, jsPsychTrialDescription.data, data),
            );
            if (typeof jsPsychTrialDescription.post_trial_gap === 'number') {
              window.setTimeout(
                () => scene.close(),
                jsPsychTrialDescription.post_trial_gap,
              );
            } else {
              scene.close();
            }
          },
          pluginAPI: {
            setTimeout(...e: Parameters<typeof window.setTimeout>) {
              console.warn('jsPsych.pluginAPI.setTimeout has low precision');
              window.setTimeout(...e);
            },
          },
        } as LooseObject,
        {
          get(o, k: string) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
              return o[k];
            }
            throw new Error(`jsPsych.${k} is not compatible`);
          },
        },
      ),
    );
    const scene = this.scene(function (self) {
      // create jsPsych DOM
      const content = h('div', {
        id: 'jspsych-content',
        className: 'jspsych-content',
      });
      self.root.appendChild(
        h(
          'div',
          {
            className: 'jspsych-display-element',
            style: { height: '100%', width: '100%' },
          },
          h('div', { className: 'jspsych-content-wrapper' }, content),
        ),
      );
      // on start
      jsPsychTrialDescription.on_start?.();
      // add css classes
      const classes = jsPsychTrialDescription.css_classes;
      if (typeof classes === 'string') {
        content.classList.add(classes);
      } else if (Array.isArray(classes)) {
        content.classList.add(...classes);
      }
      // execute trial
      plugin.trial(content, jsPsychTrialDescription, () => {
        jsPsychTrialDescription.on_load?.();
      });
      return () => {};
    });
    return scene;
  }
}
/**
 * Create app and detect environment
 *
 * @example
 *   const app = await createApp();
 */
export async function createApp(...e: Parameters<typeof detectEnvironment>) {
  const opts = {
    root: document.body,
    framesCount: process.env.NODE_ENV === 'development' ? 6 : 60,
    ...e[0],
  };
  if (!opts.root.isConnected) {
    document.body.appendChild(opts.root);
    console.warn(
      'Root element is not connected to the document, it will be mounted to document.body',
    );
  }
  return new App(opts.root, await detectEnvironment(opts));
}
