import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import i18n from "../i18n/index.js";

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await i18n.changeLanguage("hi");
});

// jsdom does not implement these
window.scrollTo = () => {};
