import { beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

const fixture = vi.hoisted(() => ({
  configured: false,
  session: null as Session | null,
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
}));
vi.mock('../src/auth/client', () => ({
  get supabase() {
    return fixture.configured ? { auth: fixture.auth } : null;
  },
  initialRecovery: false,
  callbackError: null,
  authRedirect: () => '/auth/callback',
  recoveryRedirect: () => '/reset-password',
}));
import App from '../src/App';
import { ScreenshotGallery } from '../src/component/ScreenshotGallery';
import { GUEST_KEY, GUEST_DRAFT } from '../src/lib/board';

beforeEach(() => {
  fixture.configured = false;
  fixture.session = null;
  fixture.auth.getSession.mockImplementation(async () => ({
    data: { session: fixture.session },
    error: null,
  }));
  fixture.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/kanban');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('fetch', vi.fn());
});

it('loads /kanban without cloud configuration or application reads and restores homepage metadata', async () => {
  const user = userEvent.setup();
  localStorage.setItem(GUEST_KEY, 'device work must remain untouched');
  localStorage.setItem(GUEST_DRAFT, 'unfinished draft');
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Your tasks, from to do to done.'
  );
  expect(document.title).toBe('Kanban Desk | Tasks, boards, and deadlines');
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
    'content',
    expect.stringContaining('example screens')
  );
  expect(
    screen.getByText(/Cloud accounts are unavailable/)
  ).toBeInTheDocument();
  for (const link of screen.getAllByRole('link', { name: 'Try as guest' }))
    expect(link).toHaveAttribute('href', '/try');
  expect(
    screen.queryByRole('link', { name: 'Create account' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Log in' })
  ).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  expect(localStorage.getItem(GUEST_KEY)).toBe(
    'device work must remain untouched'
  );
  expect(localStorage.getItem(GUEST_DRAFT)).toBe('unfinished draft');
  await user.click(screen.getByRole('link', { name: 'Jaylord Coronado' }));
  expect(window.location.pathname).toBe('/');
  expect(document.title).toBe(
    'Jaylord Coronado | Full-Stack Software Engineer'
  );
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
    'content',
    expect.stringContaining('developer role')
  );
  expect(fetch).not.toHaveBeenCalled();
});

it('offers configured account routes and focuses screenshot navigation without loading board data', async () => {
  fixture.configured = true;
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute(
    'href',
    '/signin'
  );
  for (const link of screen.getAllByRole('link', { name: 'Create account' }))
    expect(link).toHaveAttribute('href', '/signup');
  expect(
    screen.queryByText(/Cloud accounts are unavailable/)
  ).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole('link', { name: 'Screenshots' }));
  expect(
    screen.getByRole('heading', { name: 'Inside Kanban Desk' })
  ).toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
});

it('offers the dashboard to an authenticated visitor without loading workspaces or boards', async () => {
  fixture.configured = true;
  fixture.session = {
    access_token: 'test-only-session',
    user: { id: 'example', email: 'alex@example.com' },
  } as Session;
  render(<App />);
  await waitFor(() =>
    expect(
      screen.getAllByRole('link', { name: 'Open dashboard' })
    ).toHaveLength(3)
  );
  for (const link of screen.getAllByRole('link', { name: 'Open dashboard' }))
    expect(link).toHaveAttribute('href', '/dashboard');
  expect(
    screen.queryByRole('link', { name: 'Try as guest' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Create account' })
  ).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('waits for the existing session check before offering app entry', () => {
  fixture.configured = true;
  fixture.auth.getSession.mockImplementation(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getAllByRole('status')).toHaveLength(2);
  expect(
    screen.queryByRole('link', { name: 'Try as guest' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Open dashboard' })
  ).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps scroll restoration mounted when the session resolves on a public page', async () => {
  fixture.configured = true;
  let finish!: (value: { data: { session: Session }; error: null }) => void;
  fixture.auth.getSession.mockImplementation(
    () => new Promise((resolve) => (finish = resolve))
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('link', { name: 'Jaylord Coronado' }));
  await user.click(screen.getByRole('link', { name: 'View Kanban Desk' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  const scrollCalls = vi.mocked(window.scrollTo).mock.calls.length;

  await act(async () =>
    finish({
      data: {
        session: {
          access_token: 'test-only-session',
          user: { id: 'example', email: 'alex@example.com' },
        } as Session,
      },
      error: null,
    })
  );

  expect(screen.getAllByRole('link', { name: 'Open dashboard' })).toHaveLength(
    3
  );
  expect(window.scrollTo).toHaveBeenCalledTimes(scrollCalls);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
});

it('uses roving tab focus, wrapping arrows and Home/End while mounting only the selected screenshot', async () => {
  const user = userEvent.setup();
  render(<ScreenshotGallery theme="light" />);
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(7);
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('img')).toHaveLength(1);
  tabs[0].focus();
  await user.keyboard('{ArrowLeft}');
  expect(tabs[6]).toHaveFocus();
  expect(tabs[6]).toHaveAttribute('aria-selected', 'true');
  expect(tabs[0]).toHaveAttribute('tabindex', '-1');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Account settings');
  expect(screen.getByRole('img')).toHaveAttribute(
    'src',
    '/images/kanban-account-settings-light-desktop.webp'
  );
  await user.keyboard('{Home}{ArrowRight}');
  expect(tabs[1]).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Guest board');
  await user.keyboard('{End}{ArrowRight}');
  expect(tabs[0]).toHaveFocus();
  expect(screen.getAllByRole('img')).toHaveLength(1);
});

it('selects layouts and themes while preserving the chosen screen and preference', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('tab', { name: 'Edit task' }));
  await user.click(screen.getByRole('button', { name: 'Mobile', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(localStorage.getItem('kanban-theme')).toBe('dark');
  expect(screen.getByRole('tab', { name: 'Edit task' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(
    screen.getByRole('button', { name: 'Mobile', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  const image = screen.getByRole('img');
  expect(image).toHaveAttribute(
    'src',
    '/images/kanban-edit-task-dark-desktop.webp'
  );
  const source = image.closest('picture')!.querySelector('source')!;
  expect(source).toHaveAttribute('media', 'all');
  expect(source).toHaveAttribute(
    'srcset',
    '/images/kanban-edit-task-dark-mobile.webp'
  );
  expect(source).toHaveAttribute('width', '390');
  expect(source).toHaveAttribute('height', '845');
});

it('handles image failure, retry, dialog Escape, and focus restoration independently of other screens', async () => {
  const user = userEvent.setup();
  render(<ScreenshotGallery theme="light" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('status')).toHaveTextContent(
    'dashboard image could not load'
  );
  expect(
    screen.getByRole('button', { name: 'View dashboard full size' })
  ).toHaveAttribute('aria-disabled', 'true');
  await user.click(screen.getByRole('button', { name: 'Retry image' }));
  expect(screen.getByRole('img')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Task details' }));
  const trigger = screen.getByRole('button', {
    name: 'View task details full size',
  });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', {
    name: 'Task details example full size',
  });
  expect(dialog).toHaveAttribute('open');
  fireEvent.error(within(dialog).getByRole('img'));
  expect(within(dialog).getByRole('status')).toHaveTextContent(
    'task details image could not load'
  );
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry image' }));
  expect(trigger).toHaveAttribute('aria-disabled', 'false');
  await user.click(screen.getByRole('tab', { name: 'Dashboard' }));
  expect(
    screen.getByRole('button', { name: 'View dashboard full size' })
  ).toHaveAttribute('aria-disabled', 'false');
});

it('offers three native FAQ controls explaining guest copying and personal privacy', async () => {
  render(<App />);
  const questions = [...document.querySelectorAll('summary')];
  expect(questions).toHaveLength(3);
  for (const question of questions) {
    expect(question.parentElement).not.toHaveAttribute('open');
    await userEvent.setup().click(question);
    expect(question.parentElement).toHaveAttribute('open');
  }
  expect(
    screen.getByText(/Copying keeps the original guest board separate/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/does not share personal tasks with a team/)
  ).toBeInTheDocument();
});
