import { expect } from 'bun:test';
import type { Page } from 'puppeteer-core';
import { createApp } from '../../src/app';

export const InvalidPlugin = global.$prod
  ? async () => {
      using app = await createApp();
      using s = app.jsPsych({ type: class {} });
      await s.show();
    }
  : async (page: Page) => {
      const el = await page.$('div.psytask-scene');
      expect(el).not.toBeNull();
      expect(await el!.evaluate((el) => el.innerText)).toBe(
        'jsPsych trial.type only supports jsPsych class plugins',
      );
    };
export const HtmlButtonResponsePlugin = global.$prod
  ? async () => {
      using app = await createApp();
      using s = app.jsPsych({
        type: (await import('@jspsych/plugin-html-button-response')).default,
        stimulus: 'Test',
        choices: ['A', 'B', 'C'],
      });
      await s.show();
    }
  : async (page: Page) => {
      const stim = await page.$('#jspsych-html-button-response-stimulus');
      expect(stim).not.toBeNull();
      expect(await stim!.evaluate((el) => el.innerHTML)).toBe('Test');

      const btns = await page.$$('button.jspsych-btn');
      expect(
        await Promise.all(btns.map((e) => e.evaluate((el) => el.innerText))),
      ).toEqual(['A', 'B', 'C']);
      await btns[0]!.click();

      expect(await page.$('#jspsych-content')).toBeNull();
    };
