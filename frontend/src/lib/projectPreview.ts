export const dashboardPreview = {
  light: '/images/kanban-dashboard-light.png',
  dark: '/images/kanban-dashboard-dark.png',
  width: 1280,
  height: 959,
  alt: 'Kanban Desk signed-in dashboard with example personal and team tasks, task counts, overdue work, and upcoming deadlines.',
} as const;

export type PreviewTheme = 'light' | 'dark';
export type PreviewViewport = 'desktop' | 'mobile';
export interface ScreenshotVariant {
  src: string;
  width: number;
  height: number;
  theme: PreviewTheme;
  viewport: PreviewViewport;
}
export interface ApplicationScreen {
  id: string;
  label: string;
  caption: string;
  alt: string;
  variants: Record<PreviewTheme, Record<PreviewViewport, ScreenshotVariant>>;
}

// Actual component captures with deterministic example data, not hosted-account evidence.
export const applicationScreens: readonly ApplicationScreen[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    caption:
      'Counts, overdue work, and upcoming deadlines across personal and existing team boards.',
    alt: 'Kanban Desk dashboard with example personal and team tasks, task counts, overdue work, and upcoming deadlines.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-dashboard-light.png',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-dashboard-light-mobile.webp',
          width: 390,
          height: 1247,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-dashboard-dark.png',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-dashboard-dark-mobile.webp',
          width: 390,
          height: 1247,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
  {
    id: 'guest-board',
    label: 'Guest board',
    caption: 'Organize tasks on this device without creating an account.',
    alt: 'Kanban Desk guest board with example tasks in To do, In progress, and Done columns and browser-local saving.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-guest-board-light-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-guest-board-light-mobile.webp',
          width: 390,
          height: 844,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-guest-board-dark-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-guest-board-dark-mobile.webp',
          width: 390,
          height: 844,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
  {
    id: 'personal-board',
    label: 'Personal board',
    caption:
      'A private account board with priorities, dates, and custom workflow stages.',
    alt: 'Kanban Desk private personal board with example tasks, priorities, dates, and task controls.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-personal-board-light-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-personal-board-light-mobile.webp',
          width: 390,
          height: 845,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-personal-board-dark-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-personal-board-dark-mobile.webp',
          width: 390,
          height: 845,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
  {
    id: 'team-board',
    label: 'Team board',
    caption:
      'An existing team workspace with task access based on membership and role.',
    alt: 'Kanban Desk example Website team board showing a member role and shared task columns.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-team-board-light-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-team-board-light-mobile.webp',
          width: 390,
          height: 845,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-team-board-dark-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-team-board-dark-mobile.webp',
          width: 390,
          height: 845,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
  {
    id: 'task-details',
    label: 'Task details',
    caption:
      'Read a task’s description, stage, priority, and dates before choosing Edit task.',
    alt: 'Kanban Desk read-only Task details dialog with an example API validation task and Edit task action.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-task-details-light-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-task-details-light-mobile.webp',
          width: 390,
          height: 845,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-task-details-dark-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-task-details-dark-mobile.webp',
          width: 390,
          height: 845,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
  {
    id: 'edit-task',
    label: 'Edit task',
    caption:
      'Change task fields, optionally request description help, and explicitly save changes.',
    alt: 'Kanban Desk Edit task dialog with labeled description, status, priority, and date fields and Save changes action.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-edit-task-light-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-edit-task-light-mobile.webp',
          width: 390,
          height: 845,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-edit-task-dark-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-edit-task-dark-mobile.webp',
          width: 390,
          height: 845,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
  {
    id: 'account-settings',
    label: 'Account settings',
    caption:
      'Review account identity, choose appearance, and open password recovery.',
    alt: 'Kanban Desk Account settings with an example.com address, light and dark appearance options, and password reset link.',
    variants: {
      light: {
        desktop: {
          src: '/images/kanban-account-settings-light-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'light',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-account-settings-light-mobile.webp',
          width: 390,
          height: 845,
          theme: 'light',
          viewport: 'mobile',
        },
      },
      dark: {
        desktop: {
          src: '/images/kanban-account-settings-dark-desktop.webp',
          width: 1280,
          height: 959,
          theme: 'dark',
          viewport: 'desktop',
        },
        mobile: {
          src: '/images/kanban-account-settings-dark-mobile.webp',
          width: 390,
          height: 845,
          theme: 'dark',
          viewport: 'mobile',
        },
      },
    },
  },
];
