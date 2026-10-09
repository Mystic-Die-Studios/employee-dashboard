// Auth uses httpOnly cookies. Stub the authenticated API boundary rather than
// planting tokens or contacting the live organization during browser tests.
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
  cy.intercept('GET', '**/api/v1/workspace/', {
    statusCode: 200,
    body: {
      documents: [],
      tasks: [],
      reviews: [],
      members: [{ id: 1, github_username: 'testuser', role: 'employee', ...user }],
    },
  }).as('workspace');
  cy.intercept('GET', '**/api/v1/user/csrf/', {
    statusCode: 200,
    body: { csrfToken: 'a'.repeat(64) },
  }).as('csrf');
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
  cy.intercept('GET', '**/api/v1/user/csrf/', {
    statusCode: 200,
    body: { csrfToken: 'a'.repeat(64) },
  }).as('csrf');
});
