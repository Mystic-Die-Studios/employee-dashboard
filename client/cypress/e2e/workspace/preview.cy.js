describe("Studio workspace preview", () => {
  beforeEach(() => {
    cy.viewport(1440, 1000);
    cy.intercept("**/api/v1/**", { statusCode: 503, body: {} }).as(
      "previewApi",
    );
    cy.clearLocalStorage();
    cy.visit("/preview");
  });

  it("opens without authentication and creates a document that survives refresh", () => {
    cy.viewport(1440, 1000);
    cy.contains("Your next great idea starts here.").should("be.visible");
    cy.get("@previewApi.all").should("have.length", 0);
    cy.document().then((doc) => {
      cy.wrap(doc.documentElement.scrollWidth).should("be.at.most", 1440);
    });
    cy.screenshot("studio-workspace-desktop", {
      capture: "viewport",
      scale: true,
    });
    cy.contains("button", "New page").click();
    cy.get('[aria-label="Document title"]')
      .clear()
      .type("Playtest observations");
    cy.get('[aria-label="Document content"]').type(
      "The opening scene needs a clearer objective.",
    );
    cy.reload();
    cy.contains("Your next great idea starts here.").should("be.visible");
    cy.contains("button", "Documents").click();
    cy.get('[aria-label="Search documents"]').type("Playtest");
    cy.contains(".document-card", "Playtest observations").click();
    cy.get('[aria-label="Document content"]').should(
      "have.value",
      "The opening scene needs a clearer objective.",
    );
  });

  it("creates a task, moves it across the board, and keeps its status", () => {
    cy.contains("button", "Projects").click();
    cy.contains("button", "New task").click();
    cy.get("dialog").should("be.visible");
    cy.get('input[name="title"]').type("Prepare the next demo");
    cy.contains("button", "Create task").click();
    cy.contains(".task-card", "Prepare the next demo").within(() => {
      cy.get("select").select("Done");
    });
    cy.reload();
    cy.contains("Your next great idea starts here.").should("be.visible");
    cy.contains("button", "Projects").click();
    cy.contains(".column-heading h3", "Done")
      .closest(".kanban-column")
      .should("contain", "Prepare the next demo");
    cy.contains("button", "My tasks").click();
    cy.contains(".task-row", "Prepare the next demo")
      .find("input")
      .should("be.checked");
  });

  it("dismisses the task dialog with Escape and restores focus", () => {
    cy.contains("button", "Projects").click();
    cy.contains("button", "New task").click();
    cy.get('input[name="title"]').type("{esc}");
    cy.get("dialog").should("not.exist");
    cy.contains("button", "New task").should("have.focus");
  });

  it("keeps navigation and content accessible on a narrow screen", () => {
    cy.viewport(390, 844);
    cy.contains("Your next great idea starts here.").should("be.visible");
    cy.get('[aria-label="Open navigation"]').click();
    cy.contains("button", "Documents").click();
    cy.get('[aria-label="Search documents"]').should("be.visible");
    cy.screenshot("studio-workspace-mobile", {
      capture: "viewport",
      scale: true,
    });
    cy.document().then((doc) => {
      cy.wrap(doc.documentElement.scrollWidth).should("be.at.most", 390);
    });
  });
});
