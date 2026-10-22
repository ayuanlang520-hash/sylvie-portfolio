export default {
  tags: ['noteEntries'], layout: 'beichen-page.njk',
  eyebrow: '实践记录', status: '', summary: '', facts: [], gallery: [], result: null,
  eleventyComputed: { permalink: data => `notes/${data.id}/index.html` },
};
