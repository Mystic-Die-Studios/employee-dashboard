describe("Authentication", () => {
  beforeEach(() => cy.viewport(1440, 1000));
  it("sends unauthenticated users back to the login page", () => {
    cy.signedOut();
    cy.visit("/dashboard");
    cy.url().should("eq", `${Cypress.config("baseUrl")}/`);
    cy.get('[data-testid="github-login-btn"]').should("be.visible");
  });

  it("starts the OAuth flow on the server", () => {
    cy.signedOut();
    cy.visit("/");

    // Intercept the navigation instead of stubbing non-configurable Location properties.
    cy.intercept("GET", "**/api/v1/user/github/login/", {
      statusCode: 200,
      body: "<html><body>OAuth flow started</body></html>",
      headers: { "content-type": "text/html" },
    }).as("githubLogin");

    cy.get('[data-testid="github-login-btn"]').click();
    cy.wait("@githubLogin")
      .its("request.url")
      .should("match", /\/api\/v1\/user\/github\/login\/$/);
  });

  it("reaches the dashboard once signed in", () => {
    cy.signedInAs();
    cy.visit("/dashboard");
    cy.wait("@userInfo");
    cy.get('[data-testid="dashboard-header"]').should("be.visible");
    cy.contains("testuser").should("be.visible");
  });

  it("explains why a user outside the org was rejected", () => {
    cy.signedOut();
    // The server bounces non-members back to the login page with this flag.
    cy.visit("/?error=not_org_member");
    cy.get('[data-testid="auth-error"]')
      .should("be.visible")
      .and("contain", "not a member");
  });
});
