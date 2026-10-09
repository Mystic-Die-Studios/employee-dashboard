import { useEffect, useRef, useState } from "react";
import "./Workspace.css";

const initialDocuments = [
  {
    id: "welcome",
    title: "Welcome to Mystic Die",
    category: "Getting started",
    icon: "✦",
    updated: "Just now",
    body: "A little magic. A lot of making.\n\nThis is our shared home for the ideas, decisions, and details that bring our games to life.\n\nSTART HERE\nExplore the project board to see what we are building. Keep your notes in Documents, and use My tasks to find your next move.\n\nHOW WE WORK\nMake room for bold ideas. Write things down. Share early, give thoughtful feedback, and keep moving together.",
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
      return saved;
  } catch {
    /* Start with sample content when storage is unavailable. */
  }
  return { documents: initialDocuments, tasks: initialTasks };
}

function TaskDialog({ onClose, onSubmit, initialStatus }) {
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
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="section-heading">
        <h2 id="task-modal-title">A new step forward.</h2>
        <button onClick={onClose} aria-label="Close task form">
          ✕
        </button>
      </div>
      <p>Add a task to your studio board.</p>
      <form onSubmit={onSubmit}>
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
          <select name="project">
            <option>Project Reconnection</option>
            <option>Studio operations</option>
          </select>
        </label>
        <label>
          Priority
          <select name="priority">
            <option>Medium</option>
            <option>High</option>
            <option>Low</option>
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Create task <Icon name="plus" size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Workspace({ user, onLogout, preview = false }) {
  const storageKey = `mystic-workspace-demo-v1:${preview ? "public" : user?.id || user?.email || user?.github_username || "member"}`;
  const [data, setData] = useState(() => readWorkspace(storageKey));
  const [view, setView] = useState("Home");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(false);
  const [notice, setNotice] = useState("");
  const storageWarning = useRef(null);
  const name =
    user?.github_username || user?.email?.split("@")[0] || "Studio member";
  const selected = data.documents.find((d) => d.id === selectedId);
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

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      if (storageWarning.current)
        storageWarning.current.textContent = "Saved in this browser";
    } catch {
      if (storageWarning.current)
        storageWarning.current.textContent =
          "Storage unavailable — changes last for this session";
    }
  }, [data, storageKey, selectedId]);

  function go(next) {
    setView(next);
    setSelectedId(null);
    setQuery("");
    setMenuOpen(false);
    setNotice("");
  }
  function openDocument(id) {
    setView("Documents");
    setSelectedId(id);
    setMenuOpen(false);
    setQuery("");
  }
  function newDocument() {
    const doc = {
      id: crypto.randomUUID(),
      title: "Untitled document",
      category: "Studio wiki",
      icon: "▤",
      updated: "Just now",
      body: "",
    };
    setData((current) => ({
      ...current,
      documents: [doc, ...current.documents],
    }));
    openDocument(doc.id);
  }
  function updateDocument(field, value) {
    setData((current) => ({
      ...current,
      documents: current.documents.map((d) =>
        d.id === selectedId ? { ...d, [field]: value, updated: "Just now" } : d,
      ),
    }));
  }
  function changeStatus(id, status) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  }
  function addTask(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = form.get("title").trim();
    if (!title) return;
    setData((current) => ({
      ...current,
      tasks: [
        {
          id: crypto.randomUUID(),
          title,
          project: form.get("project"),
          priority: form.get("priority"),
          status: form.get("status"),
          person: "You",
        },
        ...current.tasks,
      ],
    }));
    setTaskForm(false);
  }
  async function signOut() {
    await onLogout?.();
    window.location.assign("/");
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
          <span className="brand-mark">✦</span>
          <span>
            MYSTIC DIE<small>STUDIO WORKSPACE</small>
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
            ["Team", "team"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={`nav-item ${view === label ? "active" : ""}`}
              aria-current={view === label ? "page" : undefined}
              onClick={() => go(label)}
            >
              <Icon name={icon} />
              {label}
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
          <button aria-label="Create document" onClick={newDocument}>
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
          <button onClick={newDocument}>
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
        <div className="preview-banner">
          <span className="preview-dot" />
          Frontend preview · Sample content. Edits are saved only in this
          browser.
          <a href={preview ? "/" : "/preview"}>
            {preview ? "Studio sign in" : "Open public preview"}{" "}
            <Icon name="arrow" size={14} />
          </a>
        </div>
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
                        : "The people behind the magic. Team management is coming next."}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={
                view === "Projects" || view === "My tasks"
                  ? () => setTaskForm("To do")
                  : newDocument
              }
            >
              <Icon name="plus" size={18} />
              {view === "Projects" || view === "My tasks"
                ? "New task"
                : "New page"}
            </button>
          </div>
          {notice && (
            <div className="workspace-notice" role="status">
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
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="art-spark spark-one">✧</div>
                  <div className="art-spark spark-two">✦</div>
                  <div className="art-card art-card-back">
                    <span>✦</span>
                    <div />
                    <div />
                  </div>
                  <div className="art-card art-card-front">
                    <span className="art-emblem">◈</span>
                    <small>AN IDEA WORTH MAKING</small>
                    <strong>
                      Something
                      <br />
                      extraordinary.
                    </strong>
                    <div className="art-line" />
                    <span className="art-avatar">M</span>
                    <span className="art-avatar second">D</span>
                  </div>
                </div>
              </section>
              <div className="stats-row">
                {[
                  ["project", "Active projects", "1", "A world in the making"],
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
                  <h3>Project Reconnection</h3>
                  <p>Every great world begins with a connection.</p>
                </div>
                <div className="project-progress">
                  <span>{progress}% of sample tasks complete</span>
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

          {view !== "Home" && view !== "Team" && !selected && (
            <div className="view-toolbar">
              <div className="view-tabs">
                <span className="selected-tab">
                  {view === "Projects"
                    ? "Project board"
                    : view === "Documents"
                      ? "All documents"
                      : "Assigned to me"}
                </span>
                <span className="toolbar-count">
                  {view === "Documents"
                    ? filteredDocuments.length
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
                <button onClick={() => setSelectedId(null)}>
                  ← All documents
                </button>
                <span ref={storageWarning} role="status">
                  Saved in this browser
                </span>
              </div>
              <span className="editor-symbol">{selected.icon}</span>
              <input
                className="editor-title"
                aria-label="Document title"
                value={selected.title}
                maxLength={160}
                onChange={(e) => updateDocument("title", e.target.value)}
              />
              <span className="editor-category">
                {selected.category} <span>•</span> Studio document
              </span>
              <textarea
                aria-label="Document content"
                placeholder="Start writing your next great idea…"
                value={selected.body}
                onChange={(e) => updateDocument("body", e.target.value)}
              />
              <div className="editor-footnote">
                Plain-text editor · Changes stay in this preview browser.
              </div>
            </section>
          )}
          {view === "Projects" && (
            <>
              <div className="board-project-title">
                <span className="project-emblem">◈</span>
                <div>
                  <h2>Studio project board</h2>
                  <p>Project Reconnection & studio operations</p>
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
                      onClick={() => setTaskForm(status)}
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
            <section className="team-panel">
              <span className="person-avatar large">
                {name.slice(0, 2).toUpperCase()}
              </span>
              <h2>{name}</h2>
              <p>
                {preview
                  ? "Sample studio member"
                  : user?.email || "Signed in with GitHub"}
              </p>
              <span className="pill">
                {preview ? "PREVIEW MEMBER" : user?.role || "STUDIO MEMBER"}
              </span>
              <p className="team-description">
                This is your studio workspace. The team directory and
                invitations will be connected when the team API is available.
              </p>
              <button
                className="secondary-button"
                onClick={() =>
                  setNotice(
                    "Team invitations are planned for the backend integration. No invitation has been sent.",
                  )
                }
              >
                Invite a teammate <Icon name="plus" size={16} />
              </button>
            </section>
          )}
          <footer className="workspace-footer">
            <span>✦ Made of ideas. Built together.</span>
            <span>Mystic Die Studios</span>
          </footer>
        </main>
      </div>
      {taskForm && (
        <TaskDialog
          onClose={() => setTaskForm(false)}
          onSubmit={addTask}
          initialStatus={taskForm}
        />
      )}
    </div>
  );
}
