import type { SceneSetup } from '../scene';

export const apply = <T extends SceneSetup, U extends Parameters<T>[0]>(
  setup: T,
  props: U,
  self: Parameters<T>[1],
) => ({
  ...(setup(props, self) as ReturnType<T>),
  props,
});

export * from './form';
export * from './jspsych';
export * from './visual';
