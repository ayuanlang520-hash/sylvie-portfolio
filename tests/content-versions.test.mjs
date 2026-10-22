import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createBackup, restoreContent } from '../scripts/content-versions.mjs';
import { createVersionRecord, versionFromPayload } from '../scripts/version-history.mjs';

async function repository(t) {
  const parent = path.resolve('tests/fixtures');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'version-check-'));
  t.after(async () => {
    const relative = path.relative(parent, path.resolve(root));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(root, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Local QA');
  git('config', 'user.email', 'qa@example.invalid');
  for (const folder of ['src/_data', 'src/content', 'assets']) await mkdir(path.join(root, folder), { recursive: true });
  await writeFile(path.join(root, 'src/_data/profile.json'), '{"name":"备份前"}');
  await writeFile(path.join(root, 'src/content/article.md'), '原文章');
  await writeFile(path.join(root, 'src/content/article.11tydata.json'), '{"layout":"旧规则"}');
  await writeFile(path.join(root, 'assets/example.txt'), '原附件');
  await writeFile(path.join(root, 'program.txt'), '旧程序');
  git('add', '.'); git('commit', '-m', 'Seed test');
  return { root, git };
}

test('backup and restore recover changed, deleted and added content while preserving current code', async t => {
  const { root, git } = await repository(t);
  const backup = createBackup(root, new Date('2026-10-22T00:00:00Z'));
  assert.equal(git('rev-parse', backup.tag), backup.sha);
  const archive = await readFile(path.join(root, '.backup-output/portfolio-backup.zip'));
  assert.equal(archive.subarray(0, 2).toString(), 'PK');
  await writeFile(path.join(root, 'src/_data/profile.json'), '{"name":"修改后"}');
  await writeFile(path.join(root, 'src/content/new.md'), '新增文章');
  await rm(path.join(root, 'assets/example.txt'));
  await writeFile(path.join(root, 'program.txt'), '修好后的程序');
  await writeFile(path.join(root, 'src/content/article.11tydata.json'), '{"layout":"当前规则"}');
  git('add', 'src', 'assets', 'program.txt'); git('commit', '-m', 'Change content and code');
  const beforeRestore = git('rev-parse', 'HEAD');
  const restored = restoreContent(root, 'latest', new Date('2026-10-22T00:01:00Z'));
  assert.equal(restored.changed, true);
  assert.equal(await readFile(path.join(root, 'src/_data/profile.json'), 'utf8'), '{"name":"备份前"}');
  assert.equal(await readFile(path.join(root, 'assets/example.txt'), 'utf8'), '原附件');
  await assert.rejects(stat(path.join(root, 'src/content/new.md')));
  assert.equal(await readFile(path.join(root, 'program.txt'), 'utf8'), '修好后的程序');
  assert.equal(await readFile(path.join(root, 'src/content/article.11tydata.json'), 'utf8'), '{"layout":"当前规则"}');
  assert.equal(git('rev-parse', restored.safetyTag), beforeRestore);
  restoreContent(root, beforeRestore, new Date('2026-10-22T00:02:00Z'));
  assert.equal(await readFile(path.join(root, 'src/_data/profile.json'), 'utf8'), '{"name":"修改后"}');
  assert.equal(await readFile(path.join(root, 'src/content/new.md'), 'utf8'), '新增文章');
});

test('restore refuses missing backups and uncommitted changes without overwriting data', async t => {
  const { root } = await repository(t);
  assert.throws(() => restoreContent(root), /没有找到备份/);
  createBackup(root, new Date('2026-10-22T00:00:00Z'));
  await writeFile(path.join(root, 'src/_data/profile.json'), '尚未保存的内容');
  assert.throws(() => restoreContent(root), /未提交修改/);
  assert.equal(await readFile(path.join(root, 'src/_data/profile.json'), 'utf8'), '尚未保存的内容');
});

test('CMS history actions restore the selected stored version, preserving history and current generator rules', async t => {
  const { root, git } = await repository(t);
  const snapshot = git('rev-parse', 'HEAD');
  const record = createVersionRecord(root, { snapshot, kind: 'published', now: new Date('2026-10-22T00:00:00Z') });
  await mkdir(path.join(root, 'history/versions'), { recursive: true });
  await writeFile(path.join(root, 'history/versions/example.json'), JSON.stringify(record));
  await writeFile(path.join(root, 'src/_data/profile.json'), '{"name":"误改后"}');
  await writeFile(path.join(root, 'src/content/article.11tydata.json'), '{"layout":"当前规则"}');
  git('add', '.'); git('commit', '-m', 'Save a history record and edited content');
  const payload = { action: { name: 'restore-history-version' }, context: { type: 'entry', name: 'version_history', path: 'history/versions/example.json', data: { snapshot: 'do-not-trust-browser-fields' } } };
  assert.equal(versionFromPayload(root, payload), snapshot);
  const restored = restoreContent(root, versionFromPayload(root, payload));
  assert.equal(restored.changed, true);
  assert.equal(await readFile(path.join(root, 'src/_data/profile.json'), 'utf8'), '{"name":"备份前"}');
  assert.equal(await readFile(path.join(root, 'src/content/article.11tydata.json'), 'utf8'), '{"layout":"当前规则"}');
  assert.equal(JSON.parse(await readFile(path.join(root, 'history/versions/example.json'), 'utf8')).snapshot, snapshot);
  assert.ok(record.title.includes('发布成功'));
  assert.ok(record.title.includes('8:00:00'));
});

test('history recovery rejects missing context and path traversal instead of falling back to another backup', async t => {
  const { root } = await repository(t);
  assert.throws(() => versionFromPayload(root, { action: { name: 'restore-history-version' } }), /停止恢复/);
  assert.throws(() => versionFromPayload(root, { context: { type: 'entry', name: 'version_history', path: 'history/versions/../../profile.json' } }), /停止恢复/);
  assert.equal(versionFromPayload(root, { inputs: { version: 'backup/content-example' } }), 'backup/content-example');
});
