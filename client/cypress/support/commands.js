// Auth is httpOnly-cookie based, so there is no token for a test to plant.
// Instead we stub the one endpoint the app uses to resolve the current user.
Cypress.Commands.add('signedInAs', (user = {}) => {
  cy.intercept('GET', '**/api/v1/user/info/', {
    statusCode: 200,
    body: {
      id: 1,
      username: 'testuser@company.com',
      email: 'testuser@company.com',
      github_username: 'testuser',
      role: 'employee',
      ...user,
    },
  }).as('userInfo');
});

Cypress.Commands.add('signedOut', () => {
  cy.intercept('GET', '**/api/v1/user/info/', {
    statusCode: 401,
    body: { detail: 'No authorization cookie found' },
  }).as('userInfo');
  cy.intercept('POST', '**/api/v1/user/token/refresh/', {
    statusCode: 401,
    body: { error: 'No token provided' },
  });
});
