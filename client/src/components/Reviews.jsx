import { useEffect, useRef, useState } from "react";
import {
  addFeedback,
  createReview,
  downloadReviewFile,
  loadReview,
  syncReview,
  workspaceError,
} from "../api/workspace";
import MarkdownPreview from "./Markdown";

const acceptedFiles = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.blend,.fbx,.obj,.psd,.kra,.zip,.mp4,.wav";
const statusNames = {
  submitted: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

function FileForm({ preview, onClose, onCreated }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => {
      element.close();
      previousFocus?.focus();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!file?.size) {
      setError("Choose a non-empty file to submit for review.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("This file is too large. Upload a file under 50 MB.");
      return;
    }
    const extension = `.${file.name.split(".").pop().toLowerCase()}`;
    if (!acceptedFiles.split(",").includes(extension)) {
      setError("Choose an image, PDF, art source, ZIP, MP4, or WAV file.");
      return;
    }
    form.set("title", form.get("title").trim());
    form.set("project", form.get("project").trim());
    if (!form.get("title") || !form.get("project")) {
      setError("Enter a title and project.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const review = preview
        ? {
            id: crypto.randomUUID(),
            ticket: "ART-DEMO",
            title: form.get("title"),
            project: form.get("project"),
            description: form.get("description"),
            file_name: file.name,
            file_size: file.size,
            status: "submitted",
            github_sync_status: "not_configured",
            github_issue_url: null,
            author: { id: "demo", github_username: "Demo artist" },
            created_at: new Date().toISOString(),
            feedback: [],
            can_review: false,
            can_sync: false,
          }
        : await createReview(form);
      onCreated(review);
      onClose();
    } catch (failure) {
      setError(workspaceError(failure, "The upload failed. Your form is still here; try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="task-modal review-modal" aria-labelledby="review-form-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}>
      <div className="section-heading">
        <h2 id="review-form-title">Share your work.</h2>
        <button onClick={onClose} disabled={busy} aria-label="Close review form">✕</button>
      </div>
      <p>{preview ? "Demo: only the filename and ticket details are saved in this browser. The file is not uploaded." : "Upload an artifact to create a private studio review ticket."}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Review title<input name="title" autoFocus required maxLength={160} placeholder="What would you like reviewed?" /></label>
          <label>Project<input name="project" required maxLength={120} placeholder="Project Reconnection" /></label>
          <label>Description<textarea name="description" maxLength={20000} placeholder="Context, goals, and what feedback would help. Markdown supported." /></label>
          <label>Artifact file<input type="file" name="file" required accept={acceptedFiles} /></label>
          <p className="form-hint">Images, PDF, Blender, FBX, OBJ, PSD, Krita, ZIP, MP4, or WAV · Up to 50 MB. Files are available to signed-in studio members.</p>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy}>{busy ? "Uploading…" : preview ? "Create demo ticket" : "Submit for review"}</button>
        </div>
      </form>
    </dialog>
  );
}

function ReviewDetail({ review, preview, onUpdate, onBack }) {
  const [body, setBody] = useState("");
  const [decision, setDecision] = useState("comment");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function feedback(event) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy("feedback");
    setError("");
    try {
      const updated = preview
        ? { ...review, feedback: [...(review.feedback || []), { id: crypto.randomUUID(), body: body.trim(), decision: "comment", author: { github_username: "Demo member" }, created_at: new Date().toISOString() }] }
        : await addFeedback(review.id, { body: body.trim(), decision });
      onUpdate(updated);
      setBody("");
      setDecision("comment");
    } catch (failure) {
      setError(workspaceError(failure, "Feedback could not be saved. Your comment is still here."));
    } finally { setBusy(""); }
  }

  async function download() {
    setBusy("download");
    setError("");
    try { await downloadReviewFile(review.id, review.file_name); }
    catch (failure) { setError(workspaceError(failure, "The file could not be downloaded. Try again.")); }
    finally { setBusy(""); }
  }

  async function connectGithub() {
    setBusy("github");
    setError("");
    try {
      const updated = await syncReview(review.id);
      onUpdate(updated);
    } catch (failure) {
      setError(workspaceError(failure, "GitHub could not be reached. Your studio ticket is saved."));
    } finally { setBusy(""); }
  }

  const issueUrl = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(review.github_issue_url || "") ? review.github_issue_url : null;
  return (
    <section className="review-detail" aria-label="Review ticket">
      <div className="editor-toolbar">
        <button onClick={onBack}>← All reviews</button>
        <span className={`review-status ${review.status}`}>{statusNames[review.status] || review.status}</span>
      </div>
      <p className="eyebrow">{review.ticket} / {review.project}</p>
      <h2>{review.title}</h2>
      <p className="review-byline">Submitted by {review.author?.github_username || "Studio member"}{review.created_at ? ` · ${new Date(review.created_at).toLocaleDateString()}` : ""}</p>
      {review.description && <MarkdownPreview>{review.description}</MarkdownPreview>}
      <div className="review-artifact">
        <div><strong>{review.file_name}</strong><small>{((review.file_size || 0) / (1024 * 1024)).toFixed(2)} MB · Private studio artifact</small></div>
        {preview ? <span className="form-hint">Demo file · Download unavailable</span> : <button className="secondary-button" onClick={download} disabled={Boolean(busy)}>{busy === "download" ? "Downloading…" : "Download artifact"}</button>}
      </div>
      <div className="review-github">
        {issueUrl && <a href={issueUrl} target="_blank" rel="noreferrer noopener">View GitHub issue ↗</a>}
        {review.github_sync_status === "failed" ? <p>GitHub issue sync failed. Your studio review is saved.</p> : !issueUrl && <p>GitHub connection not configured. Your studio review is saved.</p>}
        {!preview && review.can_sync && (review.github_sync_status === "failed" || !issueUrl) && <button className="secondary-button" onClick={connectGithub} disabled={Boolean(busy)}>{busy === "github" ? "Connecting…" : "Retry GitHub sync"}</button>}
      </div>
      <div className="section-heading"><h3>Feedback & review history</h3><span className="toolbar-count">{review.feedback?.length || 0}</span></div>
      <ol className="review-history">
        {(review.feedback || []).map((entry) => <li key={entry.id}>
          <div><strong>{entry.author?.github_username || "Studio member"}</strong><span className={`review-status ${entry.decision}`}>{statusNames[entry.decision] || "Comment"}</span><time dateTime={entry.created_at}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</time></div>
          <MarkdownPreview>{entry.body}</MarkdownPreview>
        </li>)}
      </ol>
      {!review.feedback?.length && <p className="form-hint">No feedback yet. Start the conversation below.</p>}
      <form className="review-feedback" onSubmit={feedback}>
        <label>Feedback<textarea aria-label="Review feedback" required maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share specific, constructive feedback…" disabled={busy === "feedback"} /></label>
        {review.can_review && !preview && <label>Review decision<select aria-label="Review decision" value={decision} onChange={(event) => setDecision(event.target.value)} disabled={Boolean(busy)}><option value="comment">Comment only</option><option value="changes_requested">Request changes</option><option value="approved">Approve artwork</option></select></label>}
        {!review.can_review && <p className="form-hint">Studio members can comment. Review leads can approve or request changes.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={Boolean(busy) || !body.trim()}>{busy === "feedback" ? "Saving feedback…" : "Save feedback"}</button>
      </form>
    </section>
  );
}

export default function Reviews({ reviews, selectedId, onSelect, onUpdate, preview, query, showForm, onCloseForm }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!selectedId || preview) return;
    const controller = new AbortController();
    const request = async () => {
      setLoading(true);
      setError("");
      try {
        const review = await loadReview(selectedId, { signal: controller.signal });
        if (!controller.signal.aborted) setDetail(review);
      } catch (failure) {
        if (!controller.signal.aborted) setError(workspaceError(failure, "This review could not be loaded. Try again."));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    request();
    return () => controller.abort();
  }, [selectedId, preview, retry]);
  const selected = preview ? reviews.find((review) => review.id === selectedId) : detail?.id === selectedId ? detail : null;
  const filtered = reviews.filter((review) => `${review.ticket} ${review.title} ${review.project} ${review.author?.github_username || ""}`.toLowerCase().includes(query.toLowerCase()));

  function update(review) {
    setDetail(review);
    onUpdate(review);
  }

  return <>
    {selectedId ? loading ? <p className="empty-state" role="status">Loading review…</p> : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRetry((value) => value + 1)}>Retry review</button><button onClick={() => onSelect(null)}>All reviews</button></div> : selected ? <ReviewDetail key={selected.id} review={selected} preview={preview} onUpdate={update} onBack={() => onSelect(null)} /> : <p className="empty-state">Review not found.</p> : <div className="review-grid">
      {filtered.map((review) => <button className="review-card" key={review.id} onClick={() => onSelect(review.id)}>
        <div><span className="eyebrow">{review.ticket}</span><span className={`review-status ${review.status}`}>{statusNames[review.status] || review.status}</span></div>
        <h3>{review.title}</h3><p>{review.project}</p><span className="review-filename">{review.file_name}</span><small>{review.author?.github_username || "Studio member"} · {review.feedback?.length || 0} comments</small>
      </button>)}
      {!filtered.length && <p className="empty-state">No reviews yet. Submit an artifact to create a ticket and collect feedback.</p>}
    </div>}
    {showForm && <FileForm preview={preview} onClose={onCloseForm} onCreated={(review) => { update(review); onSelect(review.id); }} />}
  </>;
}
