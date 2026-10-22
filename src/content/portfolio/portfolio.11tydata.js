export default {
  tags: ['portfolioEntries'], layout: 'beichen-page.njk',
  eyebrow: '个人作品', status: '', summary: '', cover: '', coverAlt: '',
  facts: [], gallery: [], result: null,
  eleventyComputed: { permalink: data => `projects/${data.id}/index.html` },
};
