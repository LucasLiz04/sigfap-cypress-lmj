import { kebabCase } from "change-case";
declare const require: (moduleName: string) => (value: string) => string;
const removeAccents = require("remove-accents");

export const unaccentedKebabCase = (str: string): string =>
  removeAccents(kebabCase(str));

export const toCyString = (value: string) =>
  unaccentedKebabCase(value)
    .substring(0, 32)
    .replace(/^[-]+|[-]+$/g, "");
