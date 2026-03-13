import "@testing-library/jest-dom";
import { afterEach, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server";

// Start MSW mock server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

// Reset handlers between tests so they don't bleed
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Clean up after all tests are done
afterAll(() => server.close());
