import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, cp, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
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
  for (const editor of editors.filter(entry => entry.path?.endsWith('.md'))) {
    assert.equal(editor.format, 'yaml-frontmatter', 'Markdown with --- delimiters must use the YAML frontmatter reader');
    const source = await readFile(editor.path, 'utf8');
    const match = source.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
    assert.ok(match, `${editor.path}: missing --- delimiters`);
    const metadata = yaml.load(match[1]);
    if (editor.fields.some(field => field.name === 'title')) assert.ok(metadata.title, `${editor.path}: title must parse as metadata`);
  }
  assert.ok(editors.find(entry => entry.path === 'src/content/beichen/manual.md').fields.some(field => field.name === 'body' && field.type === 'rich-text'));
  assert.equal(config.media[0].input, 'assets');
  for (const editor of editors.filter(entry => entry.type === 'collection' && entry.operations?.create !== false)) {
    assert.equal(editor.filename.field, false, 'Do not ask the editor to maintain a second filename alongside the fixed URL');
    assert.equal(editor.filename.template, '{id}.md');
  }
  assert.equal(config.actions.find(action => action.name === 'publish-site').workflow, 'publish.yml');
  for (const action of config.actions) {
    const workflow = yaml.load(await readFile(`.github/workflows/${action.workflow}`, 'utf8'));
    assert.ok(workflow.on.workflow_dispatch.inputs.payload);
  }
});

test('content saves automatically publish only after checks, and history commits do not trigger another release', async () => {
  const workflow = yaml.load(await readFile('.github/workflows/publish.yml', 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  for (const contentPath of ['src/**', 'assets/**']) assert.ok(workflow.on.push.paths.includes(contentPath));
  assert.ok(!workflow.on.push.paths.includes('history/**'));
  assert.ok(workflow.on.workflow_dispatch.inputs.payload);
  assert.equal(workflow.jobs.deploy.needs, 'build');
  assert.ok(workflow.jobs.build.steps.some(step => step.run === 'npm test'));
  assert.equal(workflow.jobs.build.steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@')).with.path, '_site');
  assert.equal(workflow.jobs.history.needs, 'deploy');
  const history = entries(config.content).find(entry => entry.name === 'version_history');
  assert.equal(history.format, 'json');
  assert.ok(history.view.fields.includes(history.view.default.sort), 'CMS can only sort columns included in the collection view');
  assert.equal(history.view.default.order, 'desc');
  const historyExtension = path.extname(history.filename?.template || '{primary}.md');
  for (const file of await readdir(history.path)) assert.equal(path.extname(file), historyExtension, 'CMS filters collection files by filename extension, independently of format');
  assert.deepEqual(history.operations, { create: false, rename: false, delete: false });
  assert.ok(history.fields.every(field => field.readonly));
  assert.ok(history.actions.some(action => action.scope === 'entry' && action.workflow === 'restore.yml'));
  const restore = yaml.load(await readFile('.github/workflows/restore.yml', 'utf8'));
  assert.equal(restore.permissions.actions, 'write');
  assert.ok(restore.jobs.restore.steps.some(step => step.run?.includes('publish.yml/dispatches')));
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
  for (const file of ['src', 'assets', 'lib', 'eleventy.config.js', 'styles.css', 'stage2.css', 'beichen.css', 'script.js', '.nojekyll']) {
    await cp(file, path.join(directory, file), { recursive: true });
  }
  const manualPath = path.join(directory, 'src/content/beichen/manual.md');
  const manualSource = await readFile(manualPath, 'utf8');
  const frontmatter = manualSource.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
  const manualData = yaml.load(frontmatter[1]);
  for (const field of ['coverAlt', 'status', 'eyebrow']) delete manualData[field];
  delete manualData.facts[0].value;
  await writeFile(manualPath, `---\n${yaml.dump(manualData)}---\n${manualSource.slice(frontmatter[0].length)}`);
  const metadata = { id: 'cms-example', title: '自己添加的作品', summary: '正文与标题由我修改。', order: 1, cover: '/assets/yueji-home-mobile.png', result: { href: 'https://example.com/sylvie', label: '打开我的演示', note: '', external: true } };
  const profilePath = path.join(directory, 'src/_data/profile.json');
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  profile.hero.name = '走查姓名';
  await writeFile(profilePath, JSON.stringify(profile));
  await writeFile(path.join(directory, 'src/content/portfolio/cms-example.md'), `---\n${yaml.dump(metadata)}---\n\n## 修改后的正文\n\n![中文图片说明](/assets/yueji-home-mobile.png)\n`);
  await writeFile(path.join(directory, 'src/content/experiences/cms-example.md'), `---\n${yaml.dump({ id: 'cms-example', title: '新增经历验收', summary: '关联作品', works: ['cms-example'] })}---\n\n经历正文。\n`);
  await writeFile(path.join(directory, 'src/content/notes/cms-example.md'), `---\n${yaml.dump({ id: 'cms-example', title: '新增复盘验收', summary: '文章简介' })}---\n\n文章正文。\n`);
  execFileSync(process.execPath, [path.join(root, 'node_modules/@11ty/eleventy/cmd.cjs'), '--output', 'output', '--quiet'], { cwd: directory, stdio: 'pipe' });
  const html = await readFile(path.join(directory, 'output/projects/cms-example/index.html'), 'utf8');
  assert.ok(html.includes('修改后的正文'));
  assert.ok(html.includes('src="../../assets/yueji-home-mobile.png?v='));
  assert.ok(html.includes('<title>自己添加的作品 · 走查姓名的个人主页</title>'));
  assert.ok(!html.includes('返回北辰经历'));
  const home = await readFile(path.join(directory, 'output/index.html'), 'utf8');
  assert.ok(home.includes('alt="个人说明书"'), 'CMS may omit empty optional fields; use the case title as a cover description');
  for (const title of ['自己添加的作品', '新增经历验收', '新增复盘验收']) assert.ok(home.includes(title));
  assert.ok(home.includes('href="projects/cms-example/"'));
  assert.match(home, /href="https:\/\/example\.com\/sylvie" target="_blank" rel="noreferrer">打开我的演示/);
  const experienceHtml = await readFile(path.join(directory, 'output/experiences/cms-example/index.html'), 'utf8');
  assert.ok(experienceHtml.includes('经历正文'));
  assert.ok(experienceHtml.includes('href="../../projects/cms-example/"'));
  const sectionsFile = path.join(directory, 'src/_data/sections.json');
  const sections = JSON.parse(await readFile(sectionsFile, 'utf8'));
  sections.items.push({ key: 'custom', id: 'qa-notes', title: '自定义板块验收', navigationLabel: '新板块', visible: true, inNavigation: true, body: '真正保存的自定义正文。' });
  await writeFile(sectionsFile, JSON.stringify(sections));
  const build = () => execFileSync(process.execPath, [path.join(root, 'node_modules/@11ty/eleventy/cmd.cjs'), '--output', 'output', '--quiet'], { cwd: directory, stdio: 'pipe' });
  build();
  const added = await readFile(path.join(directory, 'output/index.html'), 'utf8');
  assert.ok(added.includes('href="#section-qa-notes"'));
  assert.ok(added.includes('真正保存的自定义正文。'));
  sections.items.find(item => item.key === 'projects').visible = false;
  sections.items = sections.items.filter(item => item.id !== 'qa-notes' && item.key !== 'more');
  await writeFile(sectionsFile, JSON.stringify(sections));
  build();
  const removed = await readFile(path.join(directory, 'output/index.html'), 'utf8');
  for (const target of ['projects', 'more', 'section-qa-notes']) {
    assert.ok(!removed.includes(`href="#${target}"`), `Dead navigation after section removal: ${target}`);
    assert.ok(!removed.includes(`id="${target}"`));
  }
});
