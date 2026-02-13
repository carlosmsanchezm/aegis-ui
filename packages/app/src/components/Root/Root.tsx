import { PropsWithChildren, ReactNode, useState, useCallback } from 'react';
import { makeStyles, Collapse } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import BuildIcon from '@material-ui/icons/Build';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import DashboardIcon from '@material-ui/icons/Dashboard';
import LaptopMacIcon from '@material-ui/icons/LaptopMac';
import LockIcon from '@material-ui/icons/Lock';
import SecurityIcon from '@material-ui/icons/Security';
import SettingsIcon from '@material-ui/icons/Settings';
import TimelineIcon from '@material-ui/icons/Timeline';
import AssessmentIcon from '@material-ui/icons/Assessment';
import BugReportIcon from '@material-ui/icons/BugReport';
import ListAltIcon from '@material-ui/icons/ListAlt';
import TuneIcon from '@material-ui/icons/Tune';
import GroupIcon from '@material-ui/icons/Group';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import EqualizerIcon from '@material-ui/icons/Equalizer';
import NotificationsActiveIcon from '@material-ui/icons/NotificationsActive';
import GavelIcon from '@material-ui/icons/Gavel';
import PeopleOutlineIcon from '@material-ui/icons/PeopleOutline';
import HistoryIcon from '@material-ui/icons/History';
import LayersIcon from '@material-ui/icons/Layers';
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
import LinkIcon from '@material-ui/icons/Link';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import { InteractiveBackground } from '../layout/InteractiveBackground';
import {
  Settings as SidebarSettings,
  UserSettingsSignInAvatar,
} from '@backstage/plugin-user-settings';
import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarPage,
  SidebarScrollWrapper,
  SidebarSpace,
  useSidebarOpenState,
  Link,
} from '@backstage/core-components';
import { MyGroupsSidebarItem } from '@backstage/plugin-org';

const useSidebarStyles = makeStyles(theme => ({
  root: {
    '& [data-testid="sidebar-root"]': {
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(2),
    },
    '& [data-testid="sidebar-root"] .MuiListItem-root': {
      borderRadius: theme.shape.borderRadius * 2,
      paddingTop: theme.spacing(1.25),
      paddingBottom: theme.spacing(1.25),
      paddingLeft: theme.spacing(1.5),
      paddingRight: theme.spacing(1.5),
    },
    '& [data-testid="sidebar-root"] .MuiListItemIcon-root': {
      minWidth: theme.spacing(7),
    },
    '& [data-testid="sidebar-root"] .MuiListItemIcon-root .MuiSvgIcon-root': {
      fontSize: '2.1rem',
    },
    '& [data-testid="sidebar-root"] .MuiSvgIcon-root': {
      fontSize: '2rem',
    },
    '& [data-testid="sidebar-root"] .MuiListItemText-primary': {
      fontSize: theme.typography.pxToRem(16),
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    '& [data-testid="sidebar-root"] [data-testid="sidebar-pin"] .MuiSvgIcon-root': {
      fontSize: '1.25rem',
    },
  },
}));

const useSidebarLogoStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    padding: theme.spacing(2, 2, 1.5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.75),
    width: '100%',
    flex: 1,
    padding: theme.spacing(1.5, 1.75),
    borderRadius: theme.shape.borderRadius * 2.5,
    backgroundColor:
      (theme.palette.navigation && theme.palette.navigation.background) ||
      theme.palette.background.paper,
    boxShadow: `inset 0 0 0 1px ${theme.palette.divider}`,
    transition: theme.transitions.create(['background-color', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
  },
  linkCollapsed: {
    justifyContent: 'center',
    width: 'auto !important',
    flex: '0 0 auto',
    padding: theme.spacing(1.25),
  },
}));

const useNavSectionStyles = makeStyles(theme => ({
  section: {
    margin: theme.spacing(0.5, 0, 1.5),
  },
  sectionCollapsed: {
    margin: theme.spacing(0.5, 0, 1),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: theme.spacing(0, 1.5, 0.5),
    padding: theme.spacing(0.75, 0.5),
    fontSize: theme.typography.pxToRem(12.5),
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    opacity: 0.76,
    cursor: 'pointer',
    borderRadius: theme.shape.borderRadius,
    transition: theme.transitions.create(['background-color', 'opacity'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      opacity: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
  },
  headerLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  chevron: {
    fontSize: '1.1rem',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shorter,
    }),
  },
  chevronExpanded: {
    transform: 'rotate(0deg)',
  },
  chevronCollapsed: {
    transform: 'rotate(-90deg)',
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0, 1),
  },
  itemsCollapsed: {
    alignItems: 'center',
    padding: theme.spacing(0, 0.5),
  },
}));

const SidebarLogo = () => {
  const classes = useSidebarLogoStyles();
  const { isOpen } = useSidebarOpenState();

  return (
    <div className={classes.root}>
      <Link
        to="/"
        underline="none"
        className={`${classes.link} ${!isOpen ? classes.linkCollapsed : ''}`.trim()}
        aria-label="Home"
      >
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
    </div>
  );
};

const STORAGE_KEY = 'aegis-sidebar-collapsed';

const getInitialCollapsedState = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

type NavSectionProps = {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  expanded: boolean;
  onToggle: (id: string) => void;
};

const NavSection = ({ id, label, icon, children, expanded, onToggle }: NavSectionProps) => {
  const classes = useNavSectionStyles();
  const { isOpen: sidebarOpen } = useSidebarOpenState();

  const handleClick = () => {
    onToggle(id);
  };

  return (
    <SidebarGroup label={label} icon={icon} value={label}>
      <div className={sidebarOpen ? classes.section : classes.sectionCollapsed}>
        {sidebarOpen && (
          <div
            className={classes.header}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            aria-expanded={expanded}
          >
            <span className={classes.headerLabel}>{label}</span>
            <ExpandMoreIcon
              className={`${classes.chevron} ${
                expanded ? classes.chevronExpanded : classes.chevronCollapsed
              }`}
            />
          </div>
        )}
        {sidebarOpen ? (
          <Collapse in={expanded} timeout={200}>
            <div className={classes.items}>{children}</div>
          </Collapse>
        ) : (
          <div className={classes.itemsCollapsed}>{children}</div>
        )}
      </div>
    </SidebarGroup>
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => {
  const classes = useSidebarStyles();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    getInitialCollapsedState
  );

  const handleToggle = useCallback((id: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  const isExpanded = (id: string) => !collapsedSections[id];

  return (
    <div className={classes.root}>
      <InteractiveBackground />
      <SidebarPage>
        <Sidebar>
          <SidebarLogo />
          <SidebarDivider />

          <SidebarScrollWrapper>
            <NavSection
              id="create"
              label="Create"
              icon={<AddCircleOutlineIcon />}
              expanded={isExpanded('create')}
              onToggle={handleToggle}
            >
              <SidebarItem icon={BuildIcon} to="aegis/create/clusters" text="Clusters" />
              <SidebarItem icon={LockIcon} to="aegis/workspaces/create" text="Workspaces" />
            </NavSection>

            <SidebarDivider />
            <NavSection
              id="manage"
              label="Manage"
              icon={<DashboardIcon />}
              expanded={isExpanded('manage')}
              onToggle={handleToggle}
            >
              <SidebarItem
                icon={CloudQueueIcon}
                to="aegis/clusters"
                text="Clusters"
              />
              <SidebarItem icon={LaptopMacIcon} to="aegis/workspaces" text="Workspaces" />
              <SidebarItem icon={TimelineIcon} to="aegis/telemetry" text="Telemetry" />
              <SidebarItem icon={SecurityIcon} to="aegis/posture" text="Compliance posture" />
              <MyGroupsSidebarItem
                singularTitle="My Group"
                pluralTitle="My Groups"
                icon={GroupIcon}
              />
            </NavSection>

            <SidebarDivider />

            <NavSection
              id="operations"
              label="Operations"
              icon={<BuildIcon />}
              expanded={isExpanded('operations')}
              onToggle={handleToggle}
            >
              <SidebarItem
                icon={AssessmentIcon}
                to="aegis/operations/metrics"
                text="Metrics"
              />
              <SidebarItem
                icon={BugReportIcon}
                to="aegis/operations/alerts"
                text="Alerts"
              />
              <SidebarItem
                icon={ListAltIcon}
                to="aegis/operations/logs"
                text="Logs"
              />
              <SidebarItem
                icon={TuneIcon}
                to="aegis/operations/configuration"
                text="Configuration"
              />
            </NavSection>

            <SidebarDivider />

            <NavSection
              id="finops"
              label="FinOps"
              icon={<MonetizationOnIcon />}
              expanded={isExpanded('finops')}
              onToggle={handleToggle}
            >
              <SidebarItem
                icon={AssessmentIcon}
                to="aegis/finops/cost-dashboard"
                text="Cost Dashboard"
              />
              <SidebarItem
                icon={EqualizerIcon}
                to="aegis/finops/quotas"
                text="Quotas"
              />
              <SidebarItem
                icon={NotificationsActiveIcon}
                to="aegis/finops/alerts"
                text="Billing Alerts"
              />
            </NavSection>

            <SidebarDivider />

            <NavSection
              id="admin"
              label="Admin"
              icon={<SettingsIcon />}
              expanded={isExpanded('admin')}
              onToggle={handleToggle}
            >
              <SidebarItem
                icon={LibraryBooksIcon}
                to="aegis/admin/cluster-profiles"
                text="Cluster profiles"
              />
              <SidebarItem
                icon={LinkIcon}
                to="aegis/admin/iac-connectors"
                text="IaC connectors"
              />
              <SidebarItem
                icon={LayersIcon}
                to="aegis/admin/projects"
                text="Projects"
              />
              <SidebarItem
                icon={AssessmentIcon}
                to="aegis/admin/analytics"
                text="Usage & Cost"
              />
              <SidebarItem
                icon={GavelIcon}
                to="aegis/admin/policies"
                text="Policies"
              />
              <SidebarItem
                icon={PeopleOutlineIcon}
                to="aegis/admin/users"
                text="Users"
              />
              <SidebarItem
                icon={HistoryIcon}
                to="aegis/admin/audit-logs"
                text="Audit Logs"
              />
            </NavSection>
          </SidebarScrollWrapper>

          <SidebarSpace />
          <SidebarDivider />

          <SidebarGroup
            label="Profile"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            <SidebarSettings />
          </SidebarGroup>
        </Sidebar>
        {children}
      </SidebarPage>
    </div>
  );
};
