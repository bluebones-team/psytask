import { Scene, SceneConfig } from './scene';
import { h } from './util';

export class App {
  data: Readonly<{
    per_frame: number;
    screen_wh: [number, number];
    win_wh: [number, number];
  }> &
    LooseObject = {
    per_frame: 16.67,
    screen_wh: [window.screen.width, window.screen.height],
    win_wh: [window.innerWidth, window.innerHeight],
  };
  constructor(public root: Element) {
    // add styles
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      .psytask-scene {
        position: fixed;
        top: 0;
        left: 0;
        width: 100dvw;
        height: 100dvh;
        overflow: hidden;
        will-change: transform;
      }`);
    document.adoptedStyleSheets.push(sheet);
    // add event listener to prevent page unload
    window.addEventListener('beforeunload', (e) => {
      //FIXME: Safari doesn't support this
      e.preventDefault();
      return (e.returnValue =
        'Leaving the page will discard progress. Are you sure?');
    });
  }
  /**create a new scene */
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
  /**create a new text scene */
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
  fixation(options?: SceneConfig) {
    return this.text('+', options);
  }
  blank(options?: SceneConfig) {
    return this.text('', options);
  }
  /**compatability with jsPsych Plugin*/
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
export async function createApp(options?: {
  root?: string | Element;
  /**count of frames to calculate perFrame milliseconds */
  framesCount?: number;
}) {
  const opts = {
    root: 'body',
    framesCount: process.env.NODE_ENV === 'development' ? 6 : 60,
    ...options,
  };
  const root =
    typeof opts.root === 'string'
      ? document.querySelector(opts.root)
      : opts.root;
  if (!root) {
    throw new Error('cannot find root element: ' + opts.root);
  }
  const app = new App(root);
  // test environment
  const panel = root.appendChild(
    h('div', { style: { textAlign: 'center', lineHeight: '100dvh' } }),
  );
  Object.assign(app.data, {
    per_frame: await new Promise((resolve) => {
      let startFrameTime = 0,
        count = 0;
      const el = panel.appendChild(h('p'));
      window.requestAnimationFrame(function (time) {
        startFrameTime = time;
        window.requestAnimationFrame(function frame(time) {
          el.textContent = `test fps ${Math.round(
            (count / opts.framesCount) * 100,
          )}%`;
          if (++count >= opts.framesCount) {
            resolve((time - startFrameTime) / count);
            return;
          }
          window.requestAnimationFrame(frame);
        });
      });
    }),
  });
  root.removeChild(panel);
  console.log('app.data', app.data);
  return app;
}
