import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import type { ThemeProps } from '../component/AuthLayout';
import { PublicThemeToggle } from '../component/PublicThemeToggle';
import { Dialog } from '../component/Dialog';
import { dashboardPreview } from '../lib/projectPreview';
import '../css/personal-website.css';

const email = 'projlordcoronado@gmail.com';
const profiles = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jaylord-coronado/' },
  { label: 'GitHub', href: 'https://github.com/Jlordcoronado' },
];
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
    href: '/kanban',
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
    href: '/kanban',
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

const kanbanProject = {
  name: 'Kanban Desk',
  summary:
    'A personal application for organizing tasks, workflow stages, priorities, and deadlines.',
  source: 'https://github.com/Jlordcoronado/kanban-board-app',
  stack: [
    'React',
    'TypeScript',
    'Tailwind CSS',
    'Node.js',
    'Express',
    'Supabase Auth',
    'PostgreSQL',
    'Google Gemini',
  ],
  work: [
    {
      title: 'Frontend and backend',
      description:
        'I built the board interactions, task details and editing, dashboard, API connections, validation, and persistence. Custom columns, priorities, dates, and archiving support the task workflow.',
    },
    {
      title: 'Guest and cloud saving',
      description:
        'Guest work stays in browser storage. Optional accounts save through the backend to PostgreSQL. Copying guest tasks to a cloud board is an explicit choice; the original device board stays separate.',
    },
    {
      title: 'Permissions and conflicts',
      description:
        'Personal boards are private. Existing team boards follow workspace membership and role permissions. Server-checked revisions detect outdated edits and let the user review changes before applying them.',
    },
    {
      title: 'Reviewable AI suggestions',
      description:
        'The Gemini integration generates a description only when requested by a signed-in user. The suggestion is previewed before applying it to the draft, and saving the task is a separate action.',
    },
  ],
};

function ProjectPreview({
  theme,
  placement = 'hero',
}: Pick<ThemeProps, 'theme'> & { placement?: 'hero' | 'project' }) {
  const label =
    placement === 'hero'
      ? 'Hero dashboard preview'
      : 'Kanban Desk project preview';
  const [enlarged, setEnlarged] = useState(false);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const preview = (
    <img
      src={dashboardPreview[theme]}
      width={dashboardPreview.width}
      height={dashboardPreview.height}
      alt={dashboardPreview.alt}
      fetchPriority={placement === 'hero' ? 'high' : 'auto'}
      loading={placement === 'hero' ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
  const unavailable = (
    <p role="status" className="website-preview-error">
      The dashboard preview could not load. You can still explore Kanban Desk
      using the project link.
    </p>
  );
  return (
    <figure className="website-project" aria-label={label}>
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
            aria-disabled={failed}
            aria-haspopup="dialog"
            aria-label={`View ${label.toLowerCase()} full size`}
            onClick={() => {
              if (!failed) setEnlarged(true);
            }}
          >
            View full size
          </button>
        </div>
      </figcaption>
      {enlarged && (
        <Dialog
          title={`${label} full size`}
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
  const [copyStatus, setCopyStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const copyEmail = async () => {
    setCopyStatus('');
    setCopying(true);
    try {
      await navigator.clipboard.writeText(email);
      setCopyStatus('Email address copied.');
    } catch {
      setCopyStatus(
        'Copying failed. Select the email address above and copy it manually.'
      );
    } finally {
      setCopying(false);
    }
  };
  const contactHeading = useRef<HTMLHeadingElement>(null);
  const servicesHeading = useRef<HTMLHeadingElement>(null);
  const aboutHeading = useRef<HTMLHeadingElement>(null);
  const projectsHeading = useRef<HTMLHeadingElement>(null);
  const reconciliationHeading = useRef<HTMLHeadingElement>(null);
  const experience = useRef<HTMLParagraphElement>(null);
  return (
    <div className="personal-website">
      <Link
        className="website-skip"
        to="#website-main"
        onClick={() =>
          document
            .getElementById('website-main')
            ?.focus({ preventScroll: true })
        }
      >
        Skip to content
      </Link>
      <header className="website-header">
        <Link className="website-brand" to="/" aria-label="jlord.dev home">
          jlord.dev
        </Link>
        <nav className="website-navigation" aria-label="Main navigation">
          <Link
            to="#services"
            onClick={() =>
              servicesHeading.current?.focus({ preventScroll: true })
            }
          >
            Services
          </Link>
          <Link
            to="#about"
            onClick={() => aboutHeading.current?.focus({ preventScroll: true })}
          >
            About
          </Link>
          <Link
            to="#projects"
            onClick={() =>
              projectsHeading.current?.focus({ preventScroll: true })
            }
          >
            Projects
          </Link>
          <Link to="/kanban">Kanban Desk</Link>
          <Link
            className="website-header-contact"
            to="#contact"
            onClick={() =>
              contactHeading.current?.focus({ preventScroll: true })
            }
          >
            Contact
          </Link>
          <PublicThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
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
            <h1 id="website-headline" tabIndex={-1}>
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
              <Link className="website-button website-secondary" to="/kanban">
                Explore Kanban Desk
              </Link>
            </div>
            <nav className="website-socials" aria-label="Professional profiles">
              {profiles.map((profile) => (
                <a key={profile.label} href={profile.href}>
                  {profile.label}
                </a>
              ))}
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
                    <Link
                      to={service.href}
                      onClick={() =>
                        (service.id === 'automation'
                          ? reconciliationHeading.current
                          : experience.current
                        )?.focus({ preventScroll: true })
                      }
                    >
                      {service.work}
                    </Link>
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
        <section className="website-projects" aria-labelledby="projects">
          <h2 id="projects" ref={projectsHeading} tabIndex={-1}>
            Projects
          </h2>
          <article aria-labelledby="kanban-project-title">
            <div className="website-case-introduction">
              <div>
                <p className="website-case-kind">Personal project</p>
                <h3 id="kanban-project-title">{kanbanProject.name}</h3>
              </div>
              <div>
                <p>{kanbanProject.summary}</p>
                <div className="website-actions">
                  <Link
                    className="website-button website-secondary"
                    to="/kanban"
                  >
                    View Kanban Desk
                  </Link>
                  <a
                    className="website-button website-secondary"
                    href={kanbanProject.source}
                  >
                    View source on GitHub
                  </a>
                </div>
              </div>
            </div>
            <div className="website-case-study">
              <ProjectPreview
                key={`project-${theme}`}
                theme={theme}
                placement="project"
              />
              <dl className="website-case-work">
                {kanbanProject.work.map((item) => (
                  <div key={item.title}>
                    <dt>{item.title}</dt>
                    <dd>{item.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="website-case-stack">
              <h4>Built with</h4>
              <ul role="list">
                {kanbanProject.stack.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </div>
            <p className="website-case-status">
              These capabilities are implemented and tested in the source. The
              screenshots use example data; hosted account access and cloud
              behavior have not been verified for this version. Team management,
              invitation, archive browsing, and activity-history screens remain
              planned.
            </p>
          </article>
        </section>
        <section className="website-contact" aria-labelledby="contact">
          <h2 id="contact" ref={contactHeading} tabIndex={-1}>
            Contact
          </h2>
          <div className="website-contact-content">
            <div>
              <h3>Let’s talk about your project.</h3>
              <p>
                Have a web application, backend issue, or data workflow you want
                to discuss? Email me about the work or a developer role, or
                contact me through LinkedIn.
              </p>
              <a className="website-button website-primary" href={contact}>
                Contact me
              </a>
            </div>
            <div className="website-contact-details">
              <p className="website-email">{email}</p>
              <button
                className="website-button website-secondary"
                type="button"
                disabled={copying}
                onClick={() => void copyEmail()}
              >
                {copying ? 'Copying…' : 'Copy email'}
              </button>
              <p
                className="website-copy-status"
                role="status"
                aria-atomic="true"
              >
                {copyStatus}
              </p>
              <nav className="website-socials" aria-label="Contact profiles">
                {profiles.map((profile) => (
                  <a key={profile.label} href={profile.href}>
                    {profile.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </section>
      </main>
      <footer className="website-footer">
        <div>
          <p className="website-footer-name">Jaylord Coronado</p>
          <p>Software engineer and developer of Kanban Desk.</p>
        </div>
        <nav className="website-footer-links" aria-label="Footer sections">
          {[
            { label: 'Services', ref: servicesHeading },
            { label: 'About', ref: aboutHeading },
            { label: 'Projects', ref: projectsHeading },
            { label: 'Contact', ref: contactHeading },
          ].map((section) => (
            <Link
              key={section.label}
              to={`#${section.label.toLowerCase()}`}
              onClick={() =>
                section.ref.current?.focus({ preventScroll: true })
              }
            >
              {section.label}
            </Link>
          ))}
          <Link to="/kanban">Kanban Desk</Link>
        </nav>
        <nav className="website-footer-links" aria-label="Footer profiles">
          {profiles.map((profile) => (
            <a key={profile.label} href={profile.href}>
              {profile.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
