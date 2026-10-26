import { useRef, useState, type KeyboardEvent } from 'react';
import { Dialog } from './Dialog';
import {
  applicationScreens,
  type ApplicationScreen,
} from '../lib/projectPreview';

type Layout = 'auto' | 'desktop' | 'mobile';
type Theme = 'light' | 'dark';

function ScreenPreview({
  screen,
  theme,
  layout,
}: {
  screen: ApplicationScreen;
  theme: Theme;
  layout: Layout;
}) {
  const [failed, setFailed] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const desktop = screen.variants[theme].desktop;
  const mobile = screen.variants[theme].mobile;
  const image = (
    <picture>
      <source
        media={
          layout === 'mobile'
            ? 'all'
            : layout === 'auto'
              ? '(max-width: 600px)'
              : 'not all'
        }
        srcSet={mobile.src}
        width={mobile.width}
        height={mobile.height}
      />
      <img
        key={attempt}
        src={desktop.src}
        width={desktop.width}
        height={desktop.height}
        alt={screen.alt}
        loading="eager"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </picture>
  );
  const failure = (
    <div className="website-preview-error">
      <p role="status">
        The {screen.label.toLowerCase()} image could not load. You can retry or
        choose another screen.
      </p>
      <button
        className="website-button website-secondary"
        type="button"
        onClick={() => {
          setAttempt((value) => value + 1);
          setFailed(false);
        }}
      >
        Retry image
      </button>
    </div>
  );
  return (
    <figure
      className={`website-project kanban-gallery-preview kanban-layout-${layout}`}
      aria-label={`${screen.label} example preview`}
    >
      <div className="website-preview-frame">{failed ? failure : image}</div>
      <figcaption>
        <div className="kanban-gallery-caption">
          <span className="website-project-name">{screen.label}</span>
          <span>{screen.caption}</span>
        </div>
        <div className="website-preview-actions">
          <span>Example screen</span>
          <button
            ref={trigger}
            type="button"
            aria-haspopup="dialog"
            aria-disabled={failed}
            onClick={() => {
              if (!failed) setEnlarged(true);
            }}
            aria-label={`View ${screen.label.toLowerCase()} full size`}
          >
            View full size
          </button>
        </div>
      </figcaption>
      {enlarged && (
        <Dialog
          title={`${screen.label} example full size`}
          className={`website-preview-dialog kanban-full-preview kanban-layout-${layout}`}
          returnFocusRef={trigger}
          dismissOnBackdrop
          onClose={() => setEnlarged(false)}
        >
          <h2>{screen.label}</h2>
          <p>
            {screen.caption} Example data; hosted account access is not verified
            by this capture.
          </p>
          {failed ? failure : image}
        </Dialog>
      )}
    </figure>
  );
}

export function ScreenshotGallery({ theme }: { theme: Theme }) {
  const [selected, setSelected] = useState(0);
  const [layout, setLayout] = useState<Layout>('auto');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectByKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let next: number;
    if (event.key === 'ArrowRight')
      next = (index + 1) % applicationScreens.length;
    else if (event.key === 'ArrowLeft')
      next =
        (index - 1 + applicationScreens.length) % applicationScreens.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = applicationScreens.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className="kanban-gallery">
      <div
        role="tablist"
        aria-label="Application screens"
        className="kanban-screen-tabs"
      >
        {applicationScreens.map((screen, index) => (
          <button
            key={screen.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            id={`screen-tab-${screen.id}`}
            role="tab"
            type="button"
            aria-selected={selected === index}
            aria-controls={`screen-panel-${screen.id}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => selectByKey(event, index)}
          >
            {screen.label}
          </button>
        ))}
      </div>
      <div
        role="group"
        aria-label="Screenshot layout"
        className="kanban-layout-options"
      >
        <span>View</span>
        {(['auto', 'desktop', 'mobile'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={layout === option}
            onClick={() => setLayout(option)}
          >
            {option === 'auto'
              ? 'Match screen'
              : option === 'desktop'
                ? 'Desktop'
                : 'Mobile'}
          </button>
        ))}
      </div>
      {applicationScreens.map((screen, index) => (
        <div
          key={screen.id}
          id={`screen-panel-${screen.id}`}
          role="tabpanel"
          aria-labelledby={`screen-tab-${screen.id}`}
          hidden={selected !== index}
          tabIndex={0}
        >
          {selected === index && (
            <ScreenPreview
              key={`${screen.id}-${theme}-${layout}`}
              screen={screen}
              theme={theme}
              layout={layout}
            />
          )}
        </div>
      ))}
    </div>
  );
}
