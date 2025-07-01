## Usage

```ts
import { createApp, h } from 'psytask';

// create scenes
const app = await createApp();
const fixation = app.fixation({ duration: 500 }); // built-in scene
const blank = app.blank(); // built-in scene
const guide = app.text('Please click to start', { close_on: 'click' }); // built-in scene
const thanks = app.text('Thanks for your participation!');
const letter = app.scene(
  function (self) {
    const el = h('span');
    self.root.appendChild(el); // mount element to scene root
    // return update function
    return function (text: string) {
      el.textContent = text;
    };
  },
  { duration: 100 },
); // custom scene

// show scenes
await guide.show();
for (let i = 0; i < 26; i++) {
  await fixation.show();
  await letter.show(String.fromCharCode(65 + i));
  await blank
    .config({ duration: Math.floor(Math.random() * 1000) + 1000 }) // random duration
    .show();
}
await thanks.show();
```

## .env

```
browser=/usr/bin/google-chrome # for puppeteer
```
