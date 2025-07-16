// 全局作用域定义 processedImageIds 和 processedElements
const processedImageIds = new Set<string>();
const processedElements = new Set<string>();
const processedTextNodes = new Set<Text>(); // 新增：用于记录已处理的文本节点

const FONT_MAPPING: Record<string, string> = {
  'PingFangSC-Regular': 'PingFang SC',
  'FZLanTingHeiS-DB-GB': 'FZLanTingHeiS',
  'Microsoft YaHei': 'Microsoft YaHei UI'
};

const FONT_WEIGHT_MAPPING: Record<string, number> = {
  'bold': 700,
  'normal': 400,
  'lighter': 300
};

function generateUUID() {
  return Math.random().toString(36).slice(2, 11);
}

// 新增获取元素 DOM 路径的函数
function getElementPath(element: Element): string {
  const path: string[] = [];
  let currentElement: Element | null = element;
  while (currentElement && currentElement !== document.documentElement) {
    let index = 0;
    let sibling = currentElement.previousElementSibling;
    while (sibling) {
      index++;
      sibling = sibling.previousElementSibling;
    }
    path.unshift(`${currentElement.tagName.toLowerCase()}:nth-child(${index + 1})`);
    currentElement = currentElement.parentElement;
  }
  return path.join(' > ');
}

function getBase64Image(img: HTMLImageElement): string {
  if (!img.complete || img.naturalWidth === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  try {
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL();
  } catch (e) {
    return ''; // 跨域图片无法转换
  }
}

// 修改获取背景图片 URL 的函数，兼容 background 属性
function getBackgroundImageUrl(style: CSSStyleDeclaration): string | null {
  const urlRegex = /url\(['"]?([^'")]+)['"]?\)/;

  // 先尝试从 background-image 属性获取
  let backgroundImage = style.backgroundImage;
  if (backgroundImage && backgroundImage !== 'none') {
    const match = backgroundImage.match(urlRegex);
    if (match) {
      return match[1];
    }
  }

  // 若 background-image 未获取到，再尝试从 background 属性获取
  backgroundImage = style.background;
  if (backgroundImage) {
    const match = backgroundImage.match(urlRegex);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// 将相对路径转换为绝对路径
function getAbsoluteUrl(relativeUrl: string): string {
  // 新增：判断是否为 Base64 格式，若是则直接返回
  if (relativeUrl.startsWith('data:')) {
    return relativeUrl;
  }
  const baseUrl = window.location.origin;
  if (relativeUrl.startsWith('//')) {
    return `${window.location.protocol}${relativeUrl}`;
  } else if (relativeUrl.startsWith('/')) {
    return `${baseUrl}${relativeUrl}`;
  } else if (!relativeUrl.startsWith('http')) {
    const currentPath = window.location.pathname;
    const lastSlashIndex = currentPath.lastIndexOf('/');
    const basePath = currentPath.slice(0, lastSlashIndex + 1);
    return `${baseUrl}${basePath}${relativeUrl}`;
  }
  return relativeUrl;
}

// 修改元素可见性判断函数
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  // 检查元素是否有宽高，且不是隐藏状态
  const isVisible = style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    parseFloat(style.opacity) > 0 &&
    (rect.width > 0 || rect.height > 0);

  // 检查父元素是否可见
  let parent = element.parentElement;
  while (parent) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parseFloat(parentStyle.opacity) <= 0) {
      return false;
    }
    parent = parent.parentElement;
  }

  return isVisible;
}

function getLayoutMode(element: Element): 'NONE' | 'HORIZONTAL' | 'VERTICAL' {
  const style = window.getComputedStyle(element);
  return style.display === 'flex' && style.flexDirection === 'column'
    ? 'VERTICAL'
    : style.display === 'flex'
      ? 'HORIZONTAL'
      : 'NONE';
}

function parseColor(colorStr: string) {
  if (colorStr === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const rgba = colorStr.match(/\d+\.?\d*/g) || ['0', '0', '0', '1'];
  return {
    r: parseFloat(rgba[0]) / 255,
    g: parseFloat(rgba[1]) / 255,
    b: parseFloat(rgba[2]) / 255,
    a: rgba[3] ? parseFloat(rgba[3]) : 1
  };
}

// 定义节点类型
type NodeType = {
  id: string;
  name: string;
  type: 'FRAME' | 'IMAGE' | 'TEXT';
  visible: boolean;
  absoluteBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  constraints: {
    horizontal: 'SCALE';
    vertical: 'SCALE';
  };
  fills: {
    type: 'SOLID' | 'IMAGE';
    color?: { r: number; g: number; b: number; a: number };
    opacity?: number;
    url?: string;
    scaleMode?: 'FILL';
    width?: number;
    height?: number;
    imageDesc?: string;
  }[];
  children: NodeType[];
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  characters?: string;
  style?: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: {
      unit: 'PIXELS';
      value: number;
    };
    color: { r: number; g: number; b: number; a: number };
  };
  cornerRadius?: number;
  strokes?: {
    type: 'SOLID';
    color: { r: number; g: number; b: number; a: number };
    opacity: number;
    width: number;
    style: 'SOLID' | 'DASHED' | 'DOTTED';
  }[];
  shadows?: {
    type: 'DROP_SHADOW';
    color: { r: number; g: number; b: number; a: number };
    offset: { x: number; y: number };
    radius: number;
  }[];
  opacity?: number;
};

// 定义类型守卫函数
function isNodeType(value: NodeType | null): value is NodeType {
  return value !== null;
}

const sanitize = (num: number) => Math.round(num);

// 将 convertElement 函数改为异步函数
async function convertElement(element: Element): Promise<NodeType | null> {
  // 直接排除 title 标签
  if (element.tagName === 'TITLE') {
    return null;
  }

  const elementPath = getElementPath(element);
  if (processedElements.has(elementPath)) {
    return null;
  }
  processedElements.add(elementPath);

  if (!element.isConnected) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  // 提取边框信息
  const borderWidth = parseFloat(style.borderWidth);
  const borderColor = parseColor(style.borderColor);
  const borderStyle = style.borderStyle as 'SOLID' | 'DASHED' | 'DOTTED';

  // 提取阴影信息
  const shadows: NodeType['shadows'] = [];
  const boxShadowValue = style.boxShadow;
  if (boxShadowValue && boxShadowValue!== 'none') {
    const shadowParts = boxShadowValue.split(/,\s*(?![^()]*\))/);
    shadowParts.forEach(part => {
      const values = part.trim().split(/\s+/);
      const colorMatch = part.match(/rgba?\([^)]+\)/);
      const color = colorMatch? parseColor(colorMatch[0]) : { r: 0, g: 0, b: 0, a: 1 };
      const offsetX = parseFloat(values[0]);
      const offsetY = parseFloat(values[1]);
      const radius = values.length > 2? parseFloat(values[2]) : 0;
      shadows.push({
        type: 'DROP_SHADOW',
        color,
        offset: { x: offsetX, y: offsetY },
        radius
      });
    });
  }

  // 提取 border-radius 信息
  const borderRadius = parseFloat(style.borderRadius);

  const baseNode: NodeType = {
    id: element.id || `auto-${generateUUID()}`,
    name: element.tagName.toLowerCase(),
    type: 'FRAME',
    visible: isElementVisible(element),
    absoluteBoundingBox: {
      x: sanitize(rect.left),
      y: sanitize(rect.top),
      width: sanitize(rect.width),
      height: sanitize(rect.height)
    },
    constraints: {
      horizontal: 'SCALE',
      vertical: 'SCALE'
    },
    fills: style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? [{
      type: 'SOLID',
      color: parseColor(style.backgroundColor),
      opacity: parseFloat(style.opacity)
    }] : [],
    children: [],
    cornerRadius: isNaN(borderRadius)? undefined : borderRadius,
    strokes: borderWidth > 0? [{
      type: 'SOLID',
      color: borderColor,
      opacity: parseFloat(style.opacity),
      width: borderWidth,
      style: borderStyle
    }] : [],
    shadows,
    opacity: parseFloat(style.opacity),
    style: {
      fontFamily: style.fontFamily.replace(/["']/g, '').split(',')[0].trim(),
      fontWeight: FONT_WEIGHT_MAPPING[style.fontWeight] || parseInt(style.fontWeight, 10),
      fontSize: parseFloat(style.fontSize),
      lineHeight: {
        unit: 'PIXELS',
        value: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
      },
      color: parseColor(style.color)
    }
  };

  // 处理 HTMLImageElement
  if (element instanceof HTMLImageElement && element.naturalWidth > 0) {
    const isLocalImage = !/^(https?:)?\/\//.test(element.src);
    const imageUrl = isLocalImage? getBase64Image(element) : element.src;

    const uniqueId = element.src.split('/').pop()?.split('?')[0] || generateUUID();
    const imageId = `${element.id || `img-${uniqueId}`}-${elementPath}`;

    if (processedImageIds.has(imageId)) {
      return baseNode;
    }
    processedImageIds.add(imageId);

    return {
      ...baseNode,
      id: imageId,
      type: 'IMAGE',
      name: 'image',
      absoluteBoundingBox: {
        ...baseNode.absoluteBoundingBox,
        width: element.naturalWidth,
        height: element.naturalHeight
      },
      fills: [{
        url: imageUrl,
        type: 'IMAGE',
        scaleMode: 'FILL',
        width: element.naturalWidth,
        height: element.naturalHeight,
        imageDesc: element.alt || `image-${generateUUID()}`
      }]
    };
  }

  // 处理背景图片
  const backgroundImageUrl = getBackgroundImageUrl(style);
  if (backgroundImageUrl) {
    const absoluteUrl = getAbsoluteUrl(backgroundImageUrl);
    const isLocalImage = !/^(https?:)?\/\//.test(absoluteUrl);
    let imageUrl = absoluteUrl;

    if (isLocalImage) {
      const img = new Image();
      img.src = absoluteUrl;
      if (!img.complete) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }
      imageUrl = getBase64Image(img);
    }

    const uniqueId = absoluteUrl.split('/').pop()?.split('?')[0] || generateUUID();
    const imageId = `bg-img-${uniqueId}-${elementPath}`;

    if (processedImageIds.has(imageId)) {
      return baseNode;
    }
    processedImageIds.add(imageId);

    return {
      ...baseNode,
      id: imageId,
      type: 'IMAGE',
      name: 'background-image',
      absoluteBoundingBox: {
        ...baseNode.absoluteBoundingBox,
        width: sanitize(rect.width),
        height: sanitize(rect.height)
      },
      fills: [{
        url: imageUrl,
        type: 'IMAGE',
        scaleMode: 'FILL',
        width: sanitize(rect.width),
        height: sanitize(rect.height),
        imageDesc: `background-image-${generateUUID()}`
      }]
    };
  }

  // 处理文本内容
  const processTextNodes = (node: Node) => {
    // 检查 node 是否为 Element 类型，再调用 closest 方法
    if (node instanceof Element && node.closest('title')) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (processedTextNodes.has(textNode)) {
        return;
      }
      processedTextNodes.add(textNode);

      const characters = textNode.textContent?.trim();
      // 过滤空文本和 HTML 注释
      if (characters &&!characters.startsWith('<!--')) {
        // 使用父元素的样式
        const parentElement = textNode.parentElement;
        if (parentElement) {
          const style = window.getComputedStyle(parentElement);
          const fontFamily = style.fontFamily.replace(/["']/g, '').split(',')[0].trim().replace(/(SC|GB)/g, ' ').trim();

          const textNodeObj: NodeType = {
            ...baseNode,
            id: `${baseNode.id}-text-${generateUUID()}`,
            type: 'TEXT',
            name: 'text', // 明确文本节点名称
            characters,
            style: {
              fontFamily: FONT_MAPPING[fontFamily] || fontFamily,
              fontWeight: FONT_WEIGHT_MAPPING[style.fontWeight] || 400,
              fontSize: sanitize(parseFloat(style.fontSize)),
              lineHeight: {
                unit: 'PIXELS',
                value: parseFloat(style.lineHeight) || sanitize(parseFloat(style.fontSize) * 1.2)
              },
              color: parseColor(style.color)
            },
            fills: [{
              type: 'SOLID',
              color: parseColor(style.color),
              opacity: 1
            }],
            children: []
          };
          baseNode.children.push(textNodeObj);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childElement = node as Element;
      // 跳过不需要处理的元素类型
      const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'SVG', 'TITLE'];
      if (!skipTags.includes(childElement.tagName)) {
        childElement.childNodes.forEach(processTextNodes);
      }
    }
  };

  element.childNodes.forEach(processTextNodes);

  if (baseNode.children.length > 0) {
    return baseNode;
  }

  // 处理子元素时，排除 title 相关内容
  if (element.children.length > 0) {
    const childrenPromises = Array.from(element.children).filter(child => child.tagName!== 'TITLE').map(convertElement);
    const children = await Promise.all(childrenPromises);
    return {
      ...baseNode,
      type: 'FRAME',
      layoutMode: getLayoutMode(element),
      itemSpacing: sanitize(parseFloat(style.gap)),
      children: children.filter(isNodeType)
    };
  }

  return baseNode;
}

// 修改顶层过滤逻辑，使用 async 包裹
(async () => {
  try {
    const filteredElements = Array.from(document.querySelectorAll('*')).filter(node => {
      const tag = node.tagName;
      const isHidden = node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true';
      const isValidTag =!['SCRIPT', 'STYLE', 'META', 'LINK', 'SVG', 'TITLE'].includes(tag);

      const style = window.getComputedStyle(node);
      const isVisible = style.display!== 'none' &&
        style.visibility!== 'hidden' &&
        parseFloat(style.opacity) > 0 &&
        (node.getClientRects().length > 0);

      const hasTextContent = (() => {
        if (node.closest('title')) {
          return false;
        }
        return node.textContent?.trim() || 
          Array.from(node.childNodes).some(child => {
            if (child.parentElement?.closest('title')) {
              return false;
            }
            return child.textContent?.trim();
          });
      })();

      const isBackgroundImage = getBackgroundImageUrl(style)!== null;

      return isValidTag && isVisible &&!isHidden && (hasTextContent || isBackgroundImage);
    });

    const convertPromises = filteredElements.map(convertElement);
    const convertedElements = await Promise.all(convertPromises);

    const figmaDoc = {
      document: {
        type: "DOCUMENT",
        id: "root",
        name: "Converted Page",
        children: convertedElements.filter(isNodeType)
      },
      schemaVersion: 0
    };

    const blob = new Blob([JSON.stringify(figmaDoc, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    // 获取当前页面的 title，同时处理可能包含非法文件名的字符
    const pageTitle = document.title.replace(/[\\/:"*?<>|]/g, '_');
    // 新增：将时间戳转换为 yyyy-mm-dd 格式
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    link.download = `${pageTitle}-${formattedDate}.json`;

    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 100);

  } catch (error: unknown) {
    console.error('[Figma导出] 失败:', error);
    if (error instanceof Error) {
      alert(`导出失败: ${error.message}`);
    } else {
      alert('发生未知错误');
    }
  }
})();