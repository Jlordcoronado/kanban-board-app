import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../src/auth/client', () => ({
  supabase: null,
  initialRecovery: false,
  callbackError: null,
  authRedirect: () => '/auth/callback',
  recoveryRedirect: () => '/reset-password',
}));
import App from '../src/App';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/try');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

it.each(['close', 'escape'])(
  'opens guest access without a welcome prompt and restores login focus after %s',
  async (method) => {
    render(<App />);
    const user = userEvent.setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Log in', exact: true });
    await user.click(trigger);
    const login = screen.getByRole('dialog', { name: 'Log in' });
    expect(within(login).getByLabelText('Email')).toBeInTheDocument();
    if (method === 'escape')
      fireEvent(login, new Event('cancel', { cancelable: true }));
    else await user.click(within(login).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  }
);

it('switches account forms in the same dialog', async () => {
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  const login = screen.getByRole('dialog', { name: 'Log in' });
  await user.click(screen.getByRole('link', { name: 'Create an account' }));
  expect(screen.getByRole('dialog', { name: 'Create your account' })).toBe(
    login
  );
  await user.click(screen.getByRole('link', { name: 'Log in' }));
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBe(login);
});

it('does not reintroduce the welcome prompt when storage is unavailable or routes change', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  render(<App />);
  for (const path of ['/forgot-password', '/', '/try']) {
    await act(async () => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBeInTheDocument();
});

it.each([
  '/',
  '/auth/callback',
  '/reset-password',
  '/forgot-password',
  '/signin',
  '/signup',
])('keeps %s free of an automatic account-choice dialog', (path) => {
  window.history.replaceState({}, '', path);
  render(<App />);
  expect(
    screen.queryByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).not.toBeInTheDocument();
});

it('keeps board controls outside the header and preserves both themes', async () => {
  render(<App />);
  const user = userEvent.setup();
  const header = screen.getByRole('banner');
  expect(
    within(header).getByRole('button', { name: 'Log in' })
  ).toBeInTheDocument();
  expect(
    within(header).queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
  const boardControls = screen.getByRole('region', { name: 'Board' });
  for (const name of ['Add task', 'Add column', 'Archive all'])
    expect(
      within(boardControls).getByRole('button', { name })
    ).toBeInTheDocument();
  expect(within(boardControls).getByRole('status')).toHaveTextContent(
    'Saved on this device'
  );
  await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(document.documentElement).toHaveClass('dark');
  await user.click(
    screen.getByRole('button', { name: 'Switch to light mode' })
  );
  expect(document.documentElement).not.toHaveClass('dark');
});
