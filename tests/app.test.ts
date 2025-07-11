import { describe, test } from 'bun:test';
import { App } from '~/app';

describe('compatible with jsPsych Plugin', () => {
  //TODO: add more tests
  test('html-keyboard-response', async () => {
    const scene = new App(document.body).jsPsych({
      type: (await import('@jspsych/plugin-html-keyboard-response')).default,
    });
    await scene.show();
  });
});
