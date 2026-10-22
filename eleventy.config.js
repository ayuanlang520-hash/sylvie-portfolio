import MarkdownIt from 'markdown-it';
import path from 'node:path';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

export default function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true, throwOnUndefined: true });
  eleventyConfig.setLibrary('md', markdown);
  eleventyConfig.addFilter('detailSections', html => html.trim().split(/(?=<h4>)/)
    .filter(Boolean).map(section => `<div>${section.trim()}</div>`).join('\n'));
  eleventyConfig.addFilter('linkHref', value => {
    if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error('链接必须是非空文字，且不能包含控制字符。');
    }
    const parsed = new URL(value, 'https://portfolio.invalid/sylvie-portfolio/');
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      throw new Error(`不支持的链接协议：${parsed.protocol}`);
    }
    return value;
  });
  eleventyConfig.addFilter('projectById', (projects, id) => {
    const project = projects.find(item => item.data.id === id);
    if (!project) throw new Error(`没有找到作品：${id}`);
    return project;
  });
  eleventyConfig.addCollection('projects', collection => collection.getFilteredByTag('projects')
    .sort((first, second) => first.data.order - second.data.order));
  eleventyConfig.addCollection('caseStudies', collection => collection.getFilteredByTag('caseStudies')
    .sort((first, second) => first.data.order - second.data.order));
  for (const name of ['portfolioEntries', 'experienceEntries', 'noteEntries']) {
    eleventyConfig.addCollection(name, collection => collection.getFilteredByTag(name)
      .sort((first, second) => (first.data.order ?? 0) - (second.data.order ?? 0)));
  }
  eleventyConfig.addTransform('cms-media-paths', function (content) {
    if (typeof this.page.outputPath !== 'string' || !this.page.outputPath.endsWith('.html')) return content;
    const pageDirectory = this.page.url.endsWith('/') ? this.page.url : path.posix.dirname(this.page.url);
    const relativeAssets = path.posix.relative(pageDirectory, '/assets');
    return content.replace(/\b(href|src|poster)="\/?assets\/([^\"]+)"/g, (_, attribute, file) => `${attribute}="${relativeAssets}/${file}"`);
  });
  for (const path of ['assets', 'styles.css', 'stage2.css', 'beichen.css', 'script.js', '.nojekyll']) {
    eleventyConfig.addPassthroughCopy({ [path]: path });
  }
  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    templateFormats: ['njk', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: false,
  };
}
