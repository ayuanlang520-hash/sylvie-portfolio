import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const config = yaml.load(await readFile('.pages.yml', 'utf8'));
function entries(list) { return list.flatMap(entry => entry.type === 'group' ? entries(entry.items) : [entry]); }
test('CMS exposes existing text, rich text and media with Chinese labels and preserves unconfigured data', async () => {
  assert.equal(config.settings.content.merge, true);
  const editors = entries(config.content);
  for (const editor of editors) {
    assert.match(editor.label, /[\u4e00-\u9fff]/);
    if (editor.type === 'file') await readFile(editor.path);
    function check(fields) {
      for (const field of fields) {
        assert.match(field.label, /[\u4e00-\u9fff]/, `${editor.name}.${field.name}`);
        if (field.fields) check(field.fields);
      }
    }
    check(editor.fields);
  }
  for (const file of ['src/_data/profile.json', 'src/content/beichen/manual.md', 'src/content/beichen/reflection.md']) {
    assert.ok(editors.some(entry => entry.path === file));
  }
  assert.ok(editors.find(entry => entry.path === 'src/content/beichen/manual.md').fields.some(field => field.name === 'body' && field.type === 'rich-text'));
  assert.equal(config.media[0].input, 'assets');
  assert.equal(config.actions[0].workflow, 'publish.yml');
});

test('publishing workflow has only a manual trigger and deploys only after checks pass', async () => {
  const workflow = yaml.load(await readFile('.github/workflows/publish.yml', 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.ok(workflow.on.workflow_dispatch.inputs.payload);
  assert.equal(workflow.jobs.deploy.needs, 'build');
  assert.ok(workflow.jobs.build.steps.some(step => step.run === 'npm test'));
  assert.equal(workflow.jobs.build.steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@')).with.path, '_site');
});

test('high-resolution manual pages provide a direct original image link', async () => {
  const html = await readFile('_site/beichen/manual/index.html', 'utf8');
  assert.ok(html.includes('beichen-original-image'));
  for (let page = 1; page <= 6; page++) {
    const png = await readFile(`assets/beichen/manual-page-${page}.png`);
    assert.equal(Math.max(png.readUInt32BE(16), png.readUInt32BE(20)), 3200);
  }
});

test('CMS-shaped new works, experience references, articles and media render under a fixed URL', async t => {
  const fixtures = path.resolve('tests/fixtures');
  await mkdir(fixtures, { recursive: true });
  const directory = await mkdtemp(path.join(fixtures, 'cms-check-'));
  t.after(async () => {
    const relative = path.relative(fixtures, path.resolve(directory));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(directory, { recursive: true, force: true });
  });
  for (const file of ['src', 'assets', 'eleventy.config.js', 'styles.css', 'stage2.css', 'beichen.css', 'script.js', '.nojekyll']) {
    await cp(file, path.join(directory, file), { recursive: true });
  }
  const metadata = { id: 'cms-example', title: '自己添加的作品', summary: '正文与标题由我修改。', order: 1, cover: '/assets/yueji-home-mobile.png', result: { href: '', label: '', note: '' } };
  await writeFile(path.join(directory, 'src/content/portfolio/cms-example.md'), `---\n${yaml.dump(metadata)}---\n\n## 修改后的正文\n\n![中文图片说明](/assets/yueji-home-mobile.png)\n`);
  await writeFile(path.join(directory, 'src/content/experiences/cms-example.md'), `---\n${yaml.dump({ id: 'cms-example', title: '新增经历验收', summary: '关联作品', works: ['cms-example'] })}---\n\n经历正文。\n`);
  await writeFile(path.join(directory, 'src/content/notes/cms-example.md'), `---\n${yaml.dump({ id: 'cms-example', title: '新增复盘验收', summary: '文章简介' })}---\n\n文章正文。\n`);
  execFileSync(process.execPath, [path.join(root, 'node_modules/@11ty/eleventy/cmd.cjs'), '--output', 'output', '--quiet'], { cwd: directory, stdio: 'pipe' });
  const html = await readFile(path.join(directory, 'output/projects/cms-example/index.html'), 'utf8');
  assert.ok(html.includes('修改后的正文'));
  assert.ok(html.includes('src="../../assets/yueji-home-mobile.png"'));
  const home = await readFile(path.join(directory, 'output/index.html'), 'utf8');
  for (const title of ['自己添加的作品', '新增经历验收', '新增复盘验收']) assert.ok(home.includes(title));
  assert.ok(home.includes('href="projects/cms-example/"'));
  assert.ok((await readFile(path.join(directory, 'output/experiences/cms-example/index.html'), 'utf8')).includes('经历正文'));
});
