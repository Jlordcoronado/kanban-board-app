import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import type { ThemeProps } from '../component/AuthLayout';
import { Dialog } from '../component/Dialog';
import { dashboardPreview } from '../lib/projectPreview';
import '../css/personal-website.css';

const contact =
  'mailto:projlordcoronado@gmail.com?subject=Project%20or%20role%20inquiry';

function ProjectPreview({ theme }: Pick<ThemeProps, 'theme'>) {
  const [enlarged, setEnlarged] = useState(false);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const preview = (
    <img
      src={dashboardPreview[theme]}
      width={dashboardPreview.width}
      height={dashboardPreview.height}
      alt={dashboardPreview.alt}
      fetchPriority="high"
      onError={() => setFailed(true)}
    />
  );
  const unavailable = (
    <p role="status" className="website-preview-error">
      The dashboard preview could not load. You can still explore Kanban Desk
      using the link beside the introduction.
    </p>
  );
  return (
    <figure className="website-project">
      <div className="website-preview-frame">
        {failed ? unavailable : preview}
      </div>
      <figcaption>
        <div className="website-project-labels">
          <span className="website-project-name">Kanban Desk</span>
          <span>Personal project</span>
          <span>Signed-in dashboard</span>
        </div>
        <div className="website-preview-actions">
          <span>Example tasks</span>
          <button
            ref={trigger}
            type="button"
            disabled={failed}
            aria-haspopup="dialog"
            onClick={() => setEnlarged(true)}
          >
            View full size
          </button>
        </div>
      </figcaption>
      {enlarged && (
        <Dialog
          title="Kanban Desk signed-in dashboard"
          className="website-preview-dialog"
          returnFocusRef={trigger}
          onClose={() => setEnlarged(false)}
          dismissOnBackdrop
        >
          <h2>Kanban Desk</h2>
          <p>Signed-in dashboard with example tasks.</p>
          {failed ? unavailable : preview}
        </Dialog>
      )}
    </figure>
  );
}

export default function PersonalWebsite({ theme, onToggleTheme }: ThemeProps) {
  const { error } = useAuth();
  return (
    <div className="personal-website">
      <a className="website-skip" href="#website-main">
        Skip to content
      </a>
      <header className="website-header">
        <Link className="website-brand" to="/" aria-label="jlord.dev home">
          jlord.dev
        </Link>
        <nav className="website-navigation" aria-label="Main navigation">
          <Link to="/try">Kanban Desk</Link>
          <a className="website-header-contact" href={contact}>
            Contact
          </a>
          <button
            className="website-theme"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {theme === 'light' ? (
                <path d="M20.8 13.2A8.7 8.7 0 0 1 10.8 3a9 9 0 1 0 10 10.2Z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              )}
            </svg>
          </button>
        </nav>
      </header>
      <main id="website-main" className="website-main" tabIndex={-1}>
        {error && (
          <p className="website-session-error" role="alert">
            {error} <Link to="/signin">Log in</Link>
          </p>
        )}
        <div className="website-hero">
          <section
            className="website-introduction"
            aria-labelledby="website-headline"
          >
            <p className="website-name">Jaylord Coronado</p>
            <p className="website-title">Full-Stack Software Engineer</p>
            <h1 id="website-headline">
              I build full-stack applications, integrate AI, and automate
              business workflows.
            </h1>
            <p className="website-description">
              I work across user interfaces, backend systems, databases, and
              integrations, supported by three years of professional software
              development experience.
            </p>
            <div className="website-actions">
              <a className="website-button website-primary" href={contact}>
                Contact me
              </a>
              <Link className="website-button website-secondary" to="/try">
                Explore Kanban Desk
              </Link>
            </div>
            <nav className="website-socials" aria-label="Professional profiles">
              <a href="https://www.linkedin.com/in/jaylord-coronado/">
                LinkedIn
              </a>
              <a href="https://github.com/Jlordcoronado">GitHub</a>
            </nav>
          </section>
          <ProjectPreview key={theme} theme={theme} />
        </div>
      </main>
    </div>
  );
}
