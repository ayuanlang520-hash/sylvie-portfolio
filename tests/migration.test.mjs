import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, cp, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'parse5';
import yaml from 'js-yaml';

const root = process.cwd();
const built = await readFile('_site/index.html', 'utf8');
const document = parse(built);
const attr = (node, key) => node.attrs?.find(item => item.name === key)?.value;
function all(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.childNodes ?? []).flatMap(child => all(child, predicate))];
}
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
const hash = content => createHash('sha256').update(content).digest('hex');
test('local media, links, anchors and accessibility references resolve', async () => {
  const nodes = all(document, node => Boolean(node.tagName));
  const ids = nodes.map(node => attr(node, 'id')).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  for (const node of nodes) {
    for (const name of ['aria-labelledby', 'aria-describedby']) {
      for (const id of (attr(node, name) ?? '').split(/\s+/).filter(Boolean)) {
        assert.ok(ids.includes(id), `Missing ${name} target: ${id}`);
      }
    }
    for (const name of ['href', 'src', 'poster']) {
      const value = attr(node, name);
      if (!value || /^(?:https?:|mailto:)/.test(value)) continue;
      if (value.startsWith('#')) {
        assert.ok(ids.includes(value.slice(1)), `Missing anchor: ${value}`);
      } else {
        const file = path.resolve('_site', decodeURIComponent(value.split(/[?#]/)[0]));
        const info = await stat(file);
        assert.ok(info.isFile() || (info.isDirectory() && (await stat(path.join(file, 'index.html'))).isFile()), `Missing local target: ${value}`);
      }
    }
  }
});

async function assetFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? assetFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}

test('styles, interactions and media files are copied byte for byte', async () => {
  const files = ['styles.css', 'stage2.css', 'beichen.css', 'script.js', '.nojekyll', ...await assetFiles('assets')];
  for (const file of files) {
    assert.equal(hash(await readFile(file)), hash(await readFile(path.join('_site', file))), `Changed resource: ${file}`);
  }
});

async function fixture(t) {
  const verificationRoot = path.resolve('tests/fixtures');
  await mkdir(verificationRoot, { recursive: true });
  const directory = await mkdtemp(path.join(verificationRoot, 'content-check-'));
  await cp('src', path.join(directory, 'src'), { recursive: true });
  await cp('eleventy.config.js', path.join(directory, 'eleventy.config.js'));
  await cp('lib', path.join(directory, 'lib'), { recursive: true });
  for (const asset of ['assets', 'styles.css', 'stage2.css', 'beichen.css', 'script.js', '.nojekyll']) {
    await cp(asset, path.join(directory, asset), { recursive: true });
  }
  t.after(async () => {
    const resolved = path.resolve(directory);
    const relative = path.relative(verificationRoot, resolved);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(resolved, { recursive: true, force: true });
  });
  return directory;
}
function buildFixture(directory) {
  return execFileSync(process.execPath, [
    path.join(root, 'node_modules/@11ty/eleventy/cmd.cjs'),
    '--input', 'src',
    '--output', 'output',
    '--config', 'eleventy.config.js',
    '--quiet',
  ], { cwd: directory, encoding: 'utf8', stdio: 'pipe' });
}
async function updateProject(file, update, bodySuffix = '') {
  const content = await readFile(file, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  const data = yaml.load(match[1]);
  update(data);
  await writeFile(file, `---\n${yaml.dump(data)}---\n${match[2]}${bodySuffix}`, 'utf8');
}

test('editing an isolated data and Markdown copy updates the page without executing content', async t => {
  const originalProfile = hash(await readFile('src/_data/profile.json'));
  const directory = await fixture(t);
  const profileFile = path.join(directory, 'src/_data/profile.json');
  const profile = JSON.parse(await readFile(profileFile, 'utf8'));
  profile.hero.introduction = '内容更新验收：中文、&、<标签> 和 "引号"。';
  profile.hero.role = '{{ 7 * 7 }}';
  await writeFile(profileFile, JSON.stringify(profile), 'utf8');
  await updateProject(path.join(directory, 'src/content/projects/yueji.md'), data => {
    data.title = '阅迹更新验收';
    data.detail.sections.push({ title: '更新验收', body: '**新正文** {{ 7 * 7 }}\n\n<script>alert("example")</script>' });
  });
  buildFixture(directory);
  const result = await readFile(path.join(directory, 'output/index.html'), 'utf8');
  const parsed = parse(result);
  assert.ok(text(parsed).includes(profile.hero.introduction));
  assert.ok(text(parsed).includes('阅迹更新验收'));
  assert.ok(text(parsed).includes('新正文 {{ 7 * 7 }}'));
  assert.equal(all(parsed, node => node.tagName === 'script').length, 1, 'Only the original interaction script is allowed');
  assert.equal(hash(await readFile('src/_data/profile.json')), originalProfile, 'Test must leave actual content untouched');
});

test('project sections can be renamed or removed, and historical Markdown still renders', async t => {
  const directory = await fixture(t);
  const ids = ['yueji', 'miaoxueyuan', 'prompt-forest'];
  for (const id of ids) await updateProject(path.join(directory, `src/content/projects/${id}.md`), data => {
    data.detail.sections = [{ title: '<自定义小标题>', body: '只保留这一点的内容。' }];
  });
  buildFixture(directory);
  let document = parse(await readFile(path.join(directory, 'output/index.html'), 'utf8'));
  for (const id of ids) {
    const detail = all(document, node => attr(node, 'id') === `${id}-detail`)[0];
    assert.deepEqual(all(detail, node => node.tagName === 'h4').map(text), ['<自定义小标题>']);
    assert.ok(text(detail).includes('只保留这一点的内容。'));
  }
  for (const id of ids) await updateProject(path.join(directory, `src/content/projects/${id}.md`), data => { delete data.detail.sections; }, '\n\n#### 历史标题\n\n历史正文。\n');
  buildFixture(directory);
  document = parse(await readFile(path.join(directory, 'output/index.html'), 'utf8'));
  for (const id of ids) {
    const detail = all(document, node => attr(node, 'id') === `${id}-detail`)[0];
    assert.deepEqual(all(detail, node => node.tagName === 'h4').map(text), ['历史标题']);
    assert.ok(text(detail).includes('历史正文。'));
  }
});

test('contacts without links render as text while valid contacts remain clickable', async t => {
  const originalProfile = hash(await readFile('src/_data/profile.json'));
  const directory = await fixture(t);
  const profileFile = path.join(directory, 'src/_data/profile.json');
  const profile = JSON.parse(await readFile(profileFile, 'utf8'));
  profile.contact.links = [
    { label: '微信', value: 'wechat-example' },
    { label: '其他联系方式', value: 'plain-example', href: '' },
    { label: '邮箱', value: 'hello@example.com', href: 'mailto:hello@example.com' },
    { label: '个人网站', value: 'example.com', href: 'https://example.com/' },
  ];
  await writeFile(profileFile, JSON.stringify(profile), 'utf8');
  buildFixture(directory);
  const document = parse(await readFile(path.join(directory, 'output/index.html'), 'utf8'));
  const contact = all(document, node => attr(node, 'id') === 'contact')[0];
  const anchors = all(contact, node => node.tagName === 'a');
  assert.deepEqual(anchors.map(node => attr(node, 'href')), ['mailto:hello@example.com', 'https://example.com/']);
  for (const value of ['wechat-example', 'plain-example']) {
    const row = all(contact, node => node.tagName === 'div' && attr(node, 'class') === 'contact-item' && text(node).includes(value))[0];
    assert.ok(row, `${value} must remain visible as a non-clickable contact row`);
    assert.equal(all(row, node => node.tagName === 'i').length, 0, 'Plain contacts must not suggest a jump');
  }
  assert.equal(hash(await readFile('src/_data/profile.json')), originalProfile, 'Test must preserve real profile edits');
});

test('unsafe contact links still fail the build', async t => {
  const directory = await fixture(t);
  const profileFile = path.join(directory, 'src/_data/profile.json');
  const profile = JSON.parse(await readFile(profileFile, 'utf8'));
  profile.contact.links = [{ label: '危险链接', value: 'not-clickable', href: 'javascript:alert(1)' }];
  await writeFile(profileFile, JSON.stringify(profile), 'utf8');
  assert.throws(() => buildFixture(directory), error => {
    assert.equal(error.status, 1);
    assert.match(String(error.stdout) + String(error.stderr), /Error in Nunjucks Filter `linkHref`/);
    return true;
  });
});

test('an unsafe content link fails the build and leaves the current generated site untouched', async t => {
  const originalOutput = hash(await readFile('_site/index.html'));
  const directory = await fixture(t);
  await updateProject(path.join(directory, 'src/content/projects/inspiration-planet.md'), data => {
    data.actions.prototype.href = 'javascript:alert(1)';
  });
  assert.throws(() => buildFixture(directory), error => {
    assert.equal(error.status, 1);
    assert.match(String(error.stdout) + String(error.stderr), /Error in Nunjucks Filter `linkHref`/);
    return true;
  });
  assert.equal(hash(await readFile('_site/index.html')), originalOutput);
});
