describe('Authentication', () => {
    it('redirects unauthenticated users to login', () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/login')
    })
  
    it('logs in via GitHub SSO and reaches dashboard', () => {
      cy.loginWithGitHub()
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
      cy.get('[data-testid="dashboard-header"]').should('be.visible')
    })
  
    it('rejects users not in the GitHub org', () => {
      cy.intercept('GET', '/api/auth/github/', {
        statusCode: 403,
        body: { error: 'Not a member of the required organization' }
      }).as('failedAuth')
  
      cy.visit('/login')
      cy.get('[data-testid="github-login-btn"]').click()
      cy.wait('@failedAuth')
      cy.get('[data-testid="auth-error"]').should('be.visible')
    })
  })