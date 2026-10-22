import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordRemoteVersion, versionFromPayload } from './version-history.mjs';

const contentPaths = ['src/_data', 'src/content', 'assets', ':(glob,exclude)src/content/**/*.11tydata.*'];
function git(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function clean(root) {
  if (git(root, 'status', '--porcelain', '--untracked-files=no')) throw new Error('当前有未提交修改，已停止恢复以保护内容。');
}
function stamp(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }

export function createBackup(root, date = new Date()) {
  clean(root);
  const sha = git(root, 'rev-parse', 'HEAD');
  const tag = `backup/content-${stamp(date)}`;
  git(root, 'tag', tag, sha);
  const folder = path.join(root, '.backup-output');
  mkdirSync(folder, { recursive: true });
  const archive = path.join(folder, 'portfolio-backup.zip');
  git(root, 'archive', '--format=zip', `--output=${archive}`, sha);
  const result = { tag, sha, created: date.toISOString() };
  writeFileSync(path.join(folder, 'backup-info.json'), JSON.stringify(result, null, 2));
  return result;
}

export function restoreContent(root, requested = 'latest', date = new Date()) {
  clean(root);
  const version = requested.trim() || 'latest';
  const ref = version === 'latest' ? git(root, 'tag', '--list', 'backup/content-*', '--sort=-refname').split('\n')[0] : version;
  if (!/^(?:backup\/content-[A-Za-z0-9-]+|[a-f0-9]{40})$/.test(ref)) throw new Error('没有找到备份，请先创建一次备份。');
  const target = git(root, 'rev-parse', '--verify', `${ref}^{commit}`);
  git(root, 'cat-file', '-e', `${target}:src/_data/profile.json`);
  const before = git(root, 'rev-parse', 'HEAD');
  git(root, 'restore', `--source=${target}`, '--staged', '--worktree', '--', ...contentPaths);
  if (!git(root, 'diff', '--cached', '--name-only')) return { ref, target, before, changed: false, safetyTag: null };
  const safetyTag = `safety/content-before-restore-${stamp(date)}`;
  git(root, 'tag', safetyTag, before);
  git(root, 'commit', '-m', `Restore website content from ${ref}`);
  return { ref, target, before, changed: true, safetyTag };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const operation = process.argv[2];
  let result;
  if (operation === 'backup') {
    result = createBackup(root);
    if (process.argv.includes('--push')) {
      git(root, 'push', 'origin', `refs/tags/${result.tag}`);
      recordRemoteVersion(root, { snapshot: result.sha, kind: 'backup', description: `手动保存的内容备份：${result.tag}` });
    }
  } else if (operation === 'restore') {
    const payload = JSON.parse(process.env.CMS_PAYLOAD || '{}');
    result = restoreContent(root, versionFromPayload(root, payload));
    if (process.argv.includes('--push') && result.changed) {
      git(root, 'push', '--atomic', 'origin', 'HEAD:main', `refs/tags/${result.safetyTag}`);
      recordRemoteVersion(root, { snapshot: result.before, kind: 'before-restore', description: '恢复操作前自动留下的内容，可用于撤销本次恢复。' });
    }
  } else throw new Error('请选择 backup 或 restore。');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = operation === 'backup'
      ? `## 备份已创建\n\n版本：\`${result.tag}\`\n\n在本次运行的 Artifacts 中下载 portfolio-backup，内含网站源文件压缩包和版本说明。\n\n备份没有发布网站。\n`
      : `## 内容${result.changed ? '已恢复' : '与备份一致，无需修改'}\n\n恢复版本：\`${result.ref}\`\n\n文字、作品、板块和图片已读回。程序和发布设置保持当前版本。\n\n${result.safetyTag ? `恢复前内容另存于 \`${result.safetyTag}\`，也可在后台历史版本找到。\n\n` : ''}下一步会自动检查并发布，请查看发布任务的结果。\n`;
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  console.log(JSON.stringify(result));
}
