import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom does not implement the native dialog top layer.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
  this.querySelector<HTMLElement>('button, input')?.focus();
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
