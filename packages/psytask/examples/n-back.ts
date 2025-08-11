import { createApp, DataCollector, effect, generic, reactive } from '../index';
import { Form, TextStim } from '../src/scenes';

using app = await createApp();
using dc = new DataCollector();

using form = app.scene(generic(Form), { defaultProps: {} });
using guide = app.text();
using fixation = app.text('+', { duration: 500 });
using stim = app.scene(
  (props: { content: string }, self) => {
    let data: { has_response: boolean; response_time: number };
    self
      .on('scene:show', () => {
        data = { has_response: false, response_time: 0 };
      })
      .on('key:any', (e) => {
        data.has_response = e.key === '';
        data.response_time = e.timeStamp;
      });

    const textProps = reactive({ children: '' });
    effect(() => {
      textProps.children = props.content;
    });
    const { element } = TextStim(textProps);
    return { element, data: () => data };
  },
  { defaultProps: { content: '' }, duration: 300 },
);

const opts = await form.show({
  title: 'N-back',
  fields: {
    back_num: {
      type: 'NumberField',
      label: 'N-back number',
      defaultValue: 2,
    },
    trial_num: {
      type: 'NumberField',
      label: 'Number of trials',
      defaultValue: 20,
    },
  },
});
const letters = Array.from({ length: opts.trial_num }, () =>
  String.fromCharCode(65 + Math.floor(Math.random() * 4)),
);

await guide.config({ close_on: 'key: ' }).show({
  textAlign: 'center',
  children: `Press the space key when the current stimulus is the same as the previous ${opts.back_num} stimuli.
Press space key to start.`,
});
await fixation.show();
for (let i = 0; i < letters.length; i++) {
  const curr = letters[i]!;
  const { start_time, has_response, response_time } = await stim.show({
    content: curr,
  });
  const prev = i >= opts.back_num ? letters[i - opts.back_num] : null;
  const is_back = curr === prev;

  await dc.add({
    stim: curr,
    is_back,
    correct: is_back ? !!has_response : !has_response,
    rt: response_time === 0 ? 0 : response_time - start_time,
  });
}
