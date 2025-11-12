/**
 * Simple markdown to HTML converter for basic formatting
 * Handles bold (**text**), italic (*text*), and Japanese emphasis 【text】
 */
export function parseMarkdown(text: string): string {
  if (!text) return text;
  
  // Convert 【emphasis】 to <strong>emphasis</strong> (Japanese emphasis brackets)
  text = text.replace(/【([^】]+)】/g, '<strong>$1</strong>');
  
  // Convert **bold** to <strong>bold</strong>
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>italic</em> (but not ** which was already handled)
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  return text;
}

/**
 * Component-friendly version that returns JSX-safe HTML
 */
export function renderMarkdown(text: string): { __html: string } {
  return { __html: parseMarkdown(text) };
}
