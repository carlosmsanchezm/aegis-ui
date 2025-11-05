import { PropsWithChildren, ReactNode } from 'react';
import { makeStyles } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import BuildIcon from '@material-ui/icons/Build';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import DashboardIcon from '@material-ui/icons/Dashboard';
import DescriptionIcon from '@material-ui/icons/Description';
import ExtensionIcon from '@material-ui/icons/Extension';
import HomeIcon from '@material-ui/icons/Home';
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
import BusinessCenterIcon from '@material-ui/icons/BusinessCenter';
import GavelIcon from '@material-ui/icons/Gavel';
import PeopleOutlineIcon from '@material-ui/icons/PeopleOutline';
import HistoryIcon from '@material-ui/icons/History';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
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
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';

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
    margin: theme.spacing(0.5, 0, 3),
  },
  header: {
    margin: theme.spacing(0, 2, 1),
    fontSize: theme.typography.pxToRem(12.5),
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    opacity: 0.76,
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0, 1),
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

type NavSectionProps = {
  label: string;
  icon: ReactNode;
  children: ReactNode;
};

const NavSection = ({ label, icon, children }: NavSectionProps) => {
  const classes = useNavSectionStyles();

  return (
    <SidebarGroup label={label} icon={icon} value={label}>
      <div className={classes.section}>
        <div className={classes.header}>{label}</div>
        <div className={classes.items}>{children}</div>
      </div>
    </SidebarGroup>
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => {
  const classes = useSidebarStyles();

  return (
    <div className={classes.root}>
      <SidebarPage>
        <Sidebar>
          <SidebarLogo />
          <SidebarDivider />

          <NavSection label="Create" icon={<AddCircleOutlineIcon />}>
            <SidebarItem icon={LockIcon} to="aegis/workspaces/create" text="Workspace" />
            <SidebarItem icon={BuildIcon} to="aegis" text="Cluster" />
          </NavSection>

          <SidebarDivider />

          <SidebarScrollWrapper>
            <NavSection label="Manage" icon={<DashboardIcon />}>
              <SidebarItem icon={LaptopMacIcon} to="aegis/workloads" text="Workspaces" />
              <SidebarItem icon={CloudQueueIcon} to="aegis/clusters" text="Clusters" />
              <SidebarItem icon={TimelineIcon} to="aegis/telemetry" text="Telemetry" />
              <SidebarItem icon={SecurityIcon} to="aegis/posture" text="Live Posture" />
              <MyGroupsSidebarItem
                singularTitle="My Group"
                pluralTitle="My Groups"
                icon={GroupIcon}
              />
            </NavSection>

            <SidebarDivider />

            <NavSection label="Operations" icon={<BuildIcon />}>
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

            <NavSection label="FinOps" icon={<MonetizationOnIcon />}>
              <SidebarItem
                icon={AssessmentIcon}
                to="aegis/finops/cost-dashboard"
                text="Cost Dashboard"
              />
              <SidebarItem
                icon={BusinessCenterIcon}
                to="aegis/finops/projects"
                text="Projects"
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

            <NavSection label="Admin" icon={<SettingsIcon />}>
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
              <SidebarItem icon={HomeIcon} to="catalog" text="Catalog" />
              <SidebarItem icon={ExtensionIcon} to="api-docs" text="APIs" />
              <SidebarItem icon={DescriptionIcon} to="docs" text="Docs" />
              <NotificationsSidebarItem />
              <SidebarItem icon={SettingsIcon} to="settings" text="Settings" />
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
