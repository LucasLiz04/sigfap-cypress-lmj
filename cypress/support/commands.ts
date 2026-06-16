import { toCyString } from "../helpers/kebab.helper";

Cypress.Commands.add("typeLogin", (username, password) => {
  cy.visit("/");
  cy.get('[data-cy="email"]').type(username);
  cy.get('[data-cy="senha"]').type(password);
  cy.get('[data-cy="loginButton"]').click(); //Botão Acessar da página principal
});

Cypress.Commands.add("byCy", (selector, options) => {
  return cy.get(`[data-cy="${selector}"]`, options);
});

Cypress.Commands.add("loginSigfap", () => {
  cy.env(["SIGFAP_EMAIL", "SIGFAP_PASSWORD"]).then(
    ({ SIGFAP_EMAIL: email, SIGFAP_PASSWORD: password }) => {
      if (!email || !password) {
        throw new Error(
          "Configure SIGFAP_EMAIL e SIGFAP_PASSWORD em cypress.env.json local ou variáveis de ambiente.",
        );
      }

      cy.intercept("POST", "**/api/login").as("loginRequest");
      cy.visit("/");
      cy.byCy("email").clear().type(email);
      cy.byCy("senha").clear().type(password, { log: false });
      cy.byCy("loginButton").click();
      cy.wait("@loginRequest")
        .its("response.statusCode")
        .should("be.oneOf", [200, 201]);
      cy.byCy("user-menu", { timeout: 20000 }).should("be.visible");
    },
  );
});

Cypress.Commands.add("openUserProfile", () => {
  cy.byCy("user-menu").click();
  cy.byCy("editar-perfil").click();
  cy.url().should("include", "/pesquisador/editar");
});

Cypress.Commands.add("fillByCy", (selector, value) => {
  const text = String(value);
  cy.byCy(selector, { timeout: 20000 })
    .should("be.visible")
    .clear({ force: true })
    .type(text, { force: true });
});

const getSelectCandidateDataCy = (selector: string) => {
  const lastSegment = selector.split(".").pop() || selector;
  const selectorWithoutId = selector.replace(/Id$/, "");
  const lastSegmentWithoutId = lastSegment.replace(/Id$/, "");
  return [
    selector,
    toCyString(selector),
    selectorWithoutId,
    toCyString(selectorWithoutId),
    lastSegment,
    toCyString(lastSegment),
    lastSegmentWithoutId,
    toCyString(lastSegmentWithoutId),
  ].filter((value, index, values) => values.indexOf(value) === index);
};

const openSelectByCandidates = (selector: string) => {
  const selectorCandidates = getSelectCandidateDataCy(selector);

  cy.get("body").then(($body) => {
    const openSelector = selectorCandidates
      .map((candidate) => `[data-cy="open-${candidate}"]`)
      .find((candidate) => $body.find(candidate).length);
    const inputSelector = selectorCandidates
      .map((candidate) => `[data-cy="${candidate}"]`)
      .find((candidate) => $body.find(candidate).length);

    if (openSelector) {
      cy.get(openSelector).click({ force: true });
    } else if (inputSelector) {
      cy.get(inputSelector).click({ force: true });
    } else {
      throw new Error(
        `Nao foi encontrado data-cy para selecionar "${selector}". Tentativas: ${selectorCandidates.join(", ")}`,
      );
    }
  });

  return cy.wrap(selectorCandidates, { log: false });
};

Cypress.Commands.add("selectByCyOption", (selector, optionLabel) => {
  const optionDataCy = toCyString(optionLabel);

  openSelectByCandidates(selector).then((selectorCandidates) => {
    cy.get("body").then(($openedBody) => {
      const searchSelector = selectorCandidates
        .map((candidate) => `[data-cy="search-${candidate}"]`)
        .find((candidate) => $openedBody.find(candidate).length);

      if (searchSelector) {
        cy.get(searchSelector).clear({ force: true }).type(optionLabel, {
          force: true,
        });
      }
    });

    cy.byCy(optionDataCy, { timeout: 10000 }).click({ force: true });
  });
});

Cypress.Commands.add("selectFirstByCyOption", (selector) => {
  openSelectByCandidates(selector).then((selectorCandidates) => {
    cy.get("body").then(($openedBody) => {
      const searchSelector = selectorCandidates
        .map((candidate) => `[data-cy="search-${candidate}"]`)
        .find((candidate) => $openedBody.find(candidate).length);

      if (searchSelector) {
        cy.get(searchSelector).clear({ force: true });
      }
    });

    cy.get('[data-available-index], [role="option"]', { timeout: 10000 })
      .not('[aria-disabled="true"]')
      .should("have.length.greaterThan", 0)
      .first()
      .click({ force: true });
  });
});

Cypress.Commands.add("saveCurrentStep", () => {
  cy.intercept({ method: "+(POST|PUT|PATCH)", url: "**/api/**" }).as(
    "saveRequest",
  );
  cy.byCy("menu-salvar").click();
  cy.wait("@saveRequest", { timeout: 20000 });
});
