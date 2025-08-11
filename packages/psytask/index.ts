import { createApp } from './src/app';
import { gratingSetup, gaussianMask } from './src/scenes';
import './main.css';

using app = await createApp();
using scene = app.scene(gratingSetup, {
  type: 'sin',
  size: 3e2,
  sf: 0.01,
  mask: gaussianMask(0.66),
});
await scene.show();

export { createApp } from './src/app';
export * from './src/data-collector';
export type * from './src/scene';
export * from './src/trial-iterator';
export { h, detectEnvironment } from './src/util';
