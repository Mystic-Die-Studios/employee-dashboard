import { useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiUrl } from "../api/config";

// Exactly the relative URL the wiki image upload returns. Anything else (full URLs,
// protocol-relative "//host", extra path segments, "..") is treated as external.
const WIKI_IMAGE_PATH = /^\/api\/v1\/workspace\/documents\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/$/i;

function isWikiImage(src) {
  return typeof src === "string" && WIKI_IMAGE_PATH.test(src);
}

function ImageLabel({ alt }) {
  return <span className="markdown-image">Image: {alt || "attachment"}</span>;
}

// Falls back to the label if the image cannot load: file deleted, session
// expired, or the demo preview (no server).
function WikiImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ImageLabel alt={alt} />;
  return <img className="wiki-image" src={apiUrl(src)} alt={alt || "Wiki image"} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

export default function MarkdownPreview({ children }) {
  return (
    <div className="markdown-preview" aria-label="Markdown preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={defaultUrlTransform}
        components={{
          // Remote image requests can disclose that a member opened a private page.
          // Only app-hosted wiki images load (served to signed-in members by our own API);
          // every other image stays a readable label and is never fetched.
          img: ({ src, alt }) => isWikiImage(src)
            ? <WikiImage key={src} src={src} alt={alt} />
            : <ImageLabel alt={alt} />,
          a: ({ href, children }) => <a href={href} rel="noreferrer noopener">{children}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
