import {
  createApp,
  DataCollector,
  generic,
  reactive,
  StairCase,
} from '../index';
import { Form, TextStim } from '../src/scenes';

using app = await createApp();
using dc = new DataCollector();

using form = app.scene(generic(Form), { defaultProps: {} });
using guide = app.text();
using fixation = app.text('+', { duration: 500 });
using stim = app.text('', { duration: 1e2 });
using reaction = app.scene(
  (props: {}, self) => {
    let data: { response_key: string; response_time: number };
    self
      .on('scene:show', () => {
        data = { response_key: '', response_time: 0 };
      })
      .on('key:any', (e) => {
        if (Number.isNaN(+e.key)) return;
        data.response_key = e.key;
        data.response_time = e.timeStamp;
        self.close();
      });

    const { element } = TextStim(
      reactive({
        children: 'Please press the key corresponding to the second number.',
      }),
    );
    return { element, data: () => data };
  },
  { defaultProps: {} },
);
using feedback = app.text('', { duration: 500 });

const generateSeries = (lag: number) => {
  const length = opts.trial_num;
  const firstIndex = Math.floor(Math.random() * (length - lag - 1));

  const target = '' + Math.floor(Math.random() * 10);
  const series = Array.from({ length }, (_, i) =>
    i === firstIndex
      ? '' + Math.floor(Math.random() * 10)
      : i === firstIndex + lag + 1
        ? target
        : String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  );

  return [series, target] as const;
};
const opts = await form.show({
  title: 'Rapid Serial Visual Presentation',
  fields: {
    trial_num: {
      type: 'NumberField',
      label: 'Number of trials',
      defaultValue: 20,
    },
  },
});

const staircase = new StairCase({
  start: opts.trial_num - 2,
  step: 1,
  down: 3,
  up: 1,
  reversal: 3,
});
for (const lag of staircase) {
  const [series, target] = generateSeries(lag);

  await guide.config({ close_on: 'key: ' }).show({
    children:
      (staircase.data.length > 1
        ? "Let's continue with the next series."
        : 'A series of symbols will be presented next.\nPlease remember the second number in the series.') +
      '\nPress space key to start.',
  });
  await fixation.show();
  for (const symbol of series) {
    await stim.show({ children: symbol });
  }
  const { start_time, response_key, response_time } = await reaction.show();
  const correct = target === response_key;
  await feedback.show({ children: correct ? 'Correct!' : 'Incorrect.' });

  staircase.response(correct);
  await dc.add({
    series: series.join(','),
    target,
    response: response_key,
    correct,
    rt: response_time - start_time,
  });
}
