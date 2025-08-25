import {
  createApp,
  DataCollector,
  effect,
  generic,
  h,
  reactive,
  StairCase,
} from '../index';
import { apply, Form, ImageStim, VirtualChinrest } from '../src/scenes';
import { svg } from '../src/util';

// Initialize app components
using app = await createApp();
using dc = new DataCollector();

// Create form scene for parameter input
using form = app.scene(generic(Form), {
  defaultProps: { title: 'Useful Field of View' },
});
// Create virtual chinrest for degree-to-pixel conversion
using chinrest = app.scene(VirtualChinrest, {
  defaultProps: { usePreviousData: process.env.NODE_ENV === 'development' },
});
// Create task instructions to participant
using guide = app.text(
  `This task measures your visual attention and processing speed.

Trial sequence:
1. Fixation cross (+) - Keep your eyes focused here throughout the trial
2. Brief display of images (central + peripheral) - Pay attention to both locations
3. Visual mask - This will briefly cover the stimuli
4. Two response phases:
   - Central identification: Which image appeared in the center?
   - Peripheral localization: Where did the peripheral image appear?

Press SPACE key to begin.`,
  { close_on: 'key: ' },
);

// Collect experimental parameters from participant
const opts = await form.show({
  fields: {
    image_size: {
      type: 'NumberField',
      label: 'Image Size (deg)',
      defaultValue: 1,
    },
    mask_duration: {
      type: 'NumberField',
      label: 'Mask Duration (ms)',
      defaultValue: 1e2,
    },
  },
});
// Get degree-to-pixel conversion factor
const { deg2pix, deg2csspix } = await chinrest.show();

// Load images resources for central targets
const urls = [
  'https://imagecdn.app/v2/image/https%3A%2F%2Fpicsum.photos%2F20?0',
  'https://imagecdn.app/v2/image/https%3A%2F%2Fpicsum.photos%2F20?1',
] as const;
const images = await app.load(urls, (blob) => {
  const physical_size = deg2pix(opts.image_size);
  // Create ImageBitmap with resize algorithm
  return window.createImageBitmap(blob, {
    resizeWidth: physical_size,
    resizeHeight: physical_size,
  });
});
// Define possible angles for peripheral targets (8 directions)
const rads = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
//
const stim_size = deg2pix(opts.image_size * 12);
// Initialize staircase for adaptive duration adjustment
const staircase = new StairCase({
  start: Infinity, // Start with 200ms stimulus duration
  step: 20, // Adjust by 20ms steps
  down: 2, // Require 2 correct responses to make it harder (shorter duration)
  up: 1, // Increase duration after 1 incorrect response
  reversal: 8, // Stop after 8 reversals
  min: 16, // Minimum duration (1 frame at 60Hz)
  max: 500, // Maximum duration
});

// Fixation cross
using fixation = app.text('+', { duration: 5e2 });
// Main UFOV stimulus scene using Canvas + SVG
using ufovStim = app.scene(
  (
    props: {
      image_indexes: [central: 0 | 1, peripheral: 0 | 1];
      peripheral_angle_index: number;
    },
    self,
  ) => {
    const modify = (
      el: HTMLElement | SVGElement,
      pos: [number, number],
      size = opts.image_size,
    ) => {
      el.style.position = 'absolute';
      effect(() => {
        el.style.transform = `translate(${deg2csspix(pos[0])}px, ${deg2csspix(pos[1])}px)`;
      });
      effect(() => {
        const _size = deg2csspix(size);
        el.style.top = el.style.left = -_size / 2 + 'px';
        el.style.width = el.style.height = _size + 'px';
      });
      return el;
    };

    const centralImage = apply(
      ImageStim,
      reactive({ image: images[props.image_indexes[0]] }),
      void 0,
    );
    modify(centralImage.element, [0, 0]);
    effect(() => (centralImage.props.image = images[props.image_indexes[0]]));

    const peripheralImage = apply(
      ImageStim,
      reactive({ image: images[props.image_indexes[1]] }),
      void 0,
    );
    modify(peripheralImage.element, [0, 0]);
    effect(
      () => (peripheralImage.props.image = images[props.image_indexes[1]]),
    );

    const rect = h('div');
    modify(rect, [0, 0], opts.image_size * 1.5);
    effect(() => (rect.style.border = deg2csspix(0.1) + 'px solid #fff'));

    const triangle = () => {
      const el = svg(
        'svg',
        { style: { fill: 'none', stroke: '#fff' } },
        svg('polygon', { attrs: { points: `1,1.732 2,0 0,0` } }),
      );
      effect(() => {
        const strokeWidth = deg2csspix(0.1);
        el.style.strokeWidth = strokeWidth + '';
        el.setAttribute(
          'viewBox',
          `${(-strokeWidth / 2) * 1.732} ${-strokeWidth / 2} ${2 + strokeWidth * 1.732} ${
            2 + strokeWidth
          }`,
        );
      });
      return el;
    };

    const option_triangle_poses: [number, number][] = [];
    const fixed_triangle_poses: [number, number][] = [];
    for (let i = 1; i <= 3; i++) {
      for (let j = 0; j <= i * 8; j++) {
        const rad = (j / (i * 8)) * (2 * Math.PI);
        const radius = i * 2;
        (i === 3 && j % 3 === 0
          ? option_triangle_poses
          : fixed_triangle_poses
        ).push([Math.sin(rad) * radius, Math.cos(rad) * radius]);
      }
    }
    const option_triangle_els = option_triangle_poses.map((pos) =>
      modify(triangle(), pos),
    );
    const fixed_triangle_els = fixed_triangle_poses.map((pos) =>
      modify(triangle(), pos),
    );
    effect(() => {
      const i = props.peripheral_angle_index;
      option_triangle_els.forEach(
        (el, j) => (el.style.visibility = i === j ? 'hidden' : 'visible'),
      );
      const pos = option_triangle_poses[i]!;
      peripheralImage.element.style.transform = `translate(${deg2csspix(pos[0])}px, ${deg2csspix(pos[1])}px)`;
    });

    return {
      element: h(
        'div',
        {
          className: 'psytask-center',
          style: { position: 'relative', transform: 'translate(50%, 50%)' },
        },
        [
          centralImage.element,
          peripheralImage.element,
          rect,
          ...option_triangle_els,
          ...fixed_triangle_els,
        ],
      ),
    };
  },
  { defaultProps: { image_indexes: [0, 1], peripheral_angle_index: 0 } },
);
// Mask scene using ImageStim
using mask = app.scene(
  (props: {}, self) => {
    const imageProps = reactive({ image: null as unknown as ImageData });
    const createNoise = () => {
      // Create white noise ImageData directly
      const imageData = new ImageData(stim_size, stim_size);
      const data = imageData.data;

      // Generate random grayscale value (white noise)
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.floor(Math.random() * 256);
        data[i] = value; // Red
        data[i + 1] = value; // Green
        data[i + 2] = value; // Blue
        data[i + 3] = 255; // Alpha (fully opaque)
      }
      imageProps.image = imageData;
    };

    self.on('scene:show', createNoise);
    createNoise();
    return {
      element: h('div', { className: 'psytask-center' }, [
        ImageStim(imageProps).element,
      ]),
    };
  },
  { defaultProps: {} },
);
// Identification response scene
using identification = app.scene(
  (props: { image_indexes: (0 | 1)[] }, self) => {
    let data: { response_image_index: number; response_time: number };

    const image_vms = props.image_indexes.map((i) => {
      const props = reactive({ image: images[i] });
      const el = ImageStim(props).element;
      el.style.cursor = 'pointer';
      el.onclick = (e) => {
        data = { response_image_index: i, response_time: e.timeStamp };
        self.close();
      };
      return { props, el };
    });
    effect(() => {
      for (const i of props.image_indexes) {
        image_vms[i]!.props.image = images[i];
      }
    });

    return {
      element: h('div', { className: 'psytask-center' }, [
        'Central Identification:\nWhich image was displayed in the center?',
        h(
          'div',
          { style: { display: 'flex', gap: '1rem', marginTop: '0.5rem' } },
          image_vms.map((e) => e.el),
        ),
      ]),
      data: () => data,
    };
  },
  { defaultProps: { image_indexes: [0, 1] } },
);
// Localization response scene - select from 8 directions
using localization = app.scene(
  (props: {}, self) => {
    let data: { response_angle_index: number; response_time: number };

    const radius = '2rem';
    const buttons = rads.map((rad, index) =>
      h(
        'button',
        {
          style: {
            width: '1rem',
            position: 'absolute',
            cursor: 'pointer',
            transform: `rotate(${rad}rad) translateY(-${radius}) rotate(-${rad}rad)`,
          },
          onclick: (e) => {
            data = {
              response_angle_index: index,
              response_time: e.timeStamp,
            };
            self.close();
          },
        },
        '' + (index + 1),
      ),
    );
    const container = h(
      'div',
      {
        style: {
          position: 'relative',
          transform: `translateY(calc(${radius} + 5px))`,
        },
      },
      buttons,
    );
    return {
      element: h('div', { className: 'psytask-center' }, [
        'Peripheral Localization:\nIn which direction did the peripheral image appear?',
        container,
      ]),
      data: () => data,
    };
  },
  { defaultProps: {} },
);
// Feedback scene
using feedback = app.text('', { close_on: 'key: ' });

// Show task instructions
await guide.show();
// Main experimental loop
for (const stim_duration of staircase) {
  // Generate trial parameters
  const central_image_index = Math.random() < 0.5 ? 0 : 1;
  const peripheral_image_index = (1 - central_image_index) as 0 | 1; // Use the other image
  const peripheral_angle_index = Math.floor(Math.random() * rads.length);

  // Show fixation
  await fixation.show();
  // Show UFOV stimulus
  await ufovStim.config({ duration: stim_duration }).show({
    image_indexes: [central_image_index, peripheral_image_index],
    peripheral_angle_index,
  });
  // Show mask
  await mask.config({ duration: opts.mask_duration }).show();

  // Collect identification response
  const identification_data = await identification.show({
    image_indexes:
      Math.random() < 0.5
        ? [central_image_index, peripheral_image_index]
        : [peripheral_image_index, central_image_index],
  });
  const identification_correct =
    identification_data.response_image_index === central_image_index;
  // Collect localization response
  const localization_data = await localization.show();
  const localization_correct =
    localization_data.response_angle_index === peripheral_angle_index;

  // Update staircase
  const correct = identification_correct && localization_correct;
  staircase.response(correct);
  // Show feedback
  await feedback.show({
    children:
      (correct
        ? '✓ Correct!'
        : !identification_correct && !localization_correct
          ? '✗ Both responses incorrect'
          : !identification_correct
            ? '✗ Central identification incorrect'
            : '✗ Peripheral localization incorrect') +
      '\nPress SPACE key to continue.',
  });

  // Collect simplified trial data
  await dc.add({
    image_urls: urls.join(','),
    stim_duration,
    central_image_index,
    peripheral_image_index,
    peripheral_angle_index,
    'identification.response_image_index':
      identification_data.response_image_index,
    'identification.rt':
      identification_data.response_time - identification_data.start_time,
    'identification.correct': identification_correct,
    'localization.response_angle_rad': localization_data.response_angle_index,
    'localization.rt':
      localization_data.response_time - localization_data.start_time,
    'localization.correct': localization_correct,
    correct,
  });
}
