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
  expect(screen.getAllByText('Jaylord Coronado')).toHaveLength(2);
  expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'I build full-stack applications, integrate AI, and automate business workflows.'
  );
  expect(
    screen.getByText(
      /supported by three years of professional software development experience/
    )
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('link', { name: 'Contact me' })[0]
  ).toHaveAttribute(
    'href',
    'mailto:projlordcoronado@gmail.com?subject=Project%20or%20role%20inquiry'
  );
  for (const name of ['Kanban Desk', 'Explore Kanban Desk'])
    for (const link of screen.getAllByRole('link', { name }))
      expect(link).toHaveAttribute('href', '/kanban');
  expect(screen.getAllByRole('link', { name: 'LinkedIn' })[0]).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/jaylord-coronado/'
  );
  expect(screen.getAllByRole('link', { name: 'GitHub' })[0]).toHaveAttribute(
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
  const trigger = screen.getByRole('button', {
    name: 'View hero dashboard preview full size',
  });
  const image = within(
    screen.getByRole('figure', { name: 'Hero dashboard preview' })
  ).getByRole('img');
  expect(image).toHaveAttribute('width', '1280');
  expect(image).toHaveAttribute('height', '959');
  expect(
    within(
      screen.getByRole('figure', { name: 'Hero dashboard preview' })
    ).getByText('Signed-in dashboard')
  ).toBeInTheDocument();
  await userEvent.setup().click(trigger);
  const dialog = screen.getByRole('dialog', {
    name: 'Hero dashboard preview full size',
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

it.each(['Services', 'About', 'Projects', 'Contact'])(
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
    expect(link).toHaveAttribute('href', `/#${section.toLowerCase()}`);
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
  expect(
    within(
      screen.getByRole('figure', { name: 'Hero dashboard preview' })
    ).getByRole('img')
  ).toHaveAttribute('src', '/images/kanban-dashboard-dark.png');
  fireEvent.error(
    within(
      screen.getByRole('figure', { name: 'Hero dashboard preview' })
    ).getByRole('img')
  );
  expect(
    within(
      screen.getByRole('figure', { name: 'Hero dashboard preview' })
    ).getByRole('status')
  ).toHaveTextContent('preview could not load');
  expect(
    screen.getByRole('button', {
      name: 'View hero dashboard preview full size',
    })
  ).toHaveAttribute('aria-disabled', 'true');
  expect(
    screen.getAllByRole('link', { name: 'Explore Kanban Desk' })[0]
  ).toHaveAttribute('href', '/kanban');
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
    .click(screen.getAllByRole('link', { name: 'Explore Kanban Desk' })[0]);
  expect(window.location.pathname).toBe('/kanban');
  await userEvent
    .setup()
    .click(screen.getAllByRole('link', { name: 'Try as guest' })[0]);
  expect(window.location.pathname).toBe('/try');
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('My unfinished edit');
  expect(JSON.parse(localStorage.getItem(GUEST_KEY)!)).toEqual(guest);
  expect(
    screen.queryByRole('dialog', { name: 'Welcome to jlord.dev' })
  ).not.toBeInTheDocument();
});

it('presents one independent case study with lazy preview, source, implementation limits and reviewable suggestions', async () => {
  render(<App />);
  const region = screen.getByRole('region', { name: 'Projects', exact: true });
  expect(within(region).getAllByRole('article')).toHaveLength(1);
  expect(
    within(region).getByRole('link', { name: 'View source on GitHub' })
  ).toHaveAttribute(
    'href',
    'https://github.com/Jlordcoronado/kanban-board-app'
  );
  expect(
    within(region).getByRole('link', { name: 'View Kanban Desk' })
  ).toHaveAttribute('href', '/kanban');
  expect(
    within(region).getByText(
      /hosted account access and cloud behavior have not been verified/
    )
  ).toBeInTheDocument();
  expect(
    within(region).getByText(
      /Copying guest tasks to a cloud board is an explicit choice/
    )
  ).toBeInTheDocument();
  const preview = within(region).getByRole('figure', {
    name: 'Kanban Desk project preview',
  });
  expect(within(preview).getByRole('img')).toHaveAttribute('loading', 'lazy');
  expect(within(preview).getByRole('img')).toHaveAttribute('width', '1280');
  const trigger = within(preview).getByRole('button', {
    name: 'View kanban desk project preview full size',
  });
  await userEvent.setup().click(trigger);
  const dialog = screen.getByRole('dialog', {
    name: 'Kanban Desk project preview full size',
  });
  fireEvent.error(within(dialog).getByRole('img'));
  expect(within(dialog).getByRole('status')).toHaveTextContent(
    'preview could not load'
  );
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(trigger).toHaveFocus();
  expect(
    within(
      screen.getByRole('figure', { name: 'Hero dashboard preview' })
    ).getByRole('button')
  ).toHaveAttribute('aria-disabled', 'false');
});

it.each([true, false])(
  'reports clipboard success=%s and keeps the address available for manual copying',
  async (success) => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    if (success) write.mockResolvedValue();
    else write.mockRejectedValue(new Error('Clipboard unavailable'));
    render(<App />);
    const contact = screen.getByRole('region', {
      name: 'Contact',
      exact: true,
    });
    expect(
      within(contact).getByText('projlordcoronado@gmail.com')
    ).toBeInTheDocument();
    expect(
      within(contact).getByRole('link', { name: 'Contact me' })
    ).toHaveAttribute(
      'href',
      'mailto:projlordcoronado@gmail.com?subject=Project%20or%20role%20inquiry'
    );
    await user.click(
      within(contact).getByRole('button', { name: 'Copy email' })
    );
    expect(write).toHaveBeenCalledWith('projlordcoronado@gmail.com');
    expect(within(contact).getByRole('status')).toHaveTextContent(
      success
        ? 'Email address copied.'
        : 'Copying failed. Select the email address above and copy it manually.'
    );
    expect(
      within(contact).getByRole('button', { name: 'Copy email' })
    ).toBeEnabled();
  }
);

it('provides working footer section, profile and project links', async () => {
  const user = userEvent.setup();
  render(<App />);
  const footer = screen.getByRole('contentinfo');
  for (const name of ['Services', 'About', 'Projects', 'Contact']) {
    const link = within(footer).getByRole('link', { name });
    expect(link).toHaveAttribute('href', `/#${name.toLowerCase()}`);
    await user.click(link);
    expect(screen.getByRole('heading', { name, exact: true })).toHaveFocus();
  }
  expect(
    within(footer).getByRole('link', { name: 'Kanban Desk' })
  ).toHaveAttribute('href', '/kanban');
  expect(
    within(footer).getByRole('link', { name: 'LinkedIn' })
  ).toHaveAttribute('href', 'https://www.linkedin.com/in/jaylord-coronado/');
  expect(within(footer).getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/Jlordcoronado'
  );
});
