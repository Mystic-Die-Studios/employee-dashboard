import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownPreview({ children }) {
  return (
    <div className="markdown-preview" aria-label="Markdown preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={defaultUrlTransform}
        components={{
          // Remote image requests can disclose that a member opened a private page.
          // Keep image references readable without fetching untrusted external media.
          img: ({ alt }) => <span className="markdown-image">Image: {alt || "attachment"}</span>,
          a: ({ href, children }) => <a href={href} rel="noreferrer noopener">{children}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
