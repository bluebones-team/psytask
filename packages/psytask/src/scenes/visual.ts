import type { Properties as CSSProperties } from 'csstype';
import type { RGB255 } from '../../types';
import { type SceneSetup } from '../scene';
import { clamp, h, hasOwn } from '../util';

// mask
type MaskFunction = (x: number, y: number) => number;
export const gaussianMask =
  (sigma: number): MaskFunction =>
  (x, y) =>
    Math.exp(-(x ** 2 + y ** 2) / (2 * sigma ** 2));

// scene
export const textSetup = ((self) => {
  const el = h('p');
  self.root.appendChild(
    h('div', { style: { textAlign: 'center', lineHeight: '100dvh' } }, el),
  );

  return (
    props: CSSProperties & { children: string | Node | (string | Node)[] },
  ) => {
    for (const key in props) {
      if (hasOwn(props, key)) {
        if (key === 'children') {
          Array.isArray(props.children)
            ? el.replaceChildren(...props.children)
            : el.replaceChildren(props.children);
        }
        //@ts-ignore
        el.style[key] = props[key]!;
      }
    }
  };
}) satisfies SceneSetup;

export const imageSetup = ((self) => {
  const el = h('canvas');
  const ctx = el.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }
  self.root.appendChild(
    h(
      'div',
      {
        style: {
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
      },
      el,
    ),
  );

  return (
    props:
      | { image: ImageBitmap | ImageData }
      | { draw(ctx: CanvasRenderingContext2D): void },
  ) => {
    ctx.clearRect(0, 0, el.width, el.height);
    if (hasOwn(props, 'image')) {
      const image = props.image;
      [el.width, el.height] = [image.width, image.height];

      if (image instanceof ImageData) {
        ctx.putImageData(image, 0, 0);
        return;
      }
      ctx.drawImage(image, 0, 0);
      return;
    }
    props.draw(ctx);
  };
}) satisfies SceneSetup;

type WaveFunction = (x: number) => number;
const waves = {
  sin: Math.sin,
  square: (x) => (Math.sin(x) >= 0 ? 1 : -1),
  triangle: (x) => (2 / Math.PI) * Math.asin(Math.sin(x)),
  sawtooth: (x) => (2 / Math.PI) * ((x % (2 * Math.PI)) - Math.PI),
} satisfies Record<string, WaveFunction>;
export const gratingSetup = ((self) => {
  const imageUpdate = imageSetup(self);

  return (props: {
    /** Wave type or wave function that return [-1, 1] */
    type: keyof typeof waves | WaveFunction;
    /** Width or [width, height] @unit pix */
    size: number | [number, number];
    /** Spatial frequency @unit cycle/pix */
    sf: number;
    /** Orientation @unit rad */
    ori?: number;
    /** @unit rad */
    phase?: number;
    /** Color or [color, color] @unit rgb255 */
    color?: RGB255 | [RGB255, RGB255];
    /** Mask function that inputs [-1, 1] and returns [0, 1] */
    mask?: MaskFunction;
  }) => {
    const p = { ori: 0, phase: 0, color: [0, 0, 0] as RGB255, ...props };
    const [w, h] = typeof p.size === 'number' ? [p.size, p.size] : p.size;

    const cosOri = Math.cos(p.ori);
    const sinOri = Math.sin(p.ori);

    const centerX = w / 2;
    const centerY = h / 2;

    const imageData = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - centerX;
        const dy = y - centerY;

        const rotatedX = dx * cosOri + dy * sinOri;
        const pos = rotatedX * p.sf * 2 * Math.PI + p.phase;
        const waveValue =
          typeof p.type === 'string' ? waves[p.type](pos) : p.type(pos);
        const intensity = (waveValue + 1) / 2; // [-1, 1] to [0, 1]

        const rgba = (
          p.color.length === 2
            ? [
                ...p.color[1].map(
                  //@ts-ignore
                  (c, i) => c + intensity * (p.color[0][i] - c),
                ),
                255,
              ]
            : [...p.color, 255 * intensity]
        ) as [number, number, number, number];

        if (rgba[3] > 0 && p.mask) {
          rgba[3] *= p.mask(dx / centerX, dy / centerY);
        }

        let pixelIndex = (y * w + x) * 4;
        for (const value of rgba) {
          imageData.data[pixelIndex++] = clamp(Math.round(value), 0, 255);
        }
      }
    }

    imageUpdate({ image: imageData });
  };
}) satisfies SceneSetup;
