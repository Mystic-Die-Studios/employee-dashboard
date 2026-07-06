import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// Renders sanitized Markdown with GitHub-flavored extras (tables, task lists, strikethrough).
// rehype-sanitize strips any raw HTML/scripts; styling comes from `.prose-wiki` in index.css.
export default function Markdown({ children }) {
  return (
    <div className="prose-wiki">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
