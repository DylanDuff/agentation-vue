import { expect, it, vi } from "vitest";

// Models ESM interop where named React exports exist but default is absent.
vi.mock("react", () => ({ default: undefined,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: undefined,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: undefined,
}));
import { getSourceLocation } from "./source-location";

it("does not crash while probing a React namespace without a default export", () => {
  const element = document.createElement("button");
  Object.assign(element, { "__reactFiber$interop": {
    type: "button", return: { type: function Owner() {}, return: null },
  } });
  expect(() => getSourceLocation(element)).not.toThrow();
});
