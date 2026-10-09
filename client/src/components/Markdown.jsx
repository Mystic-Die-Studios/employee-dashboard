import { lazy, Suspense } from "react";

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

export default function Markdown({ children }) {
  return <Suspense fallback={<p className="form-hint" role="status">Loading Markdown preview…</p>}>
    <MarkdownPreview>{children}</MarkdownPreview>
  </Suspense>;
}
