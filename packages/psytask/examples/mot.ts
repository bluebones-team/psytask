import { createApp, DataCollector, generic } from '../index';
import { Form, VirtualChinrest } from '../src/scenes';

// Initialize app components
using app = await createApp();
using dc = new DataCollector();

// Create form scene for parameter input
using form = app.scene(generic(Form), {
  defaultProps: { title: 'Multiple Object Tracking' },
});
// Create virtual chinrest for degree-to-pixel conversion
using chinrest = app.scene(VirtualChinrest, {
  defaultProps: { usePreviousData: process.env.NODE_ENV === 'development' },
});
// Create task instructions to participant
using guide = app.text(
  `In this task, you will see

Trial sequence:
1. Tracked target indexes
3. Objects with index
2. Fixation cross (+)
4. Moving objects
5. Moving stop

Press SPACE key to begin.`,
  { close_on: 'key: ' },
);

// Get degree-to-pixel conversion factor
const { deg2csspix } = await chinrest.show();
// Show task instructions
await guide.show();
