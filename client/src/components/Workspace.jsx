import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createDocument,
  createTask,
  deleteDocument,
  loadWorkspace,
  saveDocument,
  saveTask,
  uploadDocumentImage,
  WIKI_IMAGE_ACCEPT,
  WIKI_IMAGE_MAX_BYTES,
  workspaceError,
} from "../api/workspace";
import MarkdownPreview from "./Markdown";
import Reviews from "./Reviews";
import "./Workspace.css";

const initialDocuments = [
  {
    id: "welcome",
    title: "Welcome to Mystic Die",
    category: "Getting started",
    icon: "✦",
    updated: "Just now",
    body: "# Welcome\n\n- Projects: tasks by status\n- Documents: the team wiki\n- My tasks: tasks assigned to you\n- Reviews: art feedback\n- Team: who is here",
  },
  {
    id: "direction",
    title: "Creative direction",
    category: "Project Reconnection",
    icon: "◈",
    updated: "Today",
    body: "# Project Reconnection\n\nVisual references, story ideas, and creative decisions.",
  },
  {
    id: "onboarding",
    title: "Team onboarding",
    category: "Studio wiki",
    icon: "☀",
    updated: "Yesterday",
    body: "# Your first week\n\n- Meet your teammates.\n- Get access to the project repository.\n- Read the creative direction.\n- Pick a small first task with your lead.",
  },
  {
    id: "notes",
    title: "Weekly studio notes",
    category: "Studio wiki",
    icon: "≋",
    updated: "Yesterday",
    body: "# Weekly check-in\n\n## What moved forward?\n\n## What did we learn?\n\n## Where do we need a hand?\n\n## Next steps",
  },
];
const initialTasks = [
  {
    id: "1",
    title: "Collect environment references",
    project: "Project Reconnection",
    status: "To do",
    priority: "Medium",
    person: "You",
  },
  {
    id: "2",
    title: "Sketch the opening sequence",
    project: "Project Reconnection",
    status: "In progress",
    priority: "High",
    person: "You",
  },
  {
    id: "3",
    title: "Review character silhouettes",
    project: "Project Reconnection",
    status: "In progress",
    priority: "Medium",
    person: "Team",
  },
  {
    id: "4",
    title: "Set up the studio workspace",
    project: "Studio operations",
    status: "Done",
    priority: "Low",
    person: "You",
  },
  {
    id: "5",
    title: "Write the playtest checklist",
    project: "Project Reconnection",
    status: "To do",
    priority: "High",
    person: "Team",
  },
];
const statuses = ["To do", "In progress", "Done"];
const views = ["Home", "Projects", "Documents", "My tasks", "Reviews", "Team"];
const emptyWorkspace = { documents: [], tasks: [], reviews: [], members: [] };
const previewMembers = [
  { id: "demo", github_username: "Demo artist", role: "employee" },
  { id: "lead", github_username: "Demo review lead", role: "admin" },
];
const previewReviews = [{
  id: "demo-review",
  ticket: "ART-DEMO-001",
  title: "Forest gate · environment concept",
  project: "Project Reconnection",
  description: "## Ready for a first look\n\nReview the silhouette, lighting, and sense of discovery.\n\n- [x] First concept pass\n- [ ] Gather feedback\n- [ ] Refine the composition",
  file_name: "forest-gate-concept.png",
  file_size: 1450000,
  author: { id: "demo", github_username: "Demo artist" },
  status: "changes_requested",
  github_sync_status: "not_configured",
  github_issue_url: null,
  created_at: "2026-10-09T16:00:00Z",
  feedback: [{ id: "demo-feedback", body: "Strong atmosphere. Give the entrance a little more contrast so the player knows where to go.", decision: "changes_requested", author: { id: "lead", github_username: "Demo review lead" }, created_at: "2026-10-09T17:00:00Z" }],
  can_review: false,
  can_sync: false,
}];

// "Map Sketch.png" -> "![Map Sketch](url)". Brackets and backslashes would break the alt text.
function imageMarkdown(fileName, url) {
  const alt = fileName.replace(/\.[^.]+$/, "").replace(/[[\]\\]/g, "").trim() || "image";
  return `![${alt}](${url})`;
}

// Card preview: the first two lines of a page as plain text. Images are dropped, links keep
// their text, and Markdown symbols (headings, lists, checkboxes, quotes, emphasis, code) go.
function documentExcerpt(body) {
  return (body || "")
    .replace(/```[\s\S]*?(```|$)/g, "\n")
    .split("\n")
    .map((line) => line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s*(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/, "")
      .replace(/^\s*([-*_]\s*){3,}$/, "")
      .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/, "")
      .replace(/(\*\*|__|~~|`)/g, "")
      .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?=[^\w*]|$)/g, "$1$2")
      .replace(/(^|\W)_(?!\s)([^_]+?)_(?=\W|$)/g, "$1$2")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ")
    .slice(0, 100);
}

// Line-based formats: the marker each one adds, and the pattern that recognizes it.
const LINE_FORMATS = {
  heading: { prefix: () => "## ", pattern: /^#{1,6}\s+/ },
  quote: { prefix: () => "> ", pattern: /^>\s?/ },
  bullets: { prefix: () => "- ", pattern: /^[-*+]\s+(?!\[[ xX]\]\s)/, list: true },
  numbers: { prefix: (i) => `${i + 1}. `, pattern: /^\d+[.)]\s+/, list: true },
  checklist: { prefix: () => "- [ ] ", pattern: /^[-*+]\s+\[[ xX]\]\s+/, list: true },
};
const ANY_LIST_MARKER = /^([-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/;
const WRAP_FORMATS = { bold: ["**", "bold text"], italic: ["_", "italic text"], code: ["`", "code"] };

// Works out one toolbar edit: replace value[from, to) with `text`, then select
// [selectStart, selectEnd). Pure, so it can be tested without a browser.
function formatMarkdown(action, value, start, end) {
  const selected = value.slice(start, end);
  if (action === "code" && selected.includes("\n")) {
    const block = `\`\`\`\n${selected.replace(/\n$/, "")}\n\`\`\``;
    return padBlock(value, start, end, block, 4, 4 + selected.replace(/\n$/, "").length);
  }
  if (WRAP_FORMATS[action]) {
    const [marker, placeholder] = WRAP_FORMATS[action];
    const m = marker.length;
    // Keep markers next to the words: "**word** " not "**word **".
    const lead = selected.length - selected.trimStart().length;
    const trail = selected.length - selected.trimEnd().length;
    const from = selected.trim() ? start + lead : start;
    const to = selected.trim() ? end - trail : end;
    const inner = value.slice(from, to);
    if (inner.length >= 2 * m && inner.startsWith(marker) && inner.endsWith(marker)) {
      const text = inner.slice(m, -m);
      return { from, to, text, selectStart: from, selectEnd: from + text.length };
    }
    if (from >= m && value.slice(from - m, from) === marker && value.slice(to, to + m) === marker) {
      return { from: from - m, to: to + m, text: inner, selectStart: from - m, selectEnd: from - m + inner.length };
    }
    const text = inner || placeholder;
    return { from, to, text: `${marker}${text}${marker}`, selectStart: from + m, selectEnd: from + m + text.length };
  }
  if (action === "link") {
    if (/^https?:\/\/\S+$/.test(selected.trim())) {
      return { from: start, to: end, text: `[link text](${selected.trim()})`, selectStart: start + 1, selectEnd: start + 10 };
    }
    const label = selected || "link text";
    const text = `[${label}](https://)`;
    return { from: start, to: end, text, selectStart: start + label.length + 3, selectEnd: start + text.length - 1 };
  }
  const format = LINE_FORMATS[action];
  if (!format) return null;
  // Whole lines touched by the selection; a selection ending at a line start skips that line.
  const lastChar = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", lastChar);
  const to = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(from, to).split("\n");
  const filled = lines.filter((line) => line.trim());
  const remove = filled.length > 0 && filled.every((line) => format.pattern.test(line));
  let count = 0;
  const changed = lines.map((line) => {
    if (remove) return line.replace(format.pattern, "");
    if (!line.trim() && lines.length > 1) return line;
    const bare = format.list ? line.replace(ANY_LIST_MARKER, "") : line.replace(format.pattern, "");
    return format.prefix(count++) + bare;
  });
  const text = changed.join("\n");
  if (start === end && lines.length === 1) {
    const cursor = Math.max(from, start + (changed[0].length - lines[0].length));
    return { from, to, text, selectStart: cursor, selectEnd: cursor };
  }
  return { from, to, text, selectStart: from, selectEnd: from + text.length };
}

// Puts block content (images, code blocks) on its own lines, adding line breaks only where needed.
function padBlock(value, start, end, block, innerStart = block.length, innerEnd = block.length) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  const trail = after && !after.startsWith("\n") ? "\n" : "";
  return { from: start, to: end, text: `${lead}${block}${trail}`, selectStart: start + lead.length + innerStart, selectEnd: start + lead.length + innerEnd };
}

const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
const TOOLBAR = [
  ["bold", "Bold", `${MOD_KEY}B`],
  ["italic", "Italic", `${MOD_KEY}I`],
  ["heading", "Heading"],
  ["link", "Link", `${MOD_KEY}K`],
  ["bullets", "Bulleted list"],
  ["numbers", "Numbered list"],
  ["checklist", "Checklist"],
  ["code", "Code"],
  ["quote", "Quote"],
];
const SHORTCUTS = { b: "bold", i: "italic", k: "link" };

// Pages created outside the editor get the model's default icon name ("file-text"),
// which would show as text. Only show real symbols (one or two characters).
function pageIcon(icon) {
  return icon && Array.from(icon).length <= 2 ? icon : "▤";
}

// Guards against dropping a whole folder of files by accident.
const MAX_IMAGES_AT_ONCE = 10;

const PASTED_IMAGE_EXTENSIONS = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };

// Browsers name pasted screenshots "image.png" (or leave them unnamed), which would make
// the alt text "image" or fail the extension check. Name them from their image type.
function renamePastedImage(file) {
  const generic = !file.name || /^image(\.[a-z0-9]+)?$/i.test(file.name);
  const extension = PASTED_IMAGE_EXTENSIONS[file.type];
  return generic && extension ? new File([file], `Pasted image${extension}`, { type: file.type, lastModified: file.lastModified }) : file;
}

// Quick browser-side check; the server re-checks every upload.
function imageFileProblem(file) {
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop().toLowerCase()}` : "";
  if (!WIKI_IMAGE_ACCEPT.split(",").includes(extension)) return "Upload an image: PNG, JPEG, WebP, or GIF.";
  if (file.size > WIKI_IMAGE_MAX_BYTES) return `The image exceeds the ${WIKI_IMAGE_MAX_BYTES / (1024 * 1024)} MB limit.`;
  return "";
}

function Icon({ name, size = 20 }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    project: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16m6-16v16" />
      </>
    ),
    document: (
      <>
        <path d="M14 3H5v18h14V8Z" />
        <path d="M14 3v5h5M8 12h8m-8 4h6" />
      </>
    ),
    task: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    bold: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7Zm0 7h7a3.5 3.5 0 0 1 0 7H7Z" />,
    italic: <path d="M10 5h8M6 19h8M14 5l-4 14" />,
    heading: <path d="M6 5v14M17 5v14M6 12h11" />,
    link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    bullets: <path d="M10 6h10M10 12h10M10 18h10M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
    numbers: <path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 0 1 3 .5L3.5 19h3" />,
    checklist: <path d="m3.5 6.5 1.5 1.5 3-3M3.5 16.5l1.5 1.5 3-3M11 7h9M11 17h9" />,
    code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />,
    quote: <path d="M5 5v14M9 8h10M9 12h10M9 16h7" />,
    image: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 16 5-5 4 4 2.5-2.5L21 18" />
        <circle cx="15.5" cy="9.5" r="1.5" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    logout: (
      <>
        <path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h13" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.document}
    </svg>
  );
}

function readWorkspace(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (
      Array.isArray(saved?.documents) &&
      Array.isArray(saved?.tasks) &&
      saved.documents.every(
        (d) =>
          typeof d.id === "string" &&
          typeof d.title === "string" &&
          typeof d.body === "string" &&
          typeof d.category === "string" &&
          typeof d.updated === "string",
      ) &&
      saved.tasks.every(
        (t) =>
          typeof t.id === "string" &&
          typeof t.title === "string" &&
          typeof t.project === "string" &&
          ["High", "Medium", "Low"].includes(t.priority) &&
          ["You", "Team"].includes(t.person) &&
          statuses.includes(t.status),
      )
    )
      return { ...saved, reviews: Array.isArray(saved.reviews) ? saved.reviews : previewReviews, members: previewMembers };
  } catch {
    /* Start with sample content when storage is unavailable. */
  }
  return { documents: initialDocuments, tasks: initialTasks, reviews: previewReviews, members: previewMembers };
}

function TaskDialog({ onClose, onSubmit, initialStatus, busy, error }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="task-modal"
      aria-labelledby="task-modal-title"
      onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!busy) onClose();
        }
      }}
    >
      <div className="section-heading">
        <h2 id="task-modal-title">New task</h2>
        <button onClick={onClose} disabled={busy} aria-label="Close task form">
          ✕
        </button>
      </div>
      <p>Add a task to your studio board.</p>
      <form onSubmit={onSubmit}>
        <fieldset disabled={busy}>
        <input type="hidden" name="status" value={initialStatus} />
        <label>
          Task name
          <input
            name="title"
            autoFocus
            required
            maxLength={160}
            placeholder="What needs to happen?"
          />
        </label>
        <label>
          Project
          <input name="project" required maxLength={120} defaultValue="Project Reconnection" placeholder="Project name" />
        </label>
        <label>
          Priority
          <select name="priority">
            <option>Medium</option>
            <option>High</option>
            <option>Low</option>
          </select>
        </label>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create task"} <Icon name="plus" size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Workspace({ user, onLogout, preview = false }) {
  const storageKey = "mystic-workspace-demo-v1:public";
  const [data, setData] = useState(() => preview ? readWorkspace(storageKey) : emptyWorkspace);
  const [searchParams, setSearchParams] = useSearchParams();
  const [demoNavigation, setDemoNavigation] = useState({ view: "Home", doc: null, review: null });
  const requestedView = preview ? demoNavigation.view : searchParams.get("view");
  const view = views.includes(requestedView) ? requestedView : "Home";
  const selectedId = view === "Documents" ? preview ? demoNavigation.doc : searchParams.get("doc") : null;
  const reviewId = view === "Reviews" ? preview ? demoNavigation.review : searchParams.get("review") : null;
  const [openTabs, setOpenTabs] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [conflicts, setConflicts] = useState({});
  const [editorMode, setEditorMode] = useState("Write");
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState("");
  const [taskError, setTaskError] = useState("");
  const [reviewForm, setReviewForm] = useState(false);
  const storageWarning = useRef(null);
  const bodyEditor = useRef(null);
  const pendingCursor = useRef(null);
  const pendingImages = useRef(null);
  const imagePicker = useRef(null);
  const openPage = useRef(null);
  const [imageDropTarget, setImageDropTarget] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(false);
  const [notice, setNotice] = useState("");
  const name =
    user?.github_username || user?.email?.split("@")[0] || "Studio member";
  const selected = data.documents.find((d) => d.id === selectedId);
  const draft = selected ? drafts[selected.id] || selected : null;
  const hasDrafts = Object.keys(drafts).length > 0;
  const documentDirty = selected && Boolean(drafts[selected.id]);
  const filteredDocuments = data.documents.filter((d) =>
    `${d.title} ${d.category} ${d.body}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const filteredTasks = data.tasks.filter((t) =>
    `${t.title} ${t.project}`.toLowerCase().includes(query.toLowerCase()),
  );
  const complete = data.tasks.filter((t) => t.status === "Done").length;
  const projectCount = new Set([...data.tasks.map((task) => task.project), ...data.reviews.map((review) => review.project)].filter(Boolean)).size;

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    async function request() {
      setLoading(true);
      setLoadError("");
      try {
        const snapshot = await loadWorkspace({ signal: controller.signal });
        if (!controller.signal.aborted) setData({ ...emptyWorkspace, ...snapshot });
      } catch (failure) {
        if (!controller.signal.aborted) setLoadError(workspaceError(failure, "We could not load your studio workspace. Try again."));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    request();
    return () => controller.abort();
  }, [preview, user?.id, loadAttempt]);

  useEffect(() => {
    if (!preview) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      if (storageWarning.current) storageWarning.current.textContent = "Saved in this browser";
    } catch {
      if (storageWarning.current) storageWarning.current.textContent = "Storage unavailable — changes last for this session";
    }
  }, [data, storageKey, preview, selectedId]);

  useEffect(() => {
    if (!hasDrafts) return;
    function warn(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDrafts]);

  function navigate(next, doc = null, review = null) {
    if (preview) setDemoNavigation({ view: next, doc, review });
    else {
      const params = new URLSearchParams();
      if (next !== "Home") params.set("view", next);
      if (doc) params.set("doc", doc);
      if (review) params.set("review", review);
      setSearchParams(params);
    }
  }

  function go(next) {
    navigate(next);
    setQuery("");
    setMenuOpen(false);
    setNotice("");
  }
  function openDocument(id) {
    navigate("Documents", id);
    setOpenTabs((current) => current.includes(id) ? current : [...current, id]);
    setMenuOpen(false);
    setQuery("");
    setEditorMode("Write");
  }
  async function newDocument() {
    if (busy || loading || loadError) return;
    const fields = {
      title: "Untitled document",
      category: "Studio wiki",
      icon: "▤",
      body: "",
    };
    setBusy("create-document");
    setNotice("");
    try {
      const doc = preview ? { ...fields, id: crypto.randomUUID(), updated: "Just now" } : await createDocument(fields);
      setData((current) => ({ ...current, documents: [doc, ...current.documents] }));
      openDocument(doc.id);
    } catch (failure) { setNotice(workspaceError(failure, "This page could not be created. Try again.")); }
    finally { setBusy(""); }
  }
  function updateDocument(field, value) {
    if (!selected) return;
    if (!preview) {
      setDrafts((current) => ({ ...current, [selected.id]: { ...selected, ...current[selected.id], [field]: value } }));
      return;
    }
    setData((current) => ({
      ...current,
      documents: current.documents.map((d) =>
        d.id === selectedId ? { ...d, [field]: value, updated: "Just now" } : d,
      ),
    }));
  }
  // Applies one edit ({ from, to, text, selectStart, selectEnd }) to the page body.
  // Uses the browser's own insert command so Cmd/Ctrl+Z can undo it; React picks the
  // change up through the textarea's normal onChange. If the browser refuses (or the
  // editor is not open), falls back to a plain state update, which cannot be undone.
  function applyEdit(edit) {
    const editor = bodyEditor.current;
    if (editor && !editor.disabled) {
      editor.focus();
      editor.setSelectionRange(edit.from, edit.to);
      const command = edit.text ? "insertText" : "delete";
      if (document.execCommand(command, false, edit.text)) {
        editor.setSelectionRange(edit.selectStart, edit.selectEnd);
        return;
      }
    }
    const body = editor ? editor.value : draft?.body ?? "";
    updateDocument("body", body.slice(0, edit.from) + edit.text + body.slice(edit.to));
    pendingCursor.current = [edit.selectStart, edit.selectEnd];
  }
  function formatSelection(action) {
    const editor = bodyEditor.current;
    if (!editor || editor.disabled) return;
    const edit = formatMarkdown(action, editor.value, editor.selectionStart, editor.selectionEnd);
    if (edit) applyEdit(edit);
  }
  function editorShortcut(event) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    const action = SHORTCUTS[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    formatSelection(action);
  }
  // Restores the selection after a fallback state update, once the textarea has re-rendered.
  useEffect(() => {
    const editor = bodyEditor.current;
    if (!pendingCursor.current || !editor || editor.disabled) return;
    editor.focus();
    editor.setSelectionRange(...pendingCursor.current);
    pendingCursor.current = null;
  });
  // Uploaded images are inserted once the upload finishes and the editor is enabled again,
  // at the selection the member had when the upload started, so the insert can be undone.
  // The insert runs on the next task, not inside this effect: an edit made during an effect
  // makes React reset the textarea and write it back, which clears the browser's undo history.
  useEffect(() => {
    const pending = pendingImages.current;
    if (!pending || busy) return;
    pendingImages.current = null;
    window.setTimeout(() => {
      const body = bodyEditor.current ? bodyEditor.current.value : draft?.body ?? "";
      applyEdit(padBlock(body, pending.start, pending.end, pending.markdown));
    }, 0);
  });
  // Tracks the page on screen so a slow upload never lands in a page the member has left.
  useEffect(() => { openPage.current = selectedId; }, [selectedId]);
  // Shared by the file picker, paste, and drag-and-drop. Uploads one at a time and
  // inserts all the Markdown in one go at the cursor, each image on its own line.
  async function uploadImages(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length || !selected || busy) return;
    const named = (file, message) => files.length > 1 ? `${file.name}: ${message}` : message;
    if (files.length > MAX_IMAGES_AT_ONCE) {
      setNotice(`Add up to ${MAX_IMAGES_AT_ONCE} images at a time.`);
      return;
    }
    // Check every file first, so nothing uploads when one of them is unsupported.
    for (const file of files) {
      const problem = imageFileProblem(file);
      if (problem) { setNotice(named(file, problem)); return; }
    }
    const pageId = selected.id;
    const uploaded = [];
    let failureNotice = "";
    const editor = bodyEditor.current;
    const bodyLength = (editor ? editor.value : draft?.body ?? "").length;
    const selection = editor ? [editor.selectionStart, editor.selectionEnd] : [bodyLength, bodyLength];
    setBusy("upload-image");
    setNotice("");
    try {
      for (const file of files) {
        try {
          const image = await uploadDocumentImage(file, pageId);
          uploaded.push(imageMarkdown(image.file_name, image.url));
        } catch (failure) {
          // Show the server's file message without the "file: " field prefix.
          const fileError = failure.response?.data?.file?.[0];
          failureNotice = named(file, typeof fileError === "string" ? fileError : workspaceError(failure, "The image could not be uploaded. Try again."));
          break; // Keep the images that already uploaded; skip the rest.
        }
      }
      const markdown = uploaded.join("\n");
      if (markdown && openPage.current === pageId) pendingImages.current = { markdown, start: selection[0], end: selection[1] };
      else if (markdown) {
        const left = `${uploaded.length > 1 ? "The images were" : "The image was"} uploaded, but you left the page first. Paste this where you want it: ${markdown}`;
        failureNotice = failureNotice ? `${left} ${failureNotice}` : left;
      }
      setNotice(failureNotice);
    } finally {
      setBusy("");
    }
  }
  function pickImages(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // Allow picking the same file again later.
    uploadImages(files);
  }
  function pasteImages(event) {
    if (preview || conflicts[selected?.id]) return;
    const clipboard = event.clipboardData;
    // Copies from spreadsheets and Word carry the text plus a picture of it: keep the
    // normal text paste. Screenshots and "Copy image" carry no plain text.
    if (!clipboard || clipboard.types.includes("text/plain")) return;
    const images = Array.from(clipboard.files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    event.preventDefault();
    uploadImages(images.map(renamePastedImage));
  }
  // Drag and drop: same rules as the button. Text dragged within the editor has no
  // "Files" type, so it keeps the browser's normal behavior.
  const canDropImages = Boolean(selected) && !preview && editorMode === "Write" && !busy && !conflicts[selected?.id];
  const draggingFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  function dragImagesOver(event) {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = canDropImages ? "copy" : "none";
    if (canDropImages !== imageDropTarget) setImageDropTarget(canDropImages);
  }
  function dropImages(event) {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    setImageDropTarget(false);
    // Browsers do not report where in a textarea a file was dropped, so images go
    // where the cursor was before dragging.
    if (canDropImages) uploadImages(event.dataTransfer.files);
  }
  // While a page is open, a file dropped anywhere outside the editor would make the
  // browser open that file and leave the page, losing unsaved edits. Refuse those drops.
  useEffect(() => {
    if (!selectedId) return;
    const refuseFileDrop = (event) => {
      if (event.defaultPrevented || !Array.from(event.dataTransfer?.types ?? []).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", refuseFileDrop);
    window.addEventListener("drop", refuseFileDrop);
    return () => {
      window.removeEventListener("dragover", refuseFileDrop);
      window.removeEventListener("drop", refuseFileDrop);
    };
  }, [selectedId]);
  async function changeStatus(id, status) {
    if (busy) return;
    setBusy(`task:${id}`);
    setNotice("");
    try {
      const updated = preview ? { ...data.tasks.find((task) => task.id === id), status } : await saveTask(id, { status });
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? updated : task) }));
    } catch (failure) { setNotice(workspaceError(failure, "Task status was not saved. Choose a status to try again.")); }
    finally { setBusy(""); }
  }
  async function addTask(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const title = form.get("title").trim();
    if (!title) return;
    const fields = { title, project: form.get("project"), priority: form.get("priority"), status: form.get("status") };
    setBusy("create-task");
    setTaskError("");
    try {
      const task = preview ? { ...fields, id: crypto.randomUUID(), person: "You" } : await createTask(fields);
      setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
      setTaskForm(false);
    } catch (failure) { setTaskError(workspaceError(failure, "This task could not be created. Your form is still here.")); }
    finally { setBusy(""); }
  }
  async function savePage() {
    if (!selected || !documentDirty || busy) return;
    if (!draft.title.trim()) { setNotice("Give this page a title before saving."); return; }
    setBusy("save-document");
    setNotice("");
    try {
      const saved = await saveDocument(selected.id, { title: draft.title.trim(), body: draft.body, version: draft.version });
      setData((current) => ({ ...current, documents: current.documents.map((doc) => doc.id === saved.id ? saved : doc) }));
      setDrafts((current) => { const next = { ...current }; delete next[saved.id]; return next; });
    } catch (failure) {
      if (failure.response?.status === 409) {
        setConflicts((current) => ({ ...current, [selected.id]: { latest: null } }));
        setNotice("Another member changed this page. Your draft is safe; compare before saving.");
      } else setNotice(workspaceError(failure, "Your page could not be saved. Your draft is still here; try again."));
    } finally { setBusy(""); }
  }
  async function comparePage() {
    setBusy("compare-document");
    try {
      const snapshot = await loadWorkspace();
      const latest = snapshot.documents.find((doc) => doc.id === selected.id);
      if (!latest) { setNotice("This page was removed. Copy your draft into a new page."); return; }
      setConflicts((current) => ({ ...current, [selected.id]: { latest } }));
    } catch (failure) { setNotice(workspaceError(failure, "The saved page could not be loaded. Your draft is still here.")); }
    finally { setBusy(""); }
  }
  function useLatestVersion() {
    const latest = conflicts[selected.id]?.latest;
    if (!latest) return;
    setData((current) => ({ ...current, documents: current.documents.map((doc) => doc.id === latest.id ? latest : doc) }));
    setDrafts((current) => ({ ...current, [selected.id]: { ...current[selected.id], version: latest.version } }));
    setConflicts((current) => { const next = { ...current }; delete next[selected.id]; return next; });
    setNotice("Merge your changes, then save to replace the latest version.");
  }
  async function removePage() {
    if (!selected || busy) return;
    if (!window.confirm(`Delete “${selected.title}”? This can't be undone.`)) return;
    setBusy("delete-document");
    try {
      await deleteDocument(selected.id);
      setData((current) => ({ ...current, documents: current.documents.filter((doc) => doc.id !== selected.id) }));
      setDrafts((current) => { const next = { ...current }; delete next[selected.id]; return next; });
      setOpenTabs((current) => current.filter((id) => id !== selected.id));
      go("Documents");
      setNotice("Page deleted.");
    } catch (failure) { setNotice(workspaceError(failure, "This page could not be deleted.")); }
    finally { setBusy(""); }
  }
  function upsertReview(review) {
    setData((current) => ({ ...current, reviews: current.reviews.some((item) => item.id === review.id) ? current.reviews.map((item) => item.id === review.id ? review : item) : [review, ...current.reviews] }));
  }
  async function signOut() {
    if (hasDrafts) { setNotice("Save your open page drafts before signing out."); return; }
    if (busy) return;
    setBusy("logout");
    setNotice("");
    try {
      await onLogout?.();
      window.location.assign("/");
    } catch (failure) {
      setNotice(workspaceError(failure, "Sign-out failed. You are still signed in; try again."));
    } finally { setBusy(""); }
  }

  const documentList = (
    <div className="document-grid">
      {filteredDocuments.map((doc) => (
        <button
          className="document-card"
          key={doc.id}
          onClick={() => openDocument(doc.id)}
        >
          <span className="document-symbol">{pageIcon(doc.icon)}</span>
          <span className="eyebrow">{doc.category}</span>
          <h3>{doc.title}</h3>
          <p>{documentExcerpt(doc.body)}</p>
          <span className="document-footer">
            Edited {doc.updated.toLowerCase()} <Icon name="arrow" size={16} />
          </span>
        </button>
      ))}
      {!filteredDocuments.length && (
        <p className="empty-state">
          No documents found. Try another search or create a page.
        </p>
      )}
    </div>
  );

  return (
    <div className="workspace">
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`workspace-sidebar ${menuOpen ? "is-open" : ""}`}
      >
        <a className="studio-brand" href={preview ? "/preview" : "/dashboard"}>
          <img className="brand-mark" src="/studio-die.svg" alt="" />
          <span className="studio-wordmark">
            MYSTIC DIE<small>STUDIOS</small>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {[
            ["Home", "home"],
            ["Projects", "project"],
            ["Documents", "document"],
            ["My tasks", "task"],
            ["Reviews", "task"],
            ["Team", "team"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={`nav-item ${view === label ? "active" : ""}`}
              aria-current={view === label ? "page" : undefined}
              onClick={() => go(label)}
            >
              <Icon name={icon} />
              {label}{label === "Documents" && <span className="nav-wiki">Wiki</span>}
              {label === "My tasks" && (
                <span className="nav-count">
                  {
                    data.tasks.filter(
                      (t) => t.person === "You" && t.status !== "Done",
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-section-heading">
          <p className="nav-label">PINNED PAGES</p>
          <button aria-label="Create document" onClick={newDocument} disabled={Boolean(busy) || loading || Boolean(loadError)}>
            <Icon name="plus" size={16} />
          </button>
        </div>
        {data.documents.slice(0, 3).map((d) => (
          <button
            key={d.id}
            className="pinned-page"
            onClick={() => openDocument(d.id)}
          >
            <span>{pageIcon(d.icon)}</span>
            {d.title}
          </button>
        ))}
        <div className="account">
          <span className="person-avatar">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <span>
            {name}
            <small>
              {preview ? "Preview workspace" : user?.role || "Studio member"}
            </small>
          </span>
          {!preview && (
            <button
              onClick={signOut}
              aria-label="Log out"
              disabled={Boolean(busy)}
              data-testid="logout-btn"
            >
              <Icon name="logout" size={18} />
            </button>
          )}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{selected ? selected.title : view}</strong>
          </div>
        </header>
        {preview && <div className="preview-banner">
          <span className="preview-dot" />
          Demo workspace · Sample content. Edits stay in this browser;
          files are not uploaded.
          <a href={preview ? "/" : "/preview"}>
            {preview ? "Studio sign in" : "Open public preview"}{" "}
            <Icon name="arrow" size={14} />
          </a>
        </div>}
        {loading ? <main className="workspace-content"><p className="empty-state" role="status">Loading your studio workspace…</p></main> : loadError ? <main className="workspace-content"><div className="empty-state" role="alert"><h2>Workspace unavailable</h2><p>{loadError}</p><button className="primary-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry workspace</button></div></main> : <>
        {openTabs.length > 0 && <div className="open-document-tabs" role="tablist" aria-label="Open documents">
          {[...new Set([...openTabs, ...(selectedId ? [selectedId] : [])])].map((id) => {
            const doc = data.documents.find((item) => item.id === id);
            if (!doc) return null;
            return <button key={id} role="tab" aria-selected={selectedId === id} onClick={() => openDocument(id)}>{drafts[id]?.title || doc.title}{drafts[id] && <span aria-label="Unsaved changes"> ●</span>}</button>;
          })}
        </div>}
        <main className="workspace-content" data-testid="dashboard-header">
          <div className="page-heading">
            <h1>
              {selected ? "Edit document" : view}
            </h1>
            {view !== "Team" && <button
              className="primary-button"
              disabled={Boolean(busy)}
              onClick={
                view === "Projects" || view === "My tasks"
                  ? () => { setTaskError(""); setTaskForm("To do"); }
                  : view === "Reviews"
                    ? () => setReviewForm(true)
                  : newDocument
              }
            >
              <Icon name="plus" size={18} />
              {view === "Projects" || view === "My tasks"
                ? "New task"
                : view === "Reviews"
                  ? "New review"
                : "New page"}
            </button>}
          </div>
          {notice && (
            <div className="workspace-notice" role="alert">
              {notice}
            </div>
          )}
          {view === "Home" && (
            <>
              <div className="stats-row">
                {[
                  ["project", "Active projects", projectCount],
                  ["document", "Shared documents", data.documents.length],
                  ["task", "Open tasks", data.tasks.length - complete],
                ].map(([icon, label, count]) => (
                  <button
                    className="stat-card"
                    key={label}
                    onClick={() =>
                      go(
                        icon === "project"
                          ? "Projects"
                          : icon === "document"
                            ? "Documents"
                            : "My tasks",
                      )
                    }
                  >
                    <span className={`stat-icon ${icon}`}>
                      <Icon name={icon} />
                    </span>
                    <div>
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>
                    <Icon name="arrow" size={17} />
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h2>Documents</h2>
                <button onClick={() => go("Documents")}>
                  All documents <Icon name="arrow" size={16} />
                </button>
              </div>
              {documentList}
            </>
          )}

          {view !== "Home" && view !== "Team" && !selected && !reviewId && (
            <div className="view-toolbar">
              <div className="view-tabs">
                <span className="selected-tab">
                  {view === "Projects"
                    ? "Project board"
                    : view === "Documents"
                      ? "Markdown wiki · All documents"
                      : view === "Reviews"
                        ? "Review tickets"
                      : "Assigned to me"}
                </span>
                <span className="toolbar-count">
                  {view === "Documents"
                    ? filteredDocuments.length
                    : view === "Reviews"
                      ? data.reviews.length
                    : filteredTasks.filter(
                        (t) => view !== "My tasks" || t.person === "You",
                      ).length}
                </span>
              </div>
              <label className="workspace-search">
                <Icon name="search" size={17} />
                <input
                  aria-label={`Search ${view.toLowerCase()}`}
                  placeholder="Search this view…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
          )}
          {view === "Documents" && !selected && documentList}
          {selected && (
            <section className="document-editor">
              <div className="editor-toolbar">
                <button onClick={() => go("Documents")}>
                  ← All documents
                </button>
                {preview ? <span ref={storageWarning} role="status">Saved in this browser</span> : <span role="status">{busy === "save-document" ? "Saving…" : busy === "upload-image" ? "Uploading image…" : documentDirty ? "Unsaved changes" : "Saved"}</span>}
                {!preview && <button className="primary-button" onClick={savePage} disabled={!documentDirty || Boolean(busy) || Boolean(conflicts[selected.id])}>Save page</button>}
              </div>
              <span className="editor-symbol">{pageIcon(selected.icon)}</span>
              <input
                className="editor-title"
                aria-label="Document title"
                value={draft.title}
                maxLength={160}
                disabled={Boolean(busy)}
                onChange={(e) => updateDocument("title", e.target.value)}
              />
              <span className="editor-category">{selected.category}</span>
              <div className="editor-bar">
                <div className="editor-modes" role="tablist" aria-label="Document editor mode">
                  {["Write", "Preview"].map((mode) => <button role="tab" key={mode} aria-selected={editorMode === mode} onClick={() => setEditorMode(mode)}>{mode}</button>)}
                </div>
                {editorMode === "Write" && <div className="format-toolbar" role="toolbar" aria-label="Formatting">
                  {/* onMouseDown keeps focus and the selection in the editor while clicking. */}
                  {TOOLBAR.map(([action, label, shortcut]) => (
                    <button key={action} type="button" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection(action)} disabled={Boolean(busy)}>
                      <Icon name={action} size={16} />
                    </button>
                  ))}
                  {!preview && <>
                    <input ref={imagePicker} type="file" accept={WIKI_IMAGE_ACCEPT} multiple hidden onChange={pickImages} />
                    <button type="button" aria-label="Insert image" title="Insert image" onMouseDown={(event) => event.preventDefault()} onClick={() => imagePicker.current?.click()} disabled={Boolean(busy) || Boolean(conflicts[selected.id])}>
                      <Icon name="image" size={16} />
                    </button>
                  </>}
                </div>}
              </div>
              {editorMode === "Write" ? <textarea
                ref={bodyEditor}
                aria-label="Document content"
                placeholder="Write in Markdown…"
                value={draft.body}
                disabled={Boolean(busy)}
                onChange={(e) => updateDocument("body", e.target.value)}
                onPaste={pasteImages}
                onKeyDown={editorShortcut}
                onDragOver={dragImagesOver}
                onDragLeave={() => setImageDropTarget(false)}
                onDrop={dropImages}
                className={imageDropTarget ? "image-drop-target" : undefined}
              /> : <MarkdownPreview>{draft.body || "*This page is empty.*"}</MarkdownPreview>}
              {conflicts[selected.id] && <div className="document-conflict" role="alert">
                <h3>This page changed while you were writing.</h3>
                <p>Your draft is kept above. Compare and merge before saving.</p>
                <button className="secondary-button" onClick={comparePage} disabled={Boolean(busy)}>Compare with saved page</button>
                {conflicts[selected.id].latest && <>
                  <h4>Latest saved version: {conflicts[selected.id].latest.title}</h4>
                  <MarkdownPreview>{conflicts[selected.id].latest.body}</MarkdownPreview>
                  <p>Your draft stays as it is. Your next save replaces this version.</p>
                  <button className="secondary-button" onClick={useLatestVersion}>Use latest version for this draft</button>
                </>}
              </div>}
              {!preview && selected.can_delete && <div className="editor-footnote">
                <button className="secondary-button" onClick={removePage} disabled={Boolean(busy)}>Delete page</button>
              </div>}
            </section>
          )}
          {view === "Documents" && selectedId && !selected && <p className="empty-state">This page is unavailable or has been deleted.<button className="secondary-button" onClick={() => go("Documents")}>All documents</button></p>}
          {view === "Reviews" && <Reviews reviews={data.reviews} selectedId={reviewId} onSelect={(id) => navigate("Reviews", null, id)} onUpdate={upsertReview} preview={preview} query={query} showForm={reviewForm} onCloseForm={() => setReviewForm(false)} />}
          {view === "Projects" && (
            <>
              <div className="kanban-board">
                {statuses.map((status) => (
                  <section className="kanban-column" key={status}>
                    <div className="column-heading">
                      <span
                        className={`status-dot ${status === "Done" ? "done" : status === "In progress" ? "progress" : ""}`}
                      />
                      <h3>{status}</h3>
                      <span>
                        {
                          filteredTasks.filter((t) => t.status === status)
                            .length
                        }
                      </span>
                    </div>
                    {filteredTasks
                      .filter((t) => t.status === status)
                      .map((task) => (
                        <article className="task-card" key={task.id}>
                          <span className="task-project">{task.project}</span>
                          <h3>{task.title}</h3>
                          <span
                            className={`priority ${task.priority.toLowerCase()}`}
                          >
                            {task.priority} priority
                          </span>
                          <div className="task-card-footer">
                            <span className="task-assignee">
                              <span className="person-avatar small">
                                {task.person === "You"
                                  ? name.slice(0, 1).toUpperCase()
                                  : "T"}
                              </span>
                              {task.person}
                            </span>
                            <select
                              aria-label={`Status for ${task.title}`}
                              value={task.status}
                              disabled={Boolean(busy) || (!preview && task.can_edit === false)}
                              onChange={(e) =>
                                changeStatus(task.id, e.target.value)
                              }
                            >
                              {statuses.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </article>
                      ))}
                    <button
                      className="add-task-button"
                      disabled={Boolean(busy)}
                      onClick={() => { setTaskError(""); setTaskForm(status); }}
                    >
                      <Icon name="plus" size={16} />
                      Add task
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
          {view === "My tasks" && (
            <div className="task-list">
              {filteredTasks
                .filter((t) => t.person === "You")
                .map((task) => (
                  <div className="task-row" key={task.id}>
                    <input
                      type="checkbox"
                      aria-label={`Mark ${task.title} complete`}
                      checked={task.status === "Done"}
                      disabled={Boolean(busy) || (!preview && task.can_edit === false)}
                      onChange={(e) =>
                        changeStatus(
                          task.id,
                          e.target.checked ? "Done" : "To do",
                        )
                      }
                    />
                    <div>
                      <h3
                        className={
                          task.status === "Done" ? "completed-task" : ""
                        }
                      >
                        {task.title}
                      </h3>
                      <span>{task.project}</span>
                    </div>
                    <span className={`priority ${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>
                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      disabled={Boolean(busy) || (!preview && task.can_edit === false)}
                      onChange={(e) => changeStatus(task.id, e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              {!filteredTasks.some((t) => t.person === "You") && (
                <p className="empty-state">
                  No matching tasks. Create a task to get started.
                </p>
              )}
            </div>
          )}
          {view === "Team" && (
            <div className="team-directory">
              {data.members.map((member) => <article className="team-panel" key={member.id}>
                <span className="person-avatar large">{(member.github_username || "Studio member").slice(0, 2).toUpperCase()}</span>
                <div><h2>{member.github_username || "Studio member"}</h2><p>{preview ? "Sample studio member" : "Studio member"}</p></div>
                <span className="pill">{member.role}</span>
              </article>)}
              {!data.members.length && <p className="empty-state">No studio members found.</p>}
            </div>
          )}
          <footer className="workspace-footer">
            <span>Mystic Die Studios</span>
          </footer>
        </main>
        </>}
      </div>
      {taskForm && (
        <TaskDialog
          onClose={() => setTaskForm(false)}
          onSubmit={addTask}
          initialStatus={taskForm}
          busy={busy === "create-task"}
          error={taskError}
        />
      )}
    </div>
  );
}
