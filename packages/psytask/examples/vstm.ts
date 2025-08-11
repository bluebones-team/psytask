import { createApp, DataCollector, generic } from '../index';
import { Form, VirtualChinrest } from '../src/scenes';

using app = await createApp();
using dc = new DataCollector();

using form = app.scene(generic(Form), { defaultProps: {} });
using vc = app.scene(VirtualChinrest, {
  defaultProps: { usePreviousData: false },
});
using guide = app.text();
using fixation = app.text('+', { duration: 500 });
using blank = app.text('', { duration: 500 });
using boxes_1 = app.scene(
  (props: {}) => {
    return {
      element: [],
    };
  },
  { defaultProps: {} },
);

const opts = await form.show({
  title: 'Visual Short-term Memory',
  fields: {
    size_deg: {
      type: 'NumberField',
      label: 'Box size (deg)',
      defaultValue: 2,
    },
    interval_ms: {
      type: 'NumberField',
      label: 'Interval (ms)',
      defaultValue: 5e2,
    },
  },
});
const { deg2csspix } = await vc.show();
