import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createDocument,
  createTask,
  deleteDocument,
  loadWorkspace,
  saveDocument,
  saveTask,
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
    body: "# A little magic. A lot of making.\n\nThis is our shared home for the ideas, decisions, and details that bring our games to life.\n\n## Start here\nExplore the project board to see what we are building. Keep your notes in Documents, and use My tasks to find your next move.\n\n## How we work\n- Make room for bold ideas.\n- Write things down.\n- Share early, give thoughtful feedback, and keep moving together.",
  },
  {
    id: "direction",
    title: "Creative direction",
    category: "Project Reconnection",
    icon: "◈",
    updated: "Today",
    body: "PROJECT RECONNECTION\n\nA world worth getting lost in.\n\nOur creative pillars\n• Discovery should feel personal.\n• Every environment tells a story.\n• Small moments make a lasting impression.\n\nUse this document to collect visual references, narrative ideas, and decisions as the project develops.",
  },
  {
    id: "onboarding",
    title: "Team onboarding",
    category: "Studio wiki",
    icon: "☀",
    updated: "Yesterday",
    body: "WELCOME TO THE TEAM\n\nYour first week\n• Meet your teammates.\n• Get access to the project repository.\n• Read the creative direction.\n• Pick a small first task with your lead.\n\nQuestions are welcome. Leave a note here and bring it to our next team check-in.",
  },
  {
    id: "notes",
    title: "Weekly studio notes",
    category: "Studio wiki",
    icon: "≋",
    updated: "Yesterday",
    body: "STUDIO CHECK-IN\n\nWhat moved forward?\n\nWhat did we learn?\n\nWhere do we need a hand?\n\nNext steps\nCapture decisions and turn follow-ups into tasks on the project board.",
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
        <h2 id="task-modal-title">A new step forward.</h2>
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
  const progress = data.tasks.length
    ? Math.round((complete / data.tasks.length) * 100)
    : 0;
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
      setNotice("Page saved to the studio workspace.");
    } catch (failure) {
      if (failure.response?.status === 409) {
        setConflicts((current) => ({ ...current, [selected.id]: { latest: null } }));
        setNotice("Another member changed this page. Your draft is safe. Compare with the saved page before saving again.");
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
    setNotice("Review and merge your draft, then Save page to replace the latest saved content.");
  }
  async function removePage() {
    if (!selected || busy) return;
    if (!window.confirm(`Delete “${selected.title}”? This removes the shared page and its contents from the studio workspace.`)) return;
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
          <span className="document-symbol">{doc.icon}</span>
          <span className="eyebrow">{doc.category}</span>
          <h3>{doc.title}</h3>
          <p>
            {doc.body
              .split("\n")
              .filter(Boolean)
              .slice(0, 2)
              .join(" · ")
              .slice(0, 100)}
          </p>
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
        <div className="workspace-switch">
          <span className="workspace-avatar">M</span>
          <span>
            Mystic Die Studios<small>Let’s make something great</small>
          </span>
        </div>
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
            <span>{d.icon}</span>
            {d.title}
          </button>
        ))}
        <div className="sidebar-note">
          <span>✧</span>
          <h4>Good things start here.</h4>
          <p>A shared space for the things we’re making together.</p>
          <button onClick={newDocument} disabled={Boolean(busy) || loading || Boolean(loadError)}>
            Capture an idea <Icon name="arrow" size={16} />
          </button>
        </div>
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
          <span className="studio-status">
            <span />
            Studio workspace
          </span>
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
            <div>
              <p className="eyebrow">
                MYSTIC DIE STUDIOS / {view.toUpperCase()}
              </p>
              <h1>
                {selected
                  ? "Make room for ideas."
                  : view === "Home"
                    ? "Your next great idea starts here."
                    : view === "Projects"
                      ? "Small steps. Big worlds."
                      : view === "Documents"
                        ? "A home for what we know."
                        : view === "My tasks"
                          ? "Find your next move."
                        : view === "Reviews"
                          ? "Create. Share. Refine."
                          : "Made better, together."}
              </h1>
              <p className="page-subtitle">
                {view === "Home"
                  ? "Your projects, people, and possibilities. All in one place."
                  : view === "Projects"
                    ? "Keep the work moving, from the first spark to the final detail."
                    : view === "Documents"
                      ? "Capture ideas, share knowledge, and keep everyone on the same page."
                      : view === "My tasks"
                        ? "A little focus goes a long way. Here’s what’s on your plate."
                        : view === "Reviews"
                          ? "Upload artwork, collect feedback, and track every review in one place."
                        : "The people behind the magic. Your studio’s GitHub member directory."}
              </p>
            </div>
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
              <section className="welcome-card">
                <div className="welcome-copy">
                  <span className="pill">THE STUDIO, IN SYNC</span>
                  <h2>
                    Build worlds.
                    <br />
                    Bring ideas to life.
                  </h2>
                  <p>
                    One space for the stories we tell,
                    <br />
                    the work we do, and the team behind it.
                  </p>
                  <button onClick={() => go("Projects")}>
                    Explore your projects <Icon name="arrow" size={18} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="die-orbit die-orbit-one" />
                  <div className="die-orbit die-orbit-two" />
                  <div className="die-glow" />
                  <img className="hero-die" src="/studio-die.svg" alt="" />
                  <span className="die-spark die-spark-one">✦</span>
                  <span className="die-spark die-spark-two">✧</span>
                </div>
              </section>
              <div className="stats-row">
                {[
                  ["project", "Active projects", projectCount, "Worlds in the making"],
                  [
                    "document",
                    "Shared documents",
                    data.documents.length,
                    "Ideas, made accessible",
                  ],
                  [
                    "task",
                    "Open tasks",
                    data.tasks.length - complete,
                    "Moving things forward",
                  ],
                ].map(([icon, label, count, description]) => (
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
                      <small>{description}</small>
                    </div>
                    <Icon name="arrow" size={17} />
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h2>Pick up where you left off</h2>
                <button onClick={() => go("Documents")}>
                  All documents <Icon name="arrow" size={16} />
                </button>
              </div>
              {documentList}
              <section className="project-summary">
                <span className="project-emblem">◈</span>
                <div>
                  <span className="eyebrow">IN THE MAKING</span>
                  <h3>Studio workflow</h3>
                  <p>Documents, tasks, and art reviews in one shared workspace.</p>
                </div>
                <div className="project-progress">
                  <span>{progress}% of {preview ? "sample " : ""}tasks complete</span>
                  <progress value={complete} max={data.tasks.length || 1} />
                </div>
                <button
                  className="secondary-button"
                  onClick={() => go("Projects")}
                >
                  Open project <Icon name="arrow" size={16} />
                </button>
              </section>
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
                {preview ? <span ref={storageWarning} role="status">Saved in this browser</span> : <span role="status">{busy === "save-document" ? "Saving page…" : documentDirty ? "Unsaved changes" : "Saved to studio workspace"}</span>}
                {!preview && <button className="primary-button" onClick={savePage} disabled={!documentDirty || Boolean(busy) || Boolean(conflicts[selected.id])}>Save page</button>}
              </div>
              <span className="editor-symbol">{selected.icon}</span>
              <input
                className="editor-title"
                aria-label="Document title"
                value={draft.title}
                maxLength={160}
                disabled={Boolean(busy)}
                onChange={(e) => updateDocument("title", e.target.value)}
              />
              <span className="editor-category">
                {selected.category} <span>•</span> Studio document
              </span>
              <div className="editor-modes" role="tablist" aria-label="Document editor mode">
                {["Write", "Preview"].map((mode) => <button role="tab" key={mode} aria-selected={editorMode === mode} onClick={() => setEditorMode(mode)}>{mode}</button>)}
              </div>
              {editorMode === "Write" ? <textarea
                aria-label="Document content"
                placeholder="# Your next great idea\n\nWrite Markdown: headings, lists, links, tables, and checklists."
                value={draft.body}
                disabled={Boolean(busy)}
                onChange={(e) => updateDocument("body", e.target.value)}
              /> : <MarkdownPreview>{draft.body || "*This page is empty. Switch to Write to add content.*"}</MarkdownPreview>}
              {conflicts[selected.id] && <div className="document-conflict" role="alert">
                <h3>This page changed while you were writing.</h3>
                <p>Your draft is still above. Compare the latest saved page and merge any changes before saving.</p>
                <button className="secondary-button" onClick={comparePage} disabled={Boolean(busy)}>Compare with saved page</button>
                {conflicts[selected.id].latest && <>
                  <h4>Latest saved version: {conflicts[selected.id].latest.title}</h4>
                  <MarkdownPreview>{conflicts[selected.id].latest.body}</MarkdownPreview>
                  <p>Using this version keeps your draft. Your next save will replace the latest page with your merged draft.</p>
                  <button className="secondary-button" onClick={useLatestVersion}>Use latest version for this draft</button>
                </>}
              </div>}
              <div className="editor-footnote">
                Markdown wiki · {preview ? "Changes stay in this demo browser." : "Save page to share changes with your studio. Drafts remain in open tabs until saved."}
                {!preview && selected.can_delete && <button className="secondary-button" onClick={removePage} disabled={Boolean(busy)}>Delete page</button>}
              </div>
            </section>
          )}
          {view === "Documents" && selectedId && !selected && <p className="empty-state">This page is unavailable or has been deleted.<button className="secondary-button" onClick={() => go("Documents")}>All documents</button></p>}
          {view === "Reviews" && <Reviews reviews={data.reviews} selectedId={reviewId} onSelect={(id) => navigate("Reviews", null, id)} onUpdate={upsertReview} preview={preview} query={query} showForm={reviewForm} onCloseForm={() => setReviewForm(false)} />}
          {view === "Projects" && (
            <>
              <div className="board-project-title">
                <span className="project-emblem">◈</span>
                <div>
                  <h2>Studio project board</h2>
                  <p>Shared tasks across studio projects</p>
                </div>
                <span className="pill">ACTIVE</span>
              </div>
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
            <span>✦ Made of ideas. Built together.</span>
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
