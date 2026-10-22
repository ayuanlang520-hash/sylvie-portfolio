export default {
  tags: ['experienceEntries'], layout: 'beichen-page.njk',
  eyebrow: '', status: '', summary: '', works: [], facts: [], gallery: [], result: null,
  eleventyComputed: { permalink: data => `experiences/${data.id}/index.html` },
};
