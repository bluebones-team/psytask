import { confirm, isCancel, outro, text } from '@clack/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';

const templateDir = path.join(
  import.meta.dirname,
  (process.env.NODE_ENV === 'production' ? '../' : './') + 'template',
);
const unwrap = async <T>(maybeCancelPromise: Promise<T | symbol>) => {
  const result = await maybeCancelPromise;
  if (isCancel(result)) {
    process.exit(0);
  }
  return result;
};
(async () => {
  if (process.argv0 !== 'bun') {
    console.warn(
      'We only provide templates for bun temporarily, please change package.json scripts yourself.',
    );
  }

  // input
  const projectName = (
    await unwrap(
      text({
        message: 'Project name:',
        placeholder: 'psytask-project',
        defaultValue: 'psytask-project',
      }),
    )
  ).trim();
  const useTypeScript = await unwrap(
    confirm({ message: `Use TypeScript?`, initialValue: false }),
  );

  // check target dir
  const targetDir = path.join(process.cwd(), projectName);
  await fs.access(targetDir, fs.constants.W_OK).then(
    async () => {
      const shouldOverwrite = await unwrap(
        confirm({
          message: `Directory already exists. Do you want to overwrite it?`,
          initialValue: false,
        }),
      );
      if (!shouldOverwrite) return;
      await fs.rm(targetDir, { recursive: true, force: true });
    },
    () => fs.mkdir(targetDir, { recursive: true }),
  );

  // copy
  await fs.cp(
    path.join(templateDir, useTypeScript ? 'bun-ts' : 'bun-js'),
    targetDir,
    { recursive: true },
  );

  // modify package.json
  const targetPkgFilepath = path.join(targetDir, 'package.json');
  const pkgJson = Object.assign(
    JSON.parse(await fs.readFile(targetPkgFilepath, 'utf-8')),
    { name: projectName },
  );
  await fs.writeFile(targetPkgFilepath, JSON.stringify(pkgJson, null, 2));

  outro(`Project created successfully: ${targetDir}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
