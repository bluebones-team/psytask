import { h, detectEnvironment, mean_std } from '~/util';

document.documentElement.style.filter = 'invert(1)';
Object.assign(document.body.style, {
  backgroundColor: 'white',
  margin: '2rem',
  textAlign: 'center',
  lineHeight: 2,
  fontSize: '1.5rem',
  fontFamily: 'Arial, sans-serif',
});

const env = await detectEnvironment();
const libs = (
  (await fetch(
    'https://api.github.com/repos/bluebones-team/psytask/contents/benchmarks',
  )
    .then((res) => res.json())
    .catch((err) => {
      console.error(err);
      return [];
    })) as any[]
)
  .filter((e) => e.type === 'dir')
  .map((e) => e.name as string);
console.log('libs', libs);

// create DOM
const taskEls = libs.map((lib) =>
  h('div', { ariaCurrent: lib, style: { cursor: 'pointer' } }),
);
const shouldSaveDataEl = h('input', {
  id: 'should-save-data',
  type: 'checkbox',
  checked: false,
  style: {
    width: '1.2rem',
    height: '1.2rem',
    marginLeft: '0.8rem',
  },
});
document.body.innerHTML = '';
const tips: string[] = [
  'It is better to close all extensions, other tabs and applications.',
  'Do not close this page during the task running.',
  'Do not leave task page until the task is finished.',
];
if (env.browser === 'firefox') {
  tips.unshift(
    'Please goto "about:config", set "privacy.reduceTimerPrecision" to false, then restart Firefox and reload the page.',
  );
}
document.body.append(
  h(
    'ol',
    { style: { textAlign: 'left', color: 'red' } },
    tips.map((e) => h('li', void 0, e)),
  ),
  h('hr'),
  h(
    'div',
    {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '2rem',
      },
    },
    taskEls,
  ),
  h('hr'),
  h('div', {}, [
    h('label', { htmlFor: 'should-save-data' }, 'Save benchmark data?'),
    shouldSaveDataEl,
  ]),
);

// run tasks
let tasks: string[];
async function fetchResource(url: string) {
  const res = await fetch(url);
  if (res.headers.get('Content-Type')?.includes('text/html')) {
    throw new Error('Not a valid resource');
  }
  return res.text();
}
function runTask(
  i: number,
  lib: string,
  task: string,
  cssText: string,
  jsText: string,
) {
  const win = window.open();
  if (!win) {
    throw new Error('Failed to open new window');
  }
  win['__benchmark__'] = (datas) => {
    console.log(datas);
    win.close();
    // show stats
    const errors = datas.map((e) => e.value - e.except);
    const { mean, std } = mean_std(errors);
    const { mean: M, std: SD } = mean_std(
      errors.filter((v) => mean - std * 3 <= v && v <= mean + std * 3),
    );
    taskEls[i].innerHTML = `${lib} task is DONE. <br/>M: ${M.toFixed(
      2,
    )}, SD: ${SD.toFixed(2)}`;
    // save data
    if (!shouldSaveDataEl.checked) return;
    const el = h('a', {
      download: `benchmark_${lib}.${task}_${Date.now()}.json`,
      href: URL.createObjectURL(
        new Blob(
          [JSON.stringify(datas.map((e) => ({ ...env, lib, task, ...e })))],
          { type: 'application/json' },
        ),
      ),
    });
    document.body.appendChild(el);
    el.click();
    URL.revokeObjectURL(el.href);
    document.body.removeChild(el);
  };
  // inject html
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Benchmark-${lib}.${task}</title>
    <style>${cssText}</style>
  </head>
  <body></body>
  <script>(async function(){${jsText}})()</script>
</html>`;
  win.setTimeout(() => {
    win.document.writeln(html);
  }, 100);
  // trigger load event manually
  const _addEventListener = win.addEventListener;
  win.addEventListener = function (
    ...[type, listener, options]: Parameters<Window['addEventListener']>
  ) {
    if (type === 'load' && typeof listener === 'function') {
      listener.call(this, new Event(type));
      return;
    }
    _addEventListener.call(this, type, listener, options);
  };
}
async function loadTasks() {
  const task = location.hash.slice(1);
  taskEls.forEach((el) => {
    el.innerHTML = '';
    el.onclick = null;
  });
  // no task
  if (task === '') {
    const el = h('div', void 0, 'Loading tasks from GitHub...');
    taskEls[0].append(
      `Please select a TASK by adding #task to the URL, or click following link:`,
      el,
    );
    tasks ??= (
      (await (
        await fetch(
          'https://api.github.com/repos/bluebones-team/psytask/contents/benchmarks/psytask',
        )
      ).json()) as { name: string }[]
    )
      .filter((e) => e.name.endsWith('.bench.ts'))
      .map((e) => e.name.replace('.bench.ts', ''));
    el.innerHTML = tasks.map((e) => `<a href="#${e}">${e}</a>`).join(', ');
    return;
  }
  // load tasks
  taskEls.map(async (el, i) => {
    const lib = el.ariaCurrent!;
    el.innerHTML = `${lib} task is LOADING...`;
    try {
      const cssText = await fetchResource(`${lib}/main.css`);
      const jsText = await fetchResource(`${lib}/${task}.bench.js`);
      el.innerHTML = `${lib} task is READY.<br/>Click me to start.`;
      el.onclick = () => runTask(i, lib, task, cssText, jsText);
    } catch (error) {
      el.innerHTML = `${lib} task loadding FAILED,<br/>
goto <a href="https://github.com/bluebones-team/psytask/tree/main/benchmarks/${lib}">GitHub</a>
to find available tasks.<br/>${error}`;
    }
  });
}
window.addEventListener('hashchange', loadTasks);
loadTasks();
