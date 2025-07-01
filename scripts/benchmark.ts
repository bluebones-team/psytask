import fs from 'fs/promises';
import path from 'path';
import { launch } from 'puppeteer-core';

const samplingCount = +(process.argv[2] ?? 1);
if (isNaN(samplingCount)) {
  throw new Error('Invalid sampling count');
}
const rootpath = path.resolve('./benchmarks');
// create data file
const datapath = path.join(rootpath, 'data');
await fs.mkdir(datapath, { recursive: true });
const datafile = Bun.file(
  path.join(datapath, `benchmark-${Date.now()}.csv`),
).writer();
datafile.write('os,browser,lib,task,bundle,memory,index,value,except\n');
// connect to browser
const browser = await launch({
  headless: false,
  executablePath: process.env.browser,
  args: [],
});
const version = await browser.version();
// each library
for (const item of await fs.readdir(rootpath, { withFileTypes: true })) {
  if (item.isFile() || item.name === 'data') {
    continue;
  }
  const lib = item.name;
  // load css
  const cssFile = Bun.file(path.join(rootpath, lib, 'main.css'));
  const cssCode = (await cssFile.exists()) ? await cssFile.text() : '';
  // each task
  for await (const filepath of new Bun.Glob(
    path.join(rootpath, lib, '*.bench.ts'),
  ).scan()) {
    const task = path.basename(filepath).replace('.bench.ts', '');
    const st = performance.now();
    // bundle js
    const ch = Bun.spawn({ cmd: ['bun', 'build', '--production', filepath] });
    const jsCode = await Bun.readableStreamToText(ch.stdout);
    ch.kill();
    const size = cssCode.length + jsCode.length;
    // create page
    const page = await browser.newPage();
    let lastPromiseWithResolvers: PromiseWithResolvers<Benchmark[]> | null =
      null;
    await page.exposeFunction('__benchmark__', (datas: Benchmark[]) => {
      lastPromiseWithResolvers?.resolve(datas);
    });
    // samplings
    for (let i = 0; i < samplingCount; i++) {
      lastPromiseWithResolvers = Promise.withResolvers<Benchmark[]>();
      await page.reload();
      await page.setContent(
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${lib}/${task}/${i + 1}</title>
    <style>${cssCode}</style>
  </head>
  <body>
    <script type="module">${jsCode}</script>
  </body>
</html>`,
      );
      const { JSHeapTotalSize: memory } = await page.metrics();
      datafile.write(
        (await lastPromiseWithResolvers.promise).reduce(
          (acc, e, i) =>
            acc +
            `${process.platform},${version},${lib},${task},${size},${memory},${
              i + 1
            },${e.value},${e.except}\n`,
          '',
        ),
      );
    }
    await page.close();
    console.log(
      `Benchmarking ${lib}/${task} done in ${performance.now() - st} ms`,
    );
  }
}
await browser.close();
