import { toCyString, unaccentedKebabCase } from "../helpers/kebab.helper";

type PropostaFixture = {
  edital: {
    id?: number | string;
    nome: string;
  };
  caracterizacao: {
    titulo: string;
    duracao: number;
    tipoEvento: string;
    estadoExecucao: string;
    municipioExecucao: string;
    instituicaoExecutora: string;
    unidadeExecutora: string;
  };
  apresentacao: {
    textoDescritivo: string;
    producao: string;
  };
  anexos: {
    arquivo: string;
  };
};

const toCyStringWithLength = (value: string, length: number) =>
  unaccentedKebabCase(value)
    .substring(0, length)
    .replace(/^[-]+|[-]+$/g, "");

const getEditalDataCyCandidates = (nomeEdital: string) =>
  [
    `editais-${toCyStringWithLength(nomeEdital, 16)}`,
    `editais-${toCyString(nomeEdital)}`,
    `edital-${toCyStringWithLength(nomeEdital, 16)}`,
    `edital-${toCyString(nomeEdital)}`,
  ].filter((value, index, values) => values.indexOf(value) === index);

const collectRecords = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.reduce<Record<string, unknown>[]>(
      (records, item) => records.concat(collectRecords(item)),
      [],
    );
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const nestedKeys = ["data", "content", "items", "results", "rows", "editais"];
  const records = [record];

  nestedKeys.forEach((key) => {
    records.push(...collectRecords(record[key]));
  });

  return records;
};

const findEditalIdFromResponse = (
  responseBody: unknown,
  nomeEdital: string,
) => {
  const edital = collectRecords(responseBody).find((record) =>
    Object.keys(record).some((key) => record[key] === nomeEdital),
  );

  const id =
    edital?.id ??
    edital?.editalId ??
    edital?.idEdital ??
    edital?.["id-edital"];

  return typeof id === "number" || typeof id === "string" ? String(id) : null;
};

const loginFromCurrentPageIfNeeded = () => {
  cy.get("body", { timeout: 20000 }).then(($body) => {
    if ($body.find('[data-cy="user-menu"]').length) {
      cy.byCy("user-menu").should("be.visible");
      return;
    }

    if (!$body.find('[data-cy="email"]').length) {
      cy.byCy("user-menu", { timeout: 20000 }).should("be.visible");
      return;
    }

    cy.env(["SIGFAP_EMAIL", "SIGFAP_PASSWORD"]).then(
      ({ SIGFAP_EMAIL: email, SIGFAP_PASSWORD: password }) => {
        if (!email || !password) {
          throw new Error(
            "Configure SIGFAP_EMAIL e SIGFAP_PASSWORD em cypress.env.json local ou variáveis de ambiente.",
          );
        }

        cy.intercept("POST", "**/api/login").as("loginRequest");
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
};

const visitLoggedHome = () => {
  cy.visit("/");
  loginFromCurrentPageIfNeeded();
};

const openTargetEdital = (edital: PropostaFixture["edital"]) => {
  const nomeEdital = edital.nome;
  const fixtureEditalId =
    typeof edital.id === "number" || typeof edital.id === "string"
      ? String(edital.id)
      : "";
  const editalDataCyCandidates = getEditalDataCyCandidates(nomeEdital);

  visitLoggedHome();
  cy.intercept("GET", "**/api/**edital**").as("editalRequest");
  cy.byCy("editais-ver-mais", { timeout: 20000 }).click();
  cy.wait("@editalRequest").then((interception) => {
    const editalId = findEditalIdFromResponse(
      interception.response?.body,
      nomeEdital,
    );

    cy.get("body").then(($body) => {
      const editalSelector = editalDataCyCandidates
        .map((candidate) => `[data-cy="${candidate}"]`)
        .find((candidate) => $body.find(candidate).length);
      const idLink = editalId || fixtureEditalId;

      if (idLink) {
        // A lista de editais nao expoe data-cy consistente para todos os cards no ambiente; usa o id conhecido da API/fixture.
        cy.visit(`/edital/${idLink}/detalhes`);
        return;
      }

      if (editalSelector) {
        cy.get(editalSelector).click({ force: true });
        return;
      }

      const directLink = $body
        .find('a[href*="/edital/"][href*="/detalhes"]')
        .filter((_, element) =>
          (element.textContent || "").includes(nomeEdital),
        )
        .first()
        .attr("href");

      if (directLink) {
        // A lista de editais nao expoe data-cy consistente para o card do edital; usa o link renderizado do proprio card.
        cy.visit(directLink);
        return;
      }

      // Fallback final: o nome do edital vem de fixture e e estavel para a massa da atividade.
      cy.contains(nomeEdital, { timeout: 10000 }).click({ force: true });
    });
  });
  cy.url().should("match", /\/edital\/\d+\/detalhes/);
};

const openOrCreateProposal = (fixture: PropostaFixture) => {
  const editalId =
    typeof fixture.edital.id === "number" || typeof fixture.edital.id === "string"
      ? String(fixture.edital.id)
      : "";

  openTargetEdital(fixture.edital);
  cy.get("body").then(($detailBody) => {
    if ($detailBody.find('[data-cy="editar-proposta-button"]').length) {
      cy.byCy("editar-proposta-button").first().click();
      return;
    }

    if ($detailBody.find('[data-cy="editar-proposta-action"]').length) {
      cy.byCy("editar-proposta-action").first().click();
      return;
    }

    cy.byCy("criar-proposta", { timeout: 20000 }).click();
    cy.get("body").then(($bodyAfterCreate) => {
      if ($bodyAfterCreate.text().includes("Você já possui uma proposta")) {
        cy.contains("button", "Confirmar", { timeout: 10000 }).click({
          force: true,
        });
      }
    });

    if (editalId) {
      cy.visit(`/edital/${editalId}/proposta/adicionar`);
    }
  });

  cy.url({ timeout: 20000 }).should(
    "match",
    /\/proposta\/(adicionar|editar)|\/edital\/\d+\/proposta\/adicionar/,
  );
};

const fillCaracterizacao = (fixture: PropostaFixture) => {
  cy.byCy("titulo", { timeout: 20000 }).should("be.visible");
  cy.fillByCy("titulo", fixture.caracterizacao.titulo);
  cy.fillByCy("duracao", fixture.caracterizacao.duracao);
  cy.selectByCyOption("tipoEventoId", fixture.caracterizacao.tipoEvento);
  cy.selectByCyOption(
    "estadoExecucaoEventoId",
    fixture.caracterizacao.estadoExecucao,
  );
  cy.selectByCyOption(
    "municipioExecucaoEventoId",
    fixture.caracterizacao.municipioExecucao,
  );
  cy.selectByCyOption(
    "instituicaoExecutoraId",
    fixture.caracterizacao.instituicaoExecutora,
  );
  cy.selectByCyOption(
    "unidadeExecutoraId",
    fixture.caracterizacao.unidadeExecutora,
  );
  cy.saveCurrentStep();
};

const goToNextProposalSection = () => {
  cy.byCy("next-button").click();
};

const openProposalSection = (sectionName: string) => {
  cy.contains(sectionName, { timeout: 10000 }).click({ force: true });
  cy.contains(sectionName, { timeout: 10000 }).should("be.visible");
};

const selectProposalAttachment = (filePath: string) => {
  cy.get("body").then(($body) => {
    if ($body.find('[data-cy="documentoPropostaAnexo"]').length) {
      return cy
        .byCy("documentoPropostaAnexo", { timeout: 10000 })
        .selectFile(filePath, { force: true });
    }

    // O upload de anexo pode nao expor data-cy no input nativo; usa o input file semantico.
    return cy
      .get('input[type="file"]', { timeout: 10000 })
      .selectFile(filePath, { force: true });
  });
};

describe("Submissão de Proposta em edital vigente", () => {
  beforeEach(() => {
    cy.loginSigfap();
    cy.fixture("submeter-proposta").as("proposta");
  });

  it("F-01/F-06/F-07 - autentica, encontra edital vigente e inicializa proposta", function () {
    const proposta = this.proposta as PropostaFixture;

    openOrCreateProposal(proposta);
    fillCaracterizacao(proposta);
  });

  it("F-08/F-09 - reabre proposta em edicao e navega entre secoes", function () {
    const proposta = this.proposta as PropostaFixture;

    openOrCreateProposal(proposta);
    fillCaracterizacao(proposta);

    goToNextProposalSection();
    cy.byCy("prev-button").should("be.visible");
    cy.byCy("menu-salvar").should("be.visible");

    goToNextProposalSection();
    cy.byCy("prev-button").click();
    cy.byCy("next-button").should("be.visible");
  });

  it("F-10/F-11 - valida anexos e verificacao de pendencias antes da submissao", function () {
    const proposta = this.proposta as PropostaFixture;

    openOrCreateProposal(proposta);
    fillCaracterizacao(proposta);

    goToNextProposalSection();
    goToNextProposalSection();

    // A pergunta descritiva dinamica nao expoe data-cy no ambiente.
    // Usa o rotulo da pergunta e o textarea semantico como alternativa estavel.
    cy.contains(/Pergunta Edital .*M[ií]nimo 10.*M[aá]ximo 20 caracteres/, {
      timeout: 10000,
    })
      .parents()
      .filter((_, element) => Cypress.$(element).find("textarea").length > 0)
      .first()
      .find("textarea")
      .first()
      .clear({ force: true })
      .type(proposta.apresentacao.textoDescritivo, { force: true });
    cy.saveCurrentStep();

    openProposalSection("Anexos");
    openProposalSection("Documentos da proposta");

    selectProposalAttachment(proposta.anexos.arquivo);
    cy.saveCurrentStep();

    openProposalSection("Finalização");
    cy.intercept("GET", "**/api/proposta/minhas-propostas/*/evaluations").as(
      "pendencyRequest",
    );
    cy.byCy("menu-verificar-pendencias", { timeout: 20000 }).click();
    cy.wait("@pendencyRequest", { timeout: 20000 });
  });

  it("F-12 - submete definitivamente a proposta somente quando RUN_SUBMISSION=true", function () {
    const proposta = this.proposta as PropostaFixture;

    openOrCreateProposal(proposta);
    fillCaracterizacao(proposta);

    goToNextProposalSection();
    goToNextProposalSection();
    goToNextProposalSection();
    goToNextProposalSection();

    cy.intercept("GET", "**/api/proposta/minhas-propostas/*/evaluations").as(
      "pendencyRequest",
    );
    cy.byCy("menu-verificar-pendencias", { timeout: 20000 }).click();
    cy.wait("@pendencyRequest", { timeout: 20000 });

    cy.env(["RUN_SUBMISSION"]).then(function ({ RUN_SUBMISSION }) {
      if (RUN_SUBMISSION !== true) {
        cy.log(
          "Submissao definitiva ignorada. Defina RUN_SUBMISSION=true para executar F-12.",
        );
        this.skip();
      }

      cy.intercept("PUT", "**/api/proposta/*/submeter").as(
        "submissionRequest",
      );
      cy.byCy("menu-submeter-proposta", { timeout: 20000 }).click();
      cy.wait("@submissionRequest", { timeout: 20000 })
        .its("response.statusCode")
        .should("be.oneOf", [200, 201, 204]);
    });
  });
});
