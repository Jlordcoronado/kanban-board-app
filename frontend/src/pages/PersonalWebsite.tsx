import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import type { ThemeProps } from '../component/AuthLayout';
import { Dialog } from '../component/Dialog';
import { dashboardPreview } from '../lib/projectPreview';
import '../css/personal-website.css';

const contact =
  'mailto:projlordcoronado@gmail.com?subject=Project%20or%20role%20inquiry';

// Approved public content. Add or edit entries here to update these sections.
const services = [
  {
    id: 'full-stack',
    title: 'Full-stack applications',
    description:
      'I build web applications, including user interfaces, backend logic, databases, and API integrations.',
    work: 'Kanban Desk',
    evidence: 'An independent application with a web interface and backend.',
    href: '/try',
  },
  {
    id: 'automation',
    title: 'Business automation',
    description:
      'I automate data matching, information extraction, and report preparation. My reconciliation work includes comparing job numbers across lists and highlighting discrepancies.',
    work: 'Reconciliation workflow',
    evidence: 'Power Query and Office Scripts, with a one-click comparison.',
    href: '#reconciliation-title',
  },
  {
    id: 'ai',
    title: 'AI integration',
    description:
      'I connect AI APIs to application features and build the input, review, and save flows around the results.',
    work: 'AI in Kanban Desk',
    evidence: 'AI-assisted task descriptions, reviewed before saving.',
    href: '/try',
  },
  {
    id: 'maintenance',
    title: 'Application maintenance',
    description:
      'I maintain C# and VB.NET applications, investigate backend and SQL issues, and validate changes before deployment.',
    work: 'Professional .NET work',
    evidence:
      'Enterprise applications, production issues, and deployment support.',
    href: '#professional-experience',
  },
];

const introduction = [
  'I’m Jaylord Coronado, a software engineer with three years of professional experience developing and maintaining enterprise applications. I work on backend business logic, SQL databases, API integrations, and production issues. My responsibilities also include requirements analysis, testing, data validation, deployment support, and technical documentation.',
  'Kanban Desk is my independent project. I build its web interface and backend and connect AI APIs to application features.',
];

const skillGroups = [
  {
    name: 'Programming languages',
    tools: 'C#, VB.NET, JavaScript, TypeScript, Python, Perl, SQL.',
  },
  {
    name: 'Frameworks, libraries, and runtimes',
    tools: '.NET Framework, React, Node.js, Express, Tailwind CSS.',
  },
  {
    name: 'Databases and SQL tools',
    tools: 'SQL Server, SSMS, MySQL, Oracle.',
  },
  { name: 'Automation tools', tools: 'Power Query, Office Scripts.' },
  { name: 'Integrations', tools: 'REST APIs and AI APIs.' },
  {
    name: 'Development and collaboration',
    tools:
      'Git, GitHub, Bitbucket, Jira, Confluence, Visual Studio, VS Code. Exposure to TFS.',
  },
];

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
  const servicesHeading = useRef<HTMLHeadingElement>(null);
  const aboutHeading = useRef<HTMLHeadingElement>(null);
  const reconciliationHeading = useRef<HTMLHeadingElement>(null);
  const experience = useRef<HTMLParagraphElement>(null);
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
          <a
            href="#services"
            onClick={() =>
              servicesHeading.current?.focus({ preventScroll: true })
            }
          >
            Services
          </a>
          <a
            href="#about"
            onClick={() => aboutHeading.current?.focus({ preventScroll: true })}
          >
            About
          </a>
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
        <section className="website-services" aria-labelledby="services">
          <h2 id="services" ref={servicesHeading} tabIndex={-1}>
            Services
          </h2>
          <div className="website-service-list">
            {services.map((service) => (
              <article
                key={service.id}
                className={`website-service${service.id === 'full-stack' ? ' website-service-featured' : ''}`}
                aria-labelledby={`service-${service.id}`}
              >
                <h3 id={`service-${service.id}`}>{service.title}</h3>
                <p className="website-service-description">
                  {service.description}
                </p>
                <div className="website-service-work">
                  {service.href.startsWith('/') ? (
                    <Link to={service.href}>{service.work}</Link>
                  ) : (
                    <a
                      href={service.href}
                      onClick={() =>
                        (service.id === 'automation'
                          ? reconciliationHeading.current
                          : experience.current
                        )?.focus({ preventScroll: true })
                      }
                    >
                      {service.work}
                    </a>
                  )}
                  <p>{service.evidence}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="website-about" aria-labelledby="about">
          <h2 id="about" ref={aboutHeading} tabIndex={-1}>
            About
          </h2>
          <div className="website-about-overview">
            <div className="website-about-content">
              <p id="professional-experience" ref={experience} tabIndex={-1}>
                {introduction[0]}
              </p>
              <p>{introduction[1]}</p>
            </div>
            <article
              className="website-reconciliation"
              aria-labelledby="reconciliation-title"
            >
              <h3
                id="reconciliation-title"
                ref={reconciliationHeading}
                tabIndex={-1}
              >
                A one-click reconciliation workflow
              </h3>
              <p>
                I built a workflow with Power Query and Office Scripts to
                compare job numbers across two lists. The previous process
                required approximately 3–7 days of manual work. The workflow
                refreshes the comparison with one click and highlights
                discrepancies for review and reporting.
              </p>
              <ol className="website-reconciliation-flow" role="list">
                {[
                  'Two lists',
                  'Compare job numbers',
                  'Highlight discrepancies',
                ].map((step, index) => (
                  <li key={step}>
                    <span>{step}</span>
                    {index < 2 && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M4 12h16m-6-6 6 6-6 6" />
                      </svg>
                    )}
                  </li>
                ))}
              </ol>
            </article>
          </div>
          <div className="website-skills">
            <h3>Skills and tools</h3>
            <dl>
              {skillGroups.map((group) => (
                <div className="website-skill-group" key={group.name}>
                  <dt>{group.name}</dt>
                  <dd>{group.tools}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
