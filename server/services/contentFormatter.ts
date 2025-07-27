// Content formatter for AI-generated notes
// Enhances markdown formatting, readability, and professional appearance

export function formatAIContent(content: string, contentType: string): string {
  let formattedContent = content;

  // Clean up any existing formatting issues
  formattedContent = formattedContent
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .replace(/\*\*([^*]+)\*\*/g, '**$1**') // Normalize bold formatting
    .replace(/(?<!#)##(?!#)/g, '\n## ') // Ensure proper spacing before h2
    .replace(/(?<!#)###(?!#)/g, '\n### ') // Ensure proper spacing before h3
    .trim();

  switch (contentType) {
    case 'study_guide':
      return formatStudyGuide(formattedContent);
    case 'briefing_doc':
      return formatBriefingDoc(formattedContent);
    case 'faq':
      return formatFAQ(formattedContent);
    case 'timeline':
      return formatTimeline(formattedContent);
    default:
      return formattedContent;
  }
}

function formatStudyGuide(content: string): string {
  return content
    .replace(/^# Study Guide/m, '# 📚 Study Guide\n\n---')
    .replace(/^## Key Topics/m, '\n## 🎯 Key Topics')
    .replace(/^## Important Concepts/m, '\n## 💡 Important Concepts')
    .replace(/^## Summary Points/m, '\n## 📝 Summary Points')
    .replace(/^### ([^#\n]+)/gm, '\n### 🔹 $1')
    .replace(/^- ([^-\n]+)/gm, '  • $1')
    .replace(/\n{3,}/g, '\n\n');
}

function formatBriefingDoc(content: string): string {
  return content
    .replace(/^# Executive Briefing/m, '# 📊 Executive Briefing\n\n---')
    .replace(/^## Executive Summary/m, '\n## 🎯 Executive Summary')
    .replace(/^## Key Insights/m, '\n## 💡 Key Insights')
    .replace(/^## Actionable Recommendations/m, '\n## ⚡ Actionable Recommendations')
    .replace(/^## Conclusion/m, '\n## 🎯 Conclusion')
    .replace(/^### ([^#\n]+)/gm, '\n### 🔸 $1')
    .replace(/^- ([^-\n]+)/gm, '  • $1')
    .replace(/^(\d+)\. ([^.\n]+)/gm, '**$1.** $2')
    .replace(/\n{3,}/g, '\n\n');
}

function formatFAQ(content: string): string {
  return content
    .replace(/^# Frequently Asked Questions/m, '# ❓ Frequently Asked Questions\n\n---')
    .replace(/^## General Questions/m, '\n## 🌟 General Questions')
    .replace(/^## Technical Questions/m, '\n## ⚙️ Technical Questions')
    .replace(/^## Additional Questions/m, '\n## 💭 Additional Questions')
    .replace(/^\*\*Q: ([^*]+)\*\*/gm, '\n**❓ Q: $1**')
    .replace(/^A: ([^A\n]+)/gm, '**💡 A:** $1')
    .replace(/\n{3,}/g, '\n\n');
}

function formatTimeline(content: string): string {
  return content
    .replace(/^# Timeline/m, '# ⏰ Timeline\n\n---')
    .replace(/^## ([^#\n]+)/gm, '\n## 📅 $1')
    .replace(/^- \*\*Event\*\*: ([^*\n]+)/gm, '  🔸 **Event:** $1')
    .replace(/^- \*\*Significance\*\*: ([^*\n]+)/gm, '  🎯 **Significance:** $1')
    .replace(/^- ([^-\n]+)/gm, '  • $1')
    .replace(/\n{3,}/g, '\n\n');
}

export function enhanceMarkdownFormatting(content: string): string {
  return content
    // Improve bullet point formatting
    .replace(/^(\s*)[-*+] /gm, '$1• ')
    
    // Ensure proper spacing around headers
    .replace(/^(#{1,6})\s*([^\n]+)/gm, (match, hashes, title) => {
      const level = hashes.length;
      const spacing = level === 1 ? '\n' : '';
      return `${spacing}${hashes} ${title.trim()}`;
    })
    
    // Format numbered lists consistently  
    .replace(/^(\s*)(\d+)\.\s*/gm, '$1**$2.** ')
    
    // Clean up excessive whitespace but preserve intentional spacing
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+$/gm, '') // Remove trailing spaces
    .trim();
}