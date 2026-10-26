import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../src/auth/client', () => ({
  supabase: null,
  initialRecovery: false,
  callbackError: null,
  authRedirect: () => '/auth/callback',
  recoveryRedirect: () => '/reset-password',
}));
import App from '../src/App';
import { defaultColumns, GUEST_DRAFT, GUEST_KEY } from '../src/lib/board';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

it('renders approved public copy and working contact, profile and app links without cloud configuration or requests', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<App />);
  expect(screen.getByText('Jaylord Coronado')).toBeInTheDocument();
  expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'I build full-stack applications, integrate AI, and automate business workflows.'
  );
  expect(
    screen.getByText(
      /supported by three years of professional software development experience/
    )
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Contact me' })).toHaveAttribute(
    'href',
    'mailto:projlordcoronado@gmail.com?subject=Project%20or%20role%20inquiry'
  );
  for (const name of ['Kanban Desk', 'Explore Kanban Desk'])
    for (const link of screen.getAllByRole('link', { name }))
      expect(link).toHaveAttribute('href', '/try');
  expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/jaylord-coronado/'
  );
  expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/Jlordcoronado'
  );
  expect(
    screen.queryByRole('button', { name: 'Add task' })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it('enlarges the labeled real dashboard preview, handles Escape, and restores focus', async () => {
  render(<App />);
  const trigger = screen.getByRole('button', { name: 'View full size' });
  const image = screen.getByRole('img');
  expect(image).toHaveAttribute('width', '1280');
  expect(image).toHaveAttribute('height', '959');
  expect(screen.getByText('Signed-in dashboard')).toBeInTheDocument();
  await userEvent.setup().click(trigger);
  const dialog = screen.getByRole('dialog', {
    name: 'Kanban Desk signed-in dashboard',
  });
  expect(dialog).toHaveAttribute('open');
  expect(within(dialog).getByRole('img')).toHaveAttribute(
    'src',
    '/images/kanban-dashboard-light.png'
  );
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it.each(['Services', 'About'])(
  'moves focus to %s through its navigation link without loading application data',
  async (section) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<App />);
    const region = screen.getByRole('region', { name: section, exact: true });
    const heading = within(region).getByRole('heading', {
      name: section,
      level: 2,
    });
    const link = within(
      screen.getByRole('navigation', { name: 'Main navigation' })
    ).getByRole('link', { name: section });
    expect(link).toHaveAttribute('href', `#${section.toLowerCase()}`);
    expect(heading).toHaveAttribute('id', section.toLowerCase());
    await userEvent.setup().click(link);
    expect(heading).toHaveFocus();
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Add task' })
    ).not.toBeInTheDocument();
  }
);

it('switches and persists theme and shows a useful preview failure state', async () => {
  render(<App />);
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(document.documentElement).toHaveClass('dark');
  expect(localStorage.getItem('kanban-theme')).toBe('dark');
  expect(screen.getByRole('img')).toHaveAttribute(
    'src',
    '/images/kanban-dashboard-dark.png'
  );
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('status')).toHaveTextContent(
    'preview could not load'
  );
  expect(screen.getByRole('button', { name: 'View full size' })).toBeDisabled();
  expect(
    screen.getByRole('link', { name: 'Explore Kanban Desk' })
  ).toHaveAttribute('href', '/try');
});

it('preserves guest tasks, custom columns, storage keys and an editor draft when entering /try', async () => {
  const task = {
    id: 'local-one',
    title: 'My saved task',
    description: '',
    priority: 'medium',
    status: 'review',
    startedAt: null,
    dueDate: null,
    expectedFinishAt: null,
  };
  const draft = { ...task, title: 'My unfinished edit' };
  const guest = {
    version: 1,
    deviceId: 'example-device',
    revision: 2,
    columns: [...defaultColumns(), { id: 'review', title: 'Review' }],
    tasks: [task],
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  localStorage.setItem(GUEST_DRAFT, JSON.stringify(draft));
  render(<App />);
  expect(localStorage.getItem(GUEST_DRAFT)).toBe(JSON.stringify(draft));
  await userEvent
    .setup()
    .click(screen.getByRole('link', { name: 'Explore Kanban Desk' }));
  expect(window.location.pathname).toBe('/try');
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('My unfinished edit');
  expect(JSON.parse(localStorage.getItem(GUEST_KEY)!)).toEqual(guest);
  expect(
    screen.queryByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).not.toBeInTheDocument();
});
