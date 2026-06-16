type CadastroFixture = {
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    estado: string;
    municipio: string;
  };
  dadosAcademicos: {
    instituicao: string;
    unidade: string;
    nivelAcademico: string;
    lattes: string;
    linkedin: string;
  };
  dadosProfissionais: {
    possuiVinculoInstitucional: boolean;
    tipoVinculoInstitucional: string;
    regimeTrabalho: string;
    inicioServico: string;
    funcao: string;
    possuiVinculoEmpregaticio: boolean;
  };
  documentosPessoais: {
    arquivo: string;
  };
};

const openProfileSection = (sectionName: string) => {
  // O stepper do perfil nao expoe data-cy por etapa; os rotulos abaixo sao fixos da propria navegacao.
  cy.contains(sectionName, { timeout: 10000 }).click({ force: true });
  cy.contains(sectionName).should("be.visible");
};

const ensureCheckboxState = (selector: string, checked: boolean) => {
  const inputSelector = `[data-cy="${selector}"]`;
  const boxSelector = `[data-cy="${selector}-box"]`;

  cy.get("body").then(($body) => {
    const $input = $body.find(inputSelector);
    const $box = $body.find(boxSelector);

    if (!$input.length && !$box.length) {
      throw new Error(`Nao foi encontrado checkbox com data-cy "${selector}".`);
    }

    const isChecked = $input.length
      ? Boolean($input.prop("checked"))
      : $box.attr("aria-checked") === "true" ||
        $box.attr("data-state") === "checked";

    if (isChecked !== checked) {
      cy.get(boxSelector).click({ force: true });
    }
  });
};

const selectFirstVisibleOption = () => {
  cy.get('[data-available-index], [role="option"]', { timeout: 10000 })
    .filter(":visible")
    .should("have.length.greaterThan", 0)
    .first()
    .click({ force: true });
};

describe("Finalização do Cadastro do proponente", () => {
  beforeEach(() => {
    cy.loginSigfap();
    cy.openUserProfile();
    cy.fixture("completar-cadastro").as("cadastro");
  });

  it("F-01/F-02 - autentica e navega ate a area de perfil do proponente", () => {
    cy.byCy("user-menu").should("be.visible");
    cy.url().should("include", "/pesquisador/editar");
    cy.byCy("next-button").should("be.visible");
  });

  it("F-03/F-04/F-05 - valida mascara, obrigatoriedade e persistencia do endereco", function () {
    const { endereco } = this.cadastro as CadastroFixture;

    openProfileSection("Endereço");

    cy.byCy("endereco.cep").clear({ force: true });
    cy.byCy("endereco.cep").should(($input) => {
      expect($input.val()).to.equal("");
      expect(
        $input.prop("required") || $input.attr("aria-required") === "true",
      ).to.equal(true);
    });

    cy.fillByCy("endereco.cep", endereco.cep.replace("-", ""));
    cy.byCy("endereco.cep").should("have.value", endereco.cep);
    cy.fillByCy("endereco.logradouro", endereco.logradouro);
    cy.fillByCy("endereco.numero", endereco.numero);
    cy.fillByCy("endereco.complemento", endereco.complemento);
    cy.fillByCy("endereco.bairro", endereco.bairro);
    cy.selectByCyOption("endereco.estado", endereco.estado);
    cy.selectByCyOption("endereco.municipio", endereco.municipio);
    cy.saveCurrentStep();

    cy.byCy("endereco.cep").should("have.value", endereco.cep);
    cy.byCy("endereco.logradouro").should("have.value", endereco.logradouro);
  });

  it("F-02/F-05 - preenche e persiste dados academicos", function () {
    const { dadosAcademicos } = this.cadastro as CadastroFixture;

    openProfileSection("Dados acadêmicos");

    cy.selectFirstByCyOption("instituicaoId");
    cy.selectFirstByCyOption("unidadeId");
    cy.selectFirstByCyOption("nivelAcademicoId");
    cy.fillByCy("lattes", dadosAcademicos.lattes);
    cy.fillByCy("linkedin", dadosAcademicos.linkedin);
    cy.saveCurrentStep();

    cy.byCy("lattes").should("have.value", dadosAcademicos.lattes);
    cy.byCy("linkedin").should("have.value", dadosAcademicos.linkedin);
  });

  it("F-02/F-05 - preenche e persiste dados profissionais", function () {
    const { dadosProfissionais } = this.cadastro as CadastroFixture;

    openProfileSection("Dados profissionais");

    if (dadosProfissionais.possuiVinculoInstitucional) {
      ensureCheckboxState("possui-vinculo-institucional", true);
      cy.byCy("open-tipo-vinculo-institucional", {
        timeout: 10000,
      }).should("be.visible");
    }

    cy.selectFirstByCyOption("vinculoInstitucional.tipoVinculoInstitucionalId");
    cy.selectFirstByCyOption("vinculoInstitucional.regimeTrabalhoId");
    cy.fillByCy(
      "vinculoInstitucional.inicioServico",
      dadosProfissionais.inicioServico,
    );
    cy.fillByCy("vinculoInstitucional.funcao", dadosProfissionais.funcao);
    cy.saveCurrentStep();

    cy.byCy("vinculoInstitucional.funcao").should(
      "have.value",
      dadosProfissionais.funcao,
    );
  });

  it("F-02/F-05 - submete documento pessoal do proponente", function () {
    const { documentosPessoais } = this.cadastro as CadastroFixture;

    openProfileSection("Documentos Pessoais");

    // O select de tipo de documento nao expoe data-cy; a alternativa estavel aqui e o unico controle com placeholder fixo da secao.
    cy.contains("Selecione uma opção", { timeout: 10000 }).click({
      force: true,
    });
    selectFirstVisibleOption();

    // O componente de upload nao expoe data-cy no input de arquivo; o input file nativo e o alvo estavel.
    cy.get('input[type="file"]', { timeout: 10000 }).selectFile(
      documentosPessoais.arquivo,
      { force: true },
    );
    cy.saveCurrentStep();
  });
});
