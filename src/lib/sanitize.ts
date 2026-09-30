/**
 * Sanitizes HTML content to prevent XSS attacks
 * Allows only safe HTML tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Create a temporary element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Define allowed tags
  const allowedTags = [
    'p', 'br', 'b', 'i', 'u', 'strong', 'em', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'span', 'div',
    'blockquote', 'pre', 'code'
  ];

  // Define allowed attributes per tag (style removed for security)
  const allowedAttributes: Record<string, string[]> = {
    'a': ['href', 'target', 'rel'],
    'span': ['class'],
    'div': ['class'],
    'p': ['class'],
    '*': ['class']
  };

  function sanitizeNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Remove script and style tags completely
      if (tagName === 'script' || tagName === 'style') {
        element.remove();
        return;
      }

      // Check if tag is allowed
      if (!allowedTags.includes(tagName)) {
        // Replace with a span containing the text content
        const text = document.createTextNode(element.textContent || '');
        element.parentNode?.replaceChild(text, element);
        return;
      }

      // Remove disallowed attributes
      const allowedForTag = [
        ...(allowedAttributes[tagName] || []),
        ...(allowedAttributes['*'] || [])
      ];

      const attributesToRemove: string[] = [];
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (!allowedForTag.includes(attr.name)) {
          attributesToRemove.push(attr.name);
        }
        // Remove javascript: URLs
        if (attr.name === 'href' && attr.value.toLowerCase().trim().startsWith('javascript:')) {
          attributesToRemove.push(attr.name);
        }
        // Remove data: URLs in href
        if (attr.name === 'href' && attr.value.toLowerCase().trim().startsWith('data:')) {
          attributesToRemove.push(attr.name);
        }
        // Remove event handlers
        if (attr.name.startsWith('on')) {
          attributesToRemove.push(attr.name);
        }
      }

      attributesToRemove.forEach(attr => element.removeAttribute(attr));

      // Recursively sanitize children
      Array.from(element.childNodes).forEach(child => sanitizeNode(child));
    }
  }

  // Sanitize all nodes
  Array.from(tempDiv.childNodes).forEach(node => sanitizeNode(node));

  return tempDiv.innerHTML;
}

/**
 * Strips all HTML tags from a string
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}

/**
 * Truncates HTML content to a specified length while preserving tags
 */
export function truncateHtml(html: string, maxLength: number): string {
  if (!html) return '';
  
  const stripped = stripHtml(html);
  if (stripped.length <= maxLength) return html;
  
  return stripped.slice(0, maxLength) + '...';
}
