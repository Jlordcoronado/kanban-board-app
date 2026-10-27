import { beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/auth/client', () => ({
  supabase: null,
  initialRecovery: false,
  callbackError: null,
  authRedirect: () => '/auth/callback',
  recoveryRedirect: () => '/reset-password',
}));
import App from '../src/App';

let scrollY: number;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('react-router-scroll-positions', '{}');
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('fetch', vi.fn());
  scrollY = 0;
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
  vi.mocked(window.scrollTo).mockImplementation((_x, y) => {
    scrollY = y ?? 0;
  });
});

const navigationCases = (['light', 'dark'] as const).flatMap((theme) =>
  (['Projects', 'footer', 'developer credit'] as const).map((entry) => ({
    theme,
    entry,
  }))
);

it.each(navigationCases)(
  'starts at the top and focuses the destination from $entry in $theme mode',
  async ({ theme, entry }) => {
    const user = userEvent.setup();
    localStorage.setItem('kanban-theme', theme);
    if (entry === 'developer credit')
      window.history.replaceState({}, '', '/kanban');
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    const link =
      entry === 'Projects'
        ? within(
            screen.getByRole('region', { name: 'Projects', exact: true })
          ).getByRole('link', { name: 'View Kanban Desk' })
        : within(screen.getByRole('contentinfo')).getByRole('link', {
            name: entry === 'footer' ? 'Kanban Desk' : 'Jaylord Coronado',
            exact: true,
          });
    scrollY = 1800;
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    await user.click(link);

    expect(window.location.pathname).toBe(
      entry === 'developer credit' ? '/' : '/kanban'
    );
    expect(scrollY).toBe(0);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(localStorage.getItem('kanban-theme')).toBe(theme);
    expect(fetch).not.toHaveBeenCalled();
  }
);

it.each(['/', '/kanban'])(
  'does not focus a heading on initial load of %s',
  (path) => {
    window.history.replaceState({}, '', path);
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
  }
);

it('focuses the homepage after a pathname-changing replacement', async () => {
  window.history.replaceState({}, '', '/unknown-page');
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  expect(scrollY).toBe(0);
});

it('restores each history entry on Back/Forward without focusing public headings', async () => {
  const user = userEvent.setup();
  render(<App />);
  scrollY = 1400;
  await user.click(screen.getByRole('link', { name: 'View Kanban Desk' }));
  expect(scrollY).toBe(0);
  scrollY = 900;
  await user.click(screen.getByRole('link', { name: 'Jaylord Coronado' }));
  expect(scrollY).toBe(0);
  scrollY = 250;

  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe('/kanban'));
  expect(scrollY).toBe(900);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();

  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  expect(scrollY).toBe(1400);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();

  await act(async () => window.history.forward());
  await waitFor(() => expect(window.location.pathname).toBe('/kanban'));
  expect(scrollY).toBe(900);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();

  await act(async () => window.history.forward());
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  expect(scrollY).toBe(250);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
});

it.each([
  ['/#projects', 'projects'],
  ['/kanban#screenshots', 'screenshots'],
])('preserves the direct section URL %s', (path, id) => {
  window.history.replaceState({}, '', path);
  render(<App />);
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(
    document.getElementById(id)
  );
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
  expect(window.location.hash).toBe(`#${id}`);
});

it('gives section links distinct history entries and restores their saved positions', async () => {
  const user = userEvent.setup();
  render(<App />);
  const main = within(
    screen.getByRole('navigation', { name: 'Main navigation' })
  );
  await user.click(main.getByRole('link', { name: 'Services', exact: true }));
  const servicesKey = window.history.state.key;
  scrollY = 600;
  await user.click(main.getByRole('link', { name: 'About', exact: true }));
  expect(window.history.state.key).not.toBe(servicesKey);
  scrollY = 1200;
  await user.click(main.getByRole('link', { name: 'Projects', exact: true }));
  scrollY = 1800;

  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.hash).toBe('#about'));
  expect(scrollY).toBe(1200);
  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.hash).toBe('#services'));
  expect(scrollY).toBe(600);
  await act(async () => window.history.forward());
  await waitFor(() => expect(window.location.hash).toBe('#about'));
  expect(scrollY).toBe(1200);
  await act(async () => window.history.forward());
  await waitFor(() => expect(window.location.hash).toBe('#projects'));
  expect(scrollY).toBe(1800);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
});

it.each([
  ['/', 'website-main'],
  ['/kanban', 'kanban-main'],
])('preserves skip-link focus on %s', async (path, id) => {
  window.history.replaceState({}, '', path);
  render(<App />);
  await userEvent
    .setup()
    .click(screen.getByRole('link', { name: 'Skip to content' }));
  expect(document.getElementById(id)).toHaveFocus();
  expect(window.location.hash).toBe(`#${id}`);
});

it('keeps section, theme and gallery focus after public navigation', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('link', { name: 'View Kanban Desk' }));
  await user.click(screen.getByRole('link', { name: 'Screenshots' }));
  expect(
    screen.getByRole('heading', { name: 'Inside Kanban Desk' })
  ).toHaveFocus();
  await user.click(screen.getByRole('tab', { name: 'Edit task' }));
  expect(screen.getByRole('tab', { name: 'Edit task' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Mobile', exact: true }));
  expect(
    screen.getByRole('button', { name: 'Mobile', exact: true })
  ).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(
    screen.getByRole('button', { name: 'Switch to light mode' })
  ).toHaveFocus();

  await user.click(screen.getByRole('link', { name: 'Jaylord Coronado' }));
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Main navigation' })
    ).getByRole('link', { name: 'Projects' })
  );
  expect(
    screen.getByRole('heading', { name: 'Projects', exact: true })
  ).toHaveFocus();
  await user.click(
    screen.getByRole('button', { name: 'Switch to light mode' })
  );
  expect(
    screen.getByRole('button', { name: 'Switch to dark mode' })
  ).toHaveFocus();
});
