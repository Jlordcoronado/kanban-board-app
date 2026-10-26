import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { supabase } from '../auth/client';
import type { ThemeProps } from '../component/AuthLayout';
import { PublicThemeToggle } from '../component/PublicThemeToggle';
import { ScreenshotGallery } from '../component/ScreenshotGallery';
import '../css/personal-website.css';
import '../css/kanban-introduction.css';

const comparison = [
  {
    topic: 'Saving',
    guest: 'A board saved in this browser on this device.',
    account: 'Cloud boards saved through the backend.',
  },
  {
    topic: 'Overview',
    guest: 'Tasks organized in a local Kanban board.',
    account:
      'A dashboard with task counts, overdue work, and upcoming deadlines.',
  },
  {
    topic: 'Personal work',
    guest: 'Device-local tasks, without registration.',
    account: 'A private personal board, separate from team work.',
  },
  {
    topic: 'Team work',
    guest: 'Local board only.',
    account:
      'Boards for teams you already belong to, with workspace role permissions.',
  },
  {
    topic: 'AI descriptions',
    guest: 'Write and edit descriptions yourself.',
    account:
      'Request a Gemini suggestion, review it, then choose whether to apply and save it.',
  },
];
const faqs = [
  {
    question: 'Where are my guest tasks saved?',
    answer:
      'Guest tasks, columns, and archives stay in browser storage on this device. Clearing browser data removes them. After signing in, you can explicitly choose Copy to cloud or Keep on this device. Copying keeps the original guest board separate.',
  },
  {
    question: 'What does an account add?',
    answer:
      'When cloud access is configured, an account adds cloud saving, a task dashboard, a private personal board, and access to existing team memberships. AI description suggestions require an explicit request, review before applying, and a separate save. Team creation, invitation, archive browsing, and activity-history screens are still planned.',
  },
  {
    question: 'Who can see my personal tasks?',
    answer:
      'Your account’s personal board is private to you. Team tasks belong to their team workspace and follow its membership and role permissions. Seeing personal and team tasks together in your dashboard does not share personal tasks with a team.',
  },
];

function AppActions() {
  const { session, loading } = useAuth();
  if (loading) return <p role="status">Checking your session…</p>;
  return (
    <div className="website-actions">
      <Link
        className="website-button website-primary"
        to={session ? '/dashboard' : '/try'}
      >
        {session ? 'Open dashboard' : 'Try as guest'}
      </Link>
      {!session && supabase && (
        <Link className="website-button website-secondary" to="/signup">
          Create account
        </Link>
      )}
    </div>
  );
}

export default function KanbanIntroduction(props: ThemeProps) {
  const { session, loading, error } = useAuth();
  const screenshots = useRef<HTMLHeadingElement>(null);
  return (
    <div className="personal-website kanban-introduction">
      <a className="website-skip" href="#kanban-main">
        Skip to content
      </a>
      <header className="website-header">
        <Link className="website-brand" to="/kanban">
          Kanban Desk
        </Link>
        <nav className="website-navigation" aria-label="Product navigation">
          <a
            href="#screenshots"
            onClick={() => screenshots.current?.focus({ preventScroll: true })}
          >
            Screenshots
          </a>
          {!loading &&
            (session ? (
              <Link to="/dashboard">Open dashboard</Link>
            ) : supabase ? (
              <Link to="/signin">Log in</Link>
            ) : null)}
          <PublicThemeToggle {...props} />
        </nav>
      </header>
      <main id="kanban-main" className="website-main" tabIndex={-1}>
        <section
          className="kanban-product-intro"
          aria-labelledby="kanban-headline"
        >
          {error && (
            <p className="website-session-error" role="alert">
              {error}
            </p>
          )}
          <h1 id="kanban-headline">Your tasks, from to do to done.</h1>
          <p>
            Organize work into stages, set priorities and deadlines, and open
            each task to review its details. Start with a guest board on this
            device.
          </p>
          <AppActions />
          {!supabase && (
            <p className="kanban-cloud-status">
              Cloud accounts are unavailable in this version. You can still use
              the guest board without an account.
            </p>
          )}
        </section>
        <section className="kanban-section" aria-labelledby="screenshots">
          <h2 id="screenshots" ref={screenshots} tabIndex={-1}>
            Inside Kanban Desk
          </h2>
          <p className="kanban-section-intro">
            Example screens from the application in light and dark themes.
            Account screens use sample data and do not establish verified hosted
            account access.
          </p>
          <ScreenshotGallery theme={props.theme} />
        </section>
        <section className="kanban-section" aria-labelledby="saving-title">
          <h2 id="saving-title">
            Start on this device. Choose cloud saving later.
          </h2>
          <p className="kanban-section-intro">
            Guest work stays in this browser. Clearing browser data removes it.
            Moving guest tasks into a cloud board always asks for your choice.
          </p>
          <div
            className="kanban-comparison"
            role="region"
            aria-label="Guest and account comparison"
            tabIndex={0}
          >
            <table>
              <caption>Guest and account capabilities</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Account, when configured</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.topic}>
                    <th scope="row">{row.topic}</th>
                    <td>{row.guest}</td>
                    <td>{row.account}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kanban-section-intro">
            Personal boards stay private. A dashboard can show your personal and
            team tasks together without moving personal work into a team board.
          </p>
        </section>
        <section className="kanban-section" aria-labelledby="faq-title">
          <h2 id="faq-title">Before you start</h2>
          <div className="kanban-faq">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
          <AppActions />
        </section>
      </main>
      <footer className="website-footer">
        <p>
          Built by <Link to="/">Jaylord Coronado</Link>. See the development
          work behind Kanban Desk.
        </p>
      </footer>
    </div>
  );
}
