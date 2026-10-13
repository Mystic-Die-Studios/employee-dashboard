/* global expect */

const documentId = "10000000-0000-4000-8000-000000000001";
const taskId = "20000000-0000-4000-8000-000000000001";
const reviewId = "30000000-0000-4000-8000-000000000001";
const member = { id: 1, github_username: "testuser", role: "employee" };
const timestamp = "2026-10-09T12:00:00Z";

function documentRecord(changes = {}) {
  return {
    id: documentId,
    title: "Server studio wiki",
    category: "Studio wiki",
    icon: "✦",
    body: "# Studio guidelines\n\nKeep feedback constructive.",
    updated: "Just now",
    updated_at: timestamp,
    version: 1,
    created_by: 1,
    can_delete: true,
    ...changes,
  };
}

function taskRecord(changes = {}) {
  return {
    id: taskId,
    title: "Prepare the production playtest",
    project: "Project Reconnection",
    status: "To do",
    priority: "Medium",
    person: "You",
    assignee: 1,
    can_edit: true,
    ...changes,
  };
}

function reviewRecord(changes = {}) {
  return {
    id: reviewId,
    ticket: "ART-300000000000",
    title: "Opening scene concept",
    project: "Project Reconnection",
    description: "## Direction\n\nReview the silhouette and lighting.",
    author: { id: 1, github_username: "testuser" },
    file_name: "opening-scene.png",
    file_size: 68,
    download_url: `/api/v1/workspace/reviews/${reviewId}/file/`,
    status: "submitted",
    github_sync_status: "not_configured",
    github_issue_url: null,
    created_at: timestamp,
    feedback: [],
    can_review: false,
    can_sync: true,
    ...changes,
  };
}

function serverWorkspace(changes = {}) {
  return { documents: [], tasks: [], reviews: [], members: [member], ...changes };
}

function signIn(workspace, user = {}) {
  cy.signedInAs(user);
  cy.intercept("GET", "**/api/v1/workspace/", (request) => {
    request.reply({ statusCode: 200, body: workspace });
  }).as("workspaceLoaded");
  cy.intercept("GET", `**/api/v1/workspace/reviews/${reviewId}/`, (request) => {
    request.reply({ statusCode: 200, body: workspace.reviews[0] });
  }).as("reviewLoaded");
}

function openDashboard() {
  cy.visit("/dashboard");
  cy.wait("@workspaceLoaded");
  cy.get('[data-testid="dashboard-header"]').should("be.visible");
}

function openReview() {
  cy.contains("button", "Reviews").click();
  cy.contains(".review-card", "Opening scene concept").click();
  cy.wait("@reviewLoaded");
  cy.get('[aria-label="Review ticket"]').should("be.visible");
}

function selectArtifact() {
  cy.get('input[name="file"]').selectFile({
    contents: Cypress.Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aImYAAAAASUVORK5CYII=",
      "base64",
    ),
    fileName: "opening-scene.png",
    mimeType: "image/png",
  });
}

function fillReviewForm() {
  cy.contains("button", "New review").click();
  cy.get("dialog").should("be.visible");
  cy.get('input[name="title"]').type("Opening scene concept");
  cy.get('input[name="project"]').type("Project Reconnection");
  cy.get('textarea[name="description"]').type("Review the silhouette and lighting.");
  selectArtifact();
}

describe("Authenticated studio platform", () => {
  beforeEach(() => {
    cy.viewport(1440, 1000);
    cy.clearLocalStorage();
  });

  it("saves a wiki page to the server and safely previews Markdown", () => {
    const workspace = serverWorkspace();
    signIn(workspace);
    cy.intercept("GET", "https://images.example.invalid/private.png", {
      statusCode: 200,
      body: "",
    }).as("remoteImage");
    cy.intercept("POST", "**/api/v1/workspace/documents/", (request) => {
      expect(request.headers["x-csrftoken"]).to.equal("a".repeat(64));
      workspace.documents = [documentRecord({ ...request.body, body: "" })];
      request.reply({ statusCode: 201, body: workspace.documents[0] });
    }).as("createDocument");
    cy.intercept("PATCH", `**/api/v1/workspace/documents/${documentId}/`, (request) => {
      expect(request.body.version).to.equal(1);
      expect(request.headers["x-csrftoken"]).to.equal("a".repeat(64));
      workspace.documents[0] = { ...workspace.documents[0], ...request.body, version: 2 };
      request.reply({ statusCode: 200, body: workspace.documents[0] });
    }).as("saveDocument");
    const markdown = [
      "# Playtest wiki",
      "",
      "- [x] Confirm the opening objective",
      "",
      "[Studio reference](https://example.com/reference)",
      "",
      "<img src=x onerror=\"window.wikiXss=true\">",
      "",
      "[Unsafe link](javascript:alert(1))",
      "",
      "![Private concept](https://images.example.invalid/private.png)",
    ].join("\n");

    openDashboard();
    cy.contains("button", "New page").click();
    cy.wait("@createDocument");
    cy.get('[aria-label="Document title"]').clear().type("Production playtest wiki");
    // Cypress renders Markdown in command logs, including remote images. Keep
    // the test payload out of that log so this measures requests from the app.
    cy.get('[aria-label="Document content"]').clear().type(markdown, { parseSpecialCharSequences: false, log: false });
    cy.contains("button", "Preview").click();
    cy.get('[aria-label="Markdown preview"]').within(() => {
      cy.contains("h1", "Playtest wiki").should("be.visible");
      cy.contains("a", "Studio reference").should("have.attr", "href", "https://example.com/reference");
      cy.get("img, script").should("not.exist");
      cy.contains("a", "Unsafe link").should("not.have.attr", "href", "javascript:alert(1)");
      cy.contains("Image: Private concept").should("be.visible");
    });
    cy.window().its("wikiXss").should("not.exist");
    cy.get("@remoteImage.all").then((requests) => {
      expect(requests.map(({ request }) => `${request.method} ${request.url} (${request.resourceType})`), "private image requests").to.deep.equal([]);
    });
    cy.contains("button", "Save page").click();
    cy.wait("@saveDocument").its("request.body.body").should("equal", markdown);
    cy.reload();
    cy.wait("@workspaceLoaded");
    cy.contains("button", "Documents").click();
    cy.contains(".document-card", "Production playtest wiki").click();
    cy.get('[aria-label="Document content"]').should("have.value", markdown);
  });

  it("keeps an unsaved wiki draft when another member updates the page", () => {
    const workspace = serverWorkspace({ documents: [documentRecord()] });
    signIn(workspace);
    cy.intercept("PATCH", `**/api/v1/workspace/documents/${documentId}/`, (request) => {
      if (request.body.version === 1) {
        workspace.documents[0] = documentRecord({ body: "A teammate's newer draft", version: 2 });
        request.reply({
          statusCode: 409,
          body: {
            detail: "Another member updated this page. Reload the server version before saving.",
            document: workspace.documents[0],
          },
        });
      } else {
        expect(request.body.version).to.equal(2);
        workspace.documents[0] = { ...workspace.documents[0], ...request.body, version: 3 };
        request.reply({ statusCode: 200, body: workspace.documents[0] });
      }
    }).as("conflictingSave");

    openDashboard();
    cy.contains("button", "Documents").click();
    cy.contains(".document-card", "Server studio wiki").click();
    cy.get('[aria-label="Document content"]').clear().type("My unsaved production notes");
    cy.contains("button", "Save page").click();
    cy.wait("@conflictingSave");
    cy.contains(/Another member (changed|updated)/).should("be.visible");
    cy.get('[aria-label="Document content"]').should("have.value", "My unsaved production notes");
    cy.contains("button", "Save page").should("be.disabled");
    cy.contains("button", "Compare with saved page").click();
    cy.wait("@workspaceLoaded");
    cy.get(".document-conflict").should("contain", "A teammate's newer draft");
    cy.contains("button", "Use latest version for this draft").click();
    cy.get('[aria-label="Document content"]').should("have.value", "My unsaved production notes");
    cy.contains("button", "Save page").click();
    cy.wait("@conflictingSave").its("request.body.body").should("equal", "My unsaved production notes");
    cy.get(".document-conflict").should("not.exist");
  });

  it("creates server tasks and keeps the saved status after a failed update", () => {
    const workspace = serverWorkspace();
    signIn(workspace);
    cy.intercept("POST", "**/api/v1/workspace/tasks/", (request) => {
      workspace.tasks = [taskRecord(request.body)];
      request.reply({ statusCode: 201, body: workspace.tasks[0] });
    }).as("createTask");
    let unavailable = true;
    cy.intercept("PATCH", `**/api/v1/workspace/tasks/${taskId}/`, (request) => {
      if (unavailable) {
        request.reply({ forceNetworkError: true });
      } else {
        workspace.tasks[0] = { ...workspace.tasks[0], ...request.body };
        request.reply({ statusCode: 200, body: workspace.tasks[0] });
      }
    }).as("saveTask");

    openDashboard();
    cy.contains("button", "Projects").click();
    cy.contains("button", "New task").click();
    cy.get('input[name="title"]').type("Prepare the production playtest");
    cy.contains("button", "Create task").click();
    cy.wait("@createTask");
    cy.get('[aria-label="Status for Prepare the production playtest"]').select("Done");
    cy.wait("@saveTask");
    cy.get('[aria-label="Status for Prepare the production playtest"]').should("have.value", "To do");
    cy.get('[role="alert"]').should("be.visible");
    cy.then(() => { unavailable = false; });
    cy.get('[aria-label="Status for Prepare the production playtest"]').select("Done");
    cy.wait("@saveTask").its("request.body.status").should("equal", "Done");
    cy.reload();
    cy.wait("@workspaceLoaded");
    cy.contains("button", "My tasks").click();
    cy.contains(".task-row", "Prepare the production playtest").find('input[type="checkbox"]').should("be.checked");
  });

  it("uploads an artifact and persists employee feedback without approval controls", () => {
    const workspace = serverWorkspace();
    signIn(workspace);
    cy.intercept("POST", "**/api/v1/workspace/reviews/", (request) => {
      expect(request.headers["content-type"]).to.include("multipart/form-data");
      expect(request.headers["x-csrftoken"]).to.equal("a".repeat(64));
      workspace.reviews = [reviewRecord()];
      request.reply({ statusCode: 201, body: workspace.reviews[0] });
    }).as("uploadReview");
    cy.intercept("POST", `**/api/v1/workspace/reviews/${reviewId}/feedback/`, (request) => {
      expect(request.body.decision).to.equal("comment");
      workspace.reviews[0] = {
        ...workspace.reviews[0],
        feedback: [{ id: "feedback-1", ...request.body, author: member, created_at: timestamp }],
      };
      request.reply({ statusCode: 201, body: workspace.reviews[0] });
    }).as("saveFeedback");

    openDashboard();
    cy.contains("button", "Reviews").click();
    fillReviewForm();
    cy.contains("button", "Submit for review").click();
    cy.wait("@uploadReview");
    cy.wait("@reviewLoaded");
    cy.get('[aria-label="Review ticket"]').should("contain", "ART-300000000000");
    cy.contains("button", "Download artifact").should("be.visible");
    cy.contains("GitHub connection not configured. Your studio review is saved.").should("be.visible");
    cy.get('[aria-label="Review decision"]').should("not.exist");
    cy.get('[aria-label="Review feedback"]').type("The silhouette reads clearly; keep this direction.");
    cy.contains("button", "Save feedback").click();
    cy.wait("@saveFeedback");
    cy.get(".review-history").should("contain", "The silhouette reads clearly; keep this direction.");
    cy.scrollTo("top");
    cy.screenshot("studio-review-desktop", { capture: "viewport", scale: true });
    cy.viewport(390, 844);
    cy.document().then((doc) => {
      cy.wrap(doc.documentElement.scrollWidth).should("be.at.most", 390);
    });
    cy.screenshot("studio-review-mobile", { capture: "viewport", scale: true });
    cy.viewport(1440, 1000);
    cy.reload();
    cy.wait("@workspaceLoaded");
    openReview();
    cy.get(".review-history").should("contain", "The silhouette reads clearly; keep this direction.");
  });

  it("preserves the review upload form when the server rejects the artifact", () => {
    const workspace = serverWorkspace();
    signIn(workspace);
    cy.intercept("POST", "**/api/v1/workspace/reviews/", {
      statusCode: 400,
      body: { file: ["The artifact could not be stored. Try another file."] },
    }).as("failedUpload");

    openDashboard();
    cy.contains("button", "Reviews").click();
    fillReviewForm();
    cy.contains("button", "Submit for review").click();
    cy.wait("@failedUpload");
    cy.get("dialog").should("be.visible");
    cy.get('input[name="title"]').should("have.value", "Opening scene concept");
    cy.get('input[name="file"]').then(($input) => {
      expect($input[0].files[0].name).to.equal("opening-scene.png");
    });
    cy.get('[role="alert"]').should("contain", "artifact could not be stored");
    cy.get(".review-card").should("not.exist");
  });

  it("lets a lead approve another artist but hides self-approval controls", () => {
    const workspace = serverWorkspace({ reviews: [reviewRecord({ can_review: true })] });
    signIn(workspace, { id: 2, role: "admin", github_username: "review-lead" });
    cy.intercept("POST", `**/api/v1/workspace/reviews/${reviewId}/feedback/`, (request) => {
      expect(request.body.decision).to.equal("approved");
      workspace.reviews[0] = {
        ...workspace.reviews[0],
        status: "approved",
        feedback: [{ id: "approval-1", ...request.body, author: { id: 2, github_username: "review-lead" }, created_at: timestamp }],
      };
      request.reply({ statusCode: 201, body: workspace.reviews[0] });
    }).as("approveReview");

    openDashboard();
    openReview();
    cy.get('[aria-label="Review feedback"]').type("Approved for production.");
    cy.get('[aria-label="Review decision"]').select("approved");
    cy.contains("button", "Save feedback").click();
    cy.wait("@approveReview");
    cy.get(".review-status.approved").should("be.visible");
    cy.then(() => {
      workspace.reviews[0] = reviewRecord({ author: { id: 2, github_username: "review-lead" }, can_review: false });
    });
    cy.reload();
    cy.wait("@workspaceLoaded");
    openReview();
    cy.get('[aria-label="Review decision"]').should("not.exist");
  });

  it("keeps feedback text when server permissions deny the change", () => {
    const workspace = serverWorkspace({ reviews: [reviewRecord({ can_review: true })] });
    signIn(workspace, { id: 2, role: "admin", github_username: "review-lead" });
    cy.intercept("POST", `**/api/v1/workspace/reviews/${reviewId}/feedback/`, {
      statusCode: 403,
      body: { detail: "Review permissions changed." },
    }).as("deniedFeedback");

    openDashboard();
    openReview();
    cy.get('[aria-label="Review feedback"]').type("The new version needs clearer lighting.");
    cy.get('[aria-label="Review decision"]').select("changes_requested");
    cy.contains("button", "Save feedback").click();
    cy.wait("@deniedFeedback");
    cy.get('[role="alert"]').should("contain", "do not have permission");
    cy.get('[aria-label="Review feedback"]').should("have.value", "The new version needs clearer lighting.");
    cy.get(".review-history li").should("not.exist");
    cy.get(".review-status.submitted").should("contain", "Awaiting review");
  });

  it("shows a workspace load failure and retries instead of displaying demo data", () => {
    const workspace = serverWorkspace({ documents: [documentRecord()] });
    signIn(workspace);
    let unavailable = true;
    cy.intercept("GET", "**/api/v1/workspace/", (request) => {
      request.reply(unavailable
        ? { statusCode: 503, body: { detail: "The studio database is temporarily unavailable." } }
        : { statusCode: 200, body: workspace });
    }).as("workspaceRetry");

    cy.visit("/dashboard");
    cy.wait("@workspaceRetry");
    cy.get('[role="alert"]').should("contain", "studio database is temporarily unavailable");
    cy.get(".document-card, .task-card").should("not.exist");
    cy.contains("Welcome to Mystic Die").should("not.exist");
    cy.then(() => { unavailable = false; });
    cy.contains("button", "Retry").click();
    cy.wait("@workspaceRetry");
    cy.contains("Server studio wiki").should("be.visible");
  });

  it("preserves open page drafts while switching tabs and using browser history", () => {
    const workspace = serverWorkspace({ documents: [
      documentRecord(),
      documentRecord({ id: "10000000-0000-4000-8000-000000000002", title: "Environment reference notes" }),
    ] });
    signIn(workspace);

    openDashboard();
    cy.contains("button", "Documents").click();
    cy.contains(".document-card", "Server studio wiki").click();
    cy.get('[aria-label="Document content"]').clear().type("An unsaved note worth keeping");
    cy.contains("button", "Documents").click();
    cy.contains(".document-card", "Environment reference notes").click();
    cy.get('[aria-label="Document title"]').should("have.value", "Environment reference notes");
    cy.get('[aria-label="Open documents"]').contains("button", "Server studio wiki").click();
    cy.get('[aria-label="Document content"]').should("have.value", "An unsaved note worth keeping");
    cy.go("back");
    cy.get('[aria-label="Document title"]').should("have.value", "Environment reference notes");
    cy.go("forward");
    cy.get('[aria-label="Document content"]').should("have.value", "An unsaved note worth keeping");
  });

  it("loads the team when an administrator has no linked GitHub username", () => {
    const workspace = serverWorkspace({ members: [
      member,
      { id: 2, github_username: null, role: "admin" },
    ] });
    signIn(workspace);

    openDashboard();
    cy.contains("button", "Team").click();
    cy.get(".team-panel").should("have.length", 2);
    cy.contains(".team-panel", "testuser").should("be.visible");
    cy.contains(".team-panel h2", "Studio member").closest(".team-panel").should("contain", "admin");
  });

  it("retries partially failed GitHub sync while keeping the saved issue link", () => {
    const issueUrl = "https://github.com/Mystic-Die-Studios/test-fixture/issues/42";
    const workspace = serverWorkspace({ reviews: [reviewRecord({
      github_sync_status: "failed",
      github_issue_url: issueUrl,
    })] });
    signIn(workspace);
    cy.intercept("POST", `**/api/v1/workspace/reviews/${reviewId}/github/`, (request) => {
      workspace.reviews[0] = { ...workspace.reviews[0], github_sync_status: "synced" };
      request.reply({ statusCode: 200, body: workspace.reviews[0] });
    }).as("retryGithub");

    openDashboard();
    openReview();
    cy.contains("a", "View GitHub issue").should("have.attr", "href", issueUrl);
    cy.contains("GitHub issue sync failed. Your studio review is saved.").should("be.visible");
    cy.contains("button", "Retry GitHub sync").click();
    cy.wait("@retryGithub");
    cy.contains("a", "View GitHub issue").should("have.attr", "href", issueUrl);
    cy.contains("button", "Retry GitHub sync").should("not.exist");
    cy.contains("GitHub issue sync failed").should("not.exist");
  });

  it("keeps the authenticated workspace open when logout fails", () => {
    const workspace = serverWorkspace({ documents: [documentRecord()] });
    signIn(workspace);
    cy.intercept("POST", "**/api/v1/user/logout/", {
      statusCode: 503,
      body: { detail: "Sign out is temporarily unavailable." },
    }).as("failedLogout");

    openDashboard();
    cy.get('[aria-label="Log out"]').click();
    cy.wait("@failedLogout");
    cy.location("pathname").should("equal", "/dashboard");
    cy.get('[data-testid="dashboard-header"]').should("be.visible");
    cy.get('[role="alert"]').should("be.visible");
    cy.get('[aria-label="Log out"]').should("not.be.disabled");
  });
});
