import { createApp } from '~/app';

const app = await createApp();
const fixation = app.fixation({ duration: 5e2 });
const letter = app.text('', { duration: 1e2 });

await fixation.show();
for (let i = 0; i < 26; i++) {
  performance.mark(i + 'start');
  await letter
    .config({ duration: 1e2 })
    .show({ text: String.fromCharCode(65 + i) });
  performance.mark(i + 'end');
  performance.measure('duration', i + 'start', i + 'end');
}
window['__benchmark__'](
  performance
    .getEntriesByName('duration')
    .map((e) => ({ value: e.duration, except: 1e2 })),
);
