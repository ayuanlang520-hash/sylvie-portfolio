const builtins = new Set(['projects', 'experience', 'more', 'path', 'together', 'contact']);

export function sectionId(item) {
  if (item.key !== 'custom') {
    if (!builtins.has(item.key)) throw new Error(`未知的首页板块：${item.key}`);
    return item.key;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id ?? '')) throw new Error('自定义板块的网址名称须使用小写字母、数字或短横线。');
  return `section-${item.id}`;
}

export function validateSections(settings) {
  if (!Array.isArray(settings?.items)) throw new Error('首页板块列表缺失。');
  const ids = settings.items.map(sectionId);
  if (new Set(ids).size !== ids.length) throw new Error('首页板块重复，请为每个自定义板块使用不同的网址名称。');
  return settings.items;
}

export function sectionEnabled(settings, key) {
  return validateSections(settings).some(item => sectionId(item) === key && item.visible !== false);
}

export function sectionNavigation(settings) {
  return validateSections(settings).filter(item => item.visible !== false && item.inNavigation)
    .map(item => ({ label: item.navigationLabel || item.title, href: `#${sectionId(item)}` }));
}

export function anchorVisible(href, settings) {
  return !href.startsWith('#') || href === '#top' || sectionEnabled(settings, href.slice(1));
}
