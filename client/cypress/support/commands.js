Cypress.Commands.add('loginWithGitHub', () => {
    cy.intercept('GET', '/api/auth/github/', {
      statusCode: 200,
      body: {
        access: 'fake-jwt-access-token',
        refresh: 'fake-jwt-refresh-token',
        user: {
          username: 'testuser',
          email: 'testuser@company.com',
          github_username: 'testuser'
        }
      }
    }).as('githubAuth')
  
    // set the token directly in localStorage as if OAuth completed
    cy.window().then((win) => {
      win.localStorage.setItem('access_token', 'fake-jwt-access-token')
    })
  })