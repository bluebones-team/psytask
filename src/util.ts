import { detect } from 'detect-browser';

/** Creates a new HTML element quickly and easily */
export function h<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  props: Partial<
    Merge<HTMLElementTagNameMap[K], { style?: CSSProperties }>
  > = {},
  children: Node | string | (Node | string)[] = [],
) {
  const el = document.createElement(tagName);
  for (const key in props) {
    if (props.hasOwnProperty(key)) {
      if (key === 'style') {
        for (const styleKey in props.style!) {
          if (props.style.hasOwnProperty(styleKey)) {
            el.style[styleKey] = props.style[styleKey];
          }
        }
      } else {
        //@ts-ignore
        el[key] = props[key]!;
      }
    }
  }
  if (typeof children === 'string') {
    el.textContent = children;
  } else if (Array.isArray(children)) {
    el.append(...children);
  } else {
    el.appendChild(children);
  }
  return el;
}
// stat
export function mean_std(arr: number[]) {
  const n = arr.length;
  const mean = arr.reduce((acc, v) => acc + v) / n;
  const std = Math.sqrt(
    arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1),
  );
  return { mean, std };
}
// detect environment
export function detectFPS(opts: {
  root: Element;
  framesCount: number;
  stdNum: number;
}) {
  function checkPageVisibility() {
    if (document.visibilityState === 'hidden') {
      alert(
        'Please keep the page visible on the screen during the FPS detection',
      );
      location.reload();
    }
  }
  document.addEventListener('visibilitychange', checkPageVisibility);
  let startTime = 0;
  const frameDurations: number[] = [];
  const el = opts.root.appendChild(h('p'));
  return new Promise<number>((resolve) => {
    window.requestAnimationFrame(function frame(lastTime) {
      if (startTime !== 0) {
        frameDurations.push(lastTime - startTime);
      }
      startTime = lastTime;
      const progress = frameDurations.length / opts.framesCount;
      el.textContent = `test fps ${Math.floor(progress * 100)}%`;
      if (progress >= 1) {
        document.removeEventListener('visibilitychange', checkPageVisibility);
        // calculate average frame duration
        const { mean, std } = mean_std(frameDurations);
        const valids = (function filter(stdNum: number): number[] {
          const temp = frameDurations.filter(
            (v) => mean - std * stdNum <= v && v <= mean + std * stdNum,
          );
          return temp.length > 0 ? temp : filter(stdNum + 1);
        })(opts.stdNum);
        console.log('detectFPS', { mean, std, valids });
        resolve(valids.reduce((acc, v) => acc + v) / valids.length);
        return;
      }
      window.requestAnimationFrame(frame);
    });
  });
}
export async function detectEnvironment(options?: {
  /** The detection panel container */
  root?: Element;
  /** Count of frames to calculate perFrame milliseconds */
  framesCount?: number;
}) {
  const opts = {
    root: document.body,
    framesCount: process.env.NODE_ENV === 'development' ? 6 : 60,
    ...options,
  };
  const panel = opts.root.appendChild(
    h('div', { style: { textAlign: 'center', lineHeight: '100dvh' } }),
  );
  const browser = detect();
  if (!browser) {
    throw new Error('Cannot detect browser environment');
  }
  const env = {
    os: browser.os,
    browser: browser.name,
    browser_version: browser.version,
    // browser_type: browser.type,
    /** @see https://github.com/jspsych/jsPsych/blob/main/packages/plugin-browser-check/src/index.ts#L244 */
    mobile: /Mobi/i.test(navigator.userAgent),
    screen_wh: [window.screen.width, window.screen.height],
    window_wh: (function () {
      const wh = [window.innerWidth, window.innerHeight];
      window.addEventListener('resize', () => {
        wh[0] = window.innerWidth;
        wh[1] = window.innerHeight;
      });
      return wh;
    })(),
    frame_ms: await detectFPS({
      root: panel,
      framesCount: opts.framesCount,
      stdNum: 1,
    }),
  } as const;
  opts.root.removeChild(panel!);
  console.log('env', env);
  return env;
}
