import autoBind from 'auto-bind';
import type { PluginInfo, TrialType } from 'jspsych';
import { KeyboardListenerAPI } from '../../../../node_modules/jspsych/src/modules/plugin-api/KeyboardListenerAPI';
import { TimeoutAPI } from '../../../../node_modules/jspsych/src/modules/plugin-api/TimeoutAPI';
import { ParameterType } from '../../../../node_modules/jspsych/src/modules/plugins';
import type { LooseObject } from '../../types';
import { type SceneSetup } from '../scene';
import { h, hasOwn } from '../util';

declare global {
  interface Window {
    /** Compatible with jspsych cdn */
    jsPsychModule: any;
  }
}
/**
 * Add jsPsychModule in CDN browser build
 *
 * @see https://cdn.jsdelivr.net/npm/jspsych/dist/index.browser.js
 */
if (process.env.NODE_ENV === 'production') {
  window['jsPsychModule'] ??= { ParameterType };
}

const unsupportedParams = new Set([
  'extensions',
  'record_data',
  'save_timeline_variables',
  'save_trial_parameters',
  'simulation_options',
]);
function proxyNonKey<T extends object>(
  obj: T,
  onNoKey: (key: PropertyKey) => void,
) {
  return new Proxy(obj, {
    get(o, k) {
      if (hasOwn(o, k)) return o[k as keyof T];
      onNoKey(k);
    },
  });
}
/**
 * Create a scene with jsPsych Plugin
 *
 * @example
 *   using scene = app.scene(jsPsychSetup);
 *   scene.show({
 *     type: jsPsychHtmlKeyboardResponse,
 *     stimulus: 'Hello world',
 *     choices: ['f', 'j'],
 *   });
 *
 * @see https://www.jspsych.org/latest/plugins/
 */
export const jsPsychSetup = ((self) => {
  // create jsPsych DOM
  const content = h('div', {
    id: 'jspsych-content',
    className: 'jspsych-content',
  });
  self.root.appendChild(
    h(
      'div',
      {
        className: 'jspsych-display-element',
        style: { height: '100%', width: '100%' },
      },
      h('div', { className: 'jspsych-content-wrapper' }, content),
    ),
  );

  // create scene
  return function <I extends PluginInfo>(trial: TrialType<I>) {
    const Plugin = trial.type as Extract<
      TrialType<PluginInfo>['type'],
      new (...args: any[]) => any
    > & { info: I };
    if (
      typeof Plugin !== 'function' ||
      typeof Plugin.prototype === 'undefined' ||
      typeof Plugin.info === 'undefined'
    ) {
      throw new Error(
        `jsPsych trial.type only supports jsPsych class plugins, but got ${Plugin}`,
      );
    }

    // unsupported parameters
    if (process.env.NODE_ENV === 'development') {
      for (const key in trial) {
        if (hasOwn(trial, key) && unsupportedParams.has(key)) {
          console.warn(`jsPsych trial "${key}" parameter is not supported`);
        }
      }
    }
    // set default parameters
    for (const key in Plugin.info.parameters) {
      if (!hasOwn(trial, key)) {
        //@ts-ignore
        trial[key] = Plugin.info.parameters[key]!.default;
      }
    }

    // mock jsPsych API
    const mock_jsPsychPluginAPI = [
      new KeyboardListenerAPI(() => document.body),
      new TimeoutAPI(),
    ].reduce((api, item) => Object.assign(api, autoBind(item)), {});
    const mock_jsPsych = {
      finishTrial(data: LooseObject) {
        trial.on_finish?.(Object.assign(self.data, trial.data, data));
        if (typeof trial.post_trial_gap === 'number') {
          window.setTimeout(() => self.close(), trial.post_trial_gap);
        } else {
          self.close();
        }
      },
      pluginAPI:
        process.env.NODE_ENV === 'production'
          ? mock_jsPsychPluginAPI
          : proxyNonKey(mock_jsPsychPluginAPI, (key) => {
              console.warn(
                `jsPsych.pluginAPI.${key.toString()} is not supported, only supports: ${Object.keys(
                  mock_jsPsychPluginAPI,
                ).join(', ')}`,
              );
            }),
    };

    // on start
    trial.on_start?.(trial);

    // change css classes
    content.classList.value = '';
    const classes = trial.css_classes;
    if (typeof classes === 'string') {
      content.classList.add(classes);
    } else if (Array.isArray(classes)) {
      content.classList.add(...classes);
    }

    // execute trial
    const plugin = new Plugin(
      process.env.NODE_ENV === 'production'
        ? mock_jsPsych
        : proxyNonKey(mock_jsPsych, (key) => {
            console.warn(
              `jsPsych.${key.toString()} is not supported, only supports: ${Object.keys(mock_jsPsych).join(', ')}`,
            );
          }),
    );
    plugin.trial(content, trial, () => {
      trial.on_load?.();
    });
  };
}) satisfies SceneSetup;
