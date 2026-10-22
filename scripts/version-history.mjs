import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const labels = { initial: '启用前内容备份', published: '发布成功', backup: '手动备份', 'before-restore': '恢复前安全版本' };
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function createVersionRecord(root, { snapshot, kind, description, now = new Date() }) {
  if (!/^[a-f0-9]{40}$/.test(snapshot || '') || !labels[kind]) throw new Error('历史版本信息无效。');
  git(root, 'cat-file', '-e', `${snapshot}:src/_data/profile.json`);
  const time = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(now);
  return {
    title: `${time} · ${labels[kind]}`,
    createdAt: now.toISOString(),
    kind: labels[kind],
    description: description || git(root, 'show', '-s', '--format=%s', snapshot),
    snapshot,
  };
}

export function versionFromPayload(root, payload) {
  if (payload.action?.name === 'restore-history-version' || payload.context?.name === 'version_history') {
    const entry = payload.context;
    if (entry?.type !== 'entry' || entry.name !== 'version_history' || !/^history\/versions\/[a-zA-Z0-9-]+\.json$/.test(entry.path || '')) {
      throw new Error('没有识别到所选历史版本，已停止恢复。');
    }
    const record = JSON.parse(readFileSync(path.join(root, entry.path), 'utf8'));
    if (!/^[a-f0-9]{40}$/.test(record.snapshot || '')) throw new Error('历史版本编号无效，已停止恢复。');
    return record.snapshot;
  }
  return payload.inputs?.version || 'latest';
}

export function recordRemoteVersion(root, options) {
  const record = createVersionRecord(root, options);
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('缺少网站仓库信息，无法记录版本。');
  const timestamp = record.createdAt.replace(/[-:.]/g, '');
  const file = `history/versions/${timestamp}-${options.kind}-${record.snapshot.slice(0, 12)}.json`;
  const body = {
    message: `Record website version: ${record.kind}`,
    content: Buffer.from(`${JSON.stringify(record, null, 2)}\n`).toString('base64'),
    branch: 'main',
  };
  execFileSync('gh', ['api', '--method', 'PUT', `repos/${repository}/contents/${file}`, '--input', '-'], {
    cwd: root, input: JSON.stringify(body), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  return file;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = recordRemoteVersion(process.cwd(), { kind: process.argv[2], snapshot: process.argv[3] });
  console.log(`历史版本已保存：${file}`);
}
