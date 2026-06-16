declare namespace Cypress {
  interface Chainable {
    typeLogin: (email: string, password: string) => void;
    byCy: (
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ) => Chainable<JQuery<HTMLElement>>;
    loginSigfap: () => void;
    openUserProfile: () => void;
    fillByCy: (selector: string, value: string | number) => void;
    selectByCyOption: (selector: string, optionLabel: string) => void;
    selectFirstByCyOption: (selector: string) => void;
    saveCurrentStep: () => void;
  }
}
