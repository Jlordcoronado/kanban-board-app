import { beforeEach, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardShell } from '../src/component/DashboardShell';
import { AccountSettings } from '../src/pages/AccountSettings';
import type { Workspace } from '../src/types/workspace';

const workspaces: Workspace[] = [
  { id: 'personal', name: 'Personal', kind: 'personal', role: 'owner' },
  { id: 'team', name: 'Studio team', kind: 'team', role: 'member' },
];
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

function showShell(
  options: { onSignOut?: () => Promise<void>; workspaces?: Workspace[] } = {}
) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardShell
        workspaces={options.workspaces ?? workspaces}
        accountEmail="person@example.com"
        theme="light"
        onToggleTheme={vi.fn()}
        onSignOut={options.onSignOut ?? vi.fn().mockResolvedValue(undefined)}
      >
        <Routes>
          <Route path="/dashboard" element={<h1>Dashboard content</h1>} />
          <Route path="/boards/:id" element={<h1>Board content</h1>} />
          <Route path="/account" element={<h1>Settings content</h1>} />
        </Routes>
      </DashboardShell>
    </MemoryRouter>
  );
}

it('keeps personal and team destinations separate and identifies the active navigation item', async () => {
  const user = userEvent.setup();
  showShell();
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(
    within(nav).getByRole('link', { name: 'Personal board' })
  ).toHaveAttribute('href', '/boards/personal');
  const team = within(nav).getByRole('link', { name: 'Studio team, member' });
  expect(team).toHaveAttribute('href', '/boards/team');
  await user.click(team);
  expect(
    screen.getByRole('heading', { name: 'Board content' })
  ).toBeInTheDocument();
  expect(team).toHaveAttribute('aria-current', 'page');
  expect(
    within(nav).getByRole('link', { name: 'Personal board' })
  ).not.toHaveAttribute('aria-current');
});

it('retains readable navigation labels after collapsing and tolerates unavailable preference storage', async () => {
  const user = userEvent.setup();
  showShell();
  await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
  expect(localStorage.getItem('kanban-sidebar-collapsed-v1')).toBe('true');
  expect(
    screen.getByRole('button', { name: 'Expand sidebar' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Personal board' })
  ).toBeInTheDocument();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
  expect(
    screen.getByRole('button', { name: 'Collapse sidebar' })
  ).toBeInTheDocument();
});

it('uses a native navigation dialog that dismisses on Escape and restores the menu trigger', async () => {
  const user = userEvent.setup();
  showShell();
  const menu = screen.getByRole('button', { name: 'Open navigation' });
  await user.click(menu);
  const dialog = screen.getByRole('dialog', { name: 'Navigation' });
  expect(dialog).toHaveAttribute('open');
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(menu).toHaveFocus();
});

it('closes mobile navigation after a destination is selected', async () => {
  const user = userEvent.setup();
  showShell();
  await user.click(screen.getByRole('button', { name: 'Open navigation' }));
  await user.click(
    within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole(
      'link',
      { name: 'Personal board' }
    )
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Board content' })
  ).toBeInTheDocument();
});

it('leaves a failed sign-out retryable without losing the current content', async () => {
  const onSignOut = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  const user = userEvent.setup();
  showShell({ onSignOut });
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to sign out'
  );
  expect(
    screen.getByRole('heading', { name: 'Dashboard content' })
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry sign out' }));
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  );
  expect(onSignOut).toHaveBeenCalledTimes(2);
});

it('shows an honest empty team list and routes password reset through the existing recovery screen', async () => {
  const toggle = vi.fn();
  const user = userEvent.setup();
  const view = showShell({ workspaces: workspaces.slice(0, 1) });
  expect(screen.getByText('No teams yet')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /create team/i })
  ).not.toBeInTheDocument();
  view.unmount();
  render(
    <MemoryRouter>
      <AccountSettings
        accountEmail="person@example.com"
        theme="light"
        onToggleTheme={toggle}
      />
    </MemoryRouter>
  );
  expect(screen.getByText('person@example.com')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Reset password' })).toHaveAttribute(
    'href',
    '/forgot-password'
  );
  expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await user.click(screen.getByRole('button', { name: 'Light' }));
  expect(toggle).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Dark' }));
  expect(toggle).toHaveBeenCalledOnce();
});
