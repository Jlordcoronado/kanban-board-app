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

const choiceKey = 'kanban-account-choice-v1';
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

it.each(['guest', 'close', 'escape'])(
  'remembers first-visit dismissal by %s and focuses Add task',
  async (method) => {
    const view = render(<App />);
    const user = userEvent.setup();
    const welcome = screen.getByRole('dialog', {
      name: 'Welcome to jlord.dev',
    });
    expect(welcome).toHaveAttribute('open');
    expect(
      within(welcome).getByText('Guest work saves in this browser.')
    ).toBeInTheDocument();
    if (method === 'escape')
      fireEvent(welcome, new Event('cancel', { cancelable: true }));
    else
      await user.click(
        within(welcome).getByRole('button', {
          name: method === 'guest' ? 'Continue as guest' : 'Close',
        })
      );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add task', exact: true })
    ).toHaveFocus();
    expect(localStorage.getItem(choiceKey)).toBe('seen');
    view.unmount();
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Log in', exact: true });
    await user.click(trigger);
    const login = screen.getByRole('dialog', { name: 'Log in' });
    expect(within(login).getByLabelText('Email')).toBeInTheDocument();
    await user.click(within(login).getByRole('button', { name: 'Close' }));
    expect(trigger).toHaveFocus();
  }
);

it('remembers Log in immediately, switches forms in the same dialog, and focuses the board on initial dismissal', async () => {
  render(<App />);
  const user = userEvent.setup();
  const welcome = screen.getByRole('dialog', { name: 'Welcome to jlord.dev' });
  await user.click(within(welcome).getByRole('button', { name: 'Log in' }));
  expect(localStorage.getItem(choiceKey)).toBe('seen');
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBe(welcome);
  await user.click(screen.getByRole('link', { name: 'Create an account' }));
  expect(screen.getByRole('dialog', { name: 'Create your account' })).toBe(
    welcome
  );
  await user.click(screen.getByRole('link', { name: 'Log in' }));
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBe(welcome);
  fireEvent(welcome, new Event('cancel', { cancelable: true }));
  expect(
    screen.getByRole('button', { name: 'Add task', exact: true })
  ).toHaveFocus();
});

it('retains dismissal through route changes in the same app session when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Continue as guest' }));
  for (const path of ['/forgot-password', '/']) {
    await act(async () => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Log in', exact: true }));
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBeInTheDocument();
});

it.each([
  '/auth/callback',
  '/reset-password',
  '/forgot-password',
  '/signin',
  '/signup',
])('skips the welcome screen on %s', (path) => {
  window.history.replaceState({}, '', path);
  render(<App />);
  expect(
    screen.queryByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).not.toBeInTheDocument();
});

it('keeps board controls outside the header and preserves both themes', async () => {
  localStorage.setItem(choiceKey, 'seen');
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
  expect(
    within(boardControls).getByRole('button', { name: 'Add task' })
  ).toBeInTheDocument();
  expect(
    within(boardControls).getByRole('button', { name: 'Add column' })
  ).toBeInTheDocument();
  expect(
    within(boardControls).getByRole('button', { name: 'Archive all' })
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
