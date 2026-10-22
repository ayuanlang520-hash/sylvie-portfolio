import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

const pages = ['index.html', ...['manual', 'workbench', 'job-skill', 'reflection', 'skill'].map(id => `beichen/${id}/index.html`)];
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
function all(node, predicate) { return [...(predicate(node) ? [node] : []), ...(node.childNodes ?? []).flatMap(child => all(child, predicate))]; }
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');

test('new pages and local links resolve when hosted under a GitHub Pages repository prefix', async () => {
  for (const page of pages) {
    const doc = parse(await readFile(path.join('_site', page), 'utf8'));
    const ids = all(doc, node => Boolean(attr(node, 'id'))).map(node => attr(node, 'id'));
    assert.equal(new Set(ids).size, ids.length, `${page}: duplicate IDs`);
    const base = new URL(page.replace(/index.html$/, ''), 'https://example.test/sylvie-portfolio/');
    for (const node of all(doc, node => Boolean(node.tagName))) {
      for (const name of ['aria-labelledby', 'aria-describedby']) {
        for (const id of (attr(node, name) ?? '').split(/\s+/).filter(Boolean)) assert.ok(ids.includes(id), `${page}: missing ${id}`);
      }
      for (const name of ['src', 'href', 'poster']) {
        const value = attr(node, name);
        if (!value || /^(https?:|mailto:)/.test(value)) continue;
        const url = new URL(value, base);
        assert.ok(url.pathname.startsWith('/sylvie-portfolio/'), `${page}: escaped repository prefix ${value}`);
        let local = path.join('_site', decodeURIComponent(url.pathname.slice('/sylvie-portfolio/'.length)));
        if ((await stat(local)).isDirectory()) local = path.join(local, 'index.html');
        assert.ok((await stat(local)).isFile(), `${page}: missing ${value}`);
        if (url.hash && local.endsWith('.html')) {
          const target = parse(await readFile(local, 'utf8'));
          assert.ok(all(target, item => attr(item, 'id') === decodeURIComponent(url.hash.slice(1))).length, `${page}: missing anchor ${value}`);
        }
      }
    }
  }
});

test('homepage has three cases with separate result and process entries, after original projects', async () => {
  const doc = parse(await readFile('_site/index.html', 'utf8'));
  const sections = all(doc, node => node.tagName === 'section').map(node => attr(node, 'id'));
  assert.ok(sections.indexOf('experience') > sections.indexOf('projects'));
  assert.ok(sections.indexOf('experience') < sections.indexOf('more'));
  const cards = all(doc, node => node.tagName === 'article' && attr(node, 'class') === 'beichen-card');
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.equal(all(card, node => node.tagName === 'a' && text(node).includes('看成果')).length, 1);
    assert.equal(all(card, node => node.tagName === 'a' && text(node).includes('看实践过程')).length, 1);
  }
  assert.match(text(doc), /训练营(?:之)?前/);
});

test('source artifacts remain intact and incomplete interview and reflection are visibly disclosed', async () => {
  const sourceSkill = await readFile('assets/beichen/求职-SKILL.md', 'utf8');
  const renderedSkill = parse(await readFile('_site/beichen/skill/index.html', 'utf8'));
  assert.ok(text(renderedSkill).includes('当时留存的 SKILL.md'));
  assert.ok(sourceSkill.includes('完整跑通一次'));
  const interview = text(parse(await readFile('_site/beichen/job-skill/index.html', 'utf8')));
  assert.ok(interview.includes('未保留录制'));
  assert.ok(interview.includes('不回填成当周已经完成'));
  const reflection = text(parse(await readFile('_site/beichen/reflection/index.html', 'utf8')));
  assert.ok(reflection.includes('尚非最终提交版'));
  assert.ok(reflection.includes('未来 30 天的一件事'));
});
