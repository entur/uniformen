import type { Locale, NotificationList } from "../types";
import { BellIcon } from "./icons/BellIcon";
import { ForwardIcon } from "./icons/ForwardIcon";
import { environment as runningEnvironment } from "../config";
import { portalApplicationUrl } from "./portalApplications";

/**
 * Static URLs for notificatinos pointing to requests.
 * Is likely to change once notification-center is rewritten as more notification types will occur
 */
const PERMISSION_ADMIN_BASE_URI = `${portalApplicationUrl("partner", runningEnvironment)}/permission-admin`;
const ALL_REQUESTS_PATH = `${PERMISSION_ADMIN_BASE_URI}/requests`;
const SINGLE_REQUEST_PATH = `${PERMISSION_ADMIN_BASE_URI}/requests/request`;
const ROLE_REQUEST_APPROVED_PATH = `${PERMISSION_ADMIN_BASE_URI}/my-profile`;

const texts = {
  "nb-NO": {
    title: "Varsler",
    newNotifications: "Nye varsler",
    noNewNotifications: "Ingen nye varsler",
    seeAll: "Se alle hendelser",
    seeAllNumbered: (n: number) => `Se alle ${n} hendelser`,
  },
  "nn-NO": {
    title: "Varsel",
    newNotifications: "Nye varslar",
    noNewNotifications: "Ingen nye varslar",
    seeAll: "Sjå alle hendingar",
    seeAllNumbered: (n: number) => `Sjå alle ${n} hendingar`,
  },
  "en-GB": {
    title: "Notifications",
    newNotifications: "New notifications",
    noNewNotifications: "No new notifications",
    seeAll: "See all notifications",
    seeAllNumbered: (n: number) => `See all ${n} notifications`,
  },
} as const;

/**
 * Format raw ISO date strings to locale dates
 *
 */
const formatRawDateString = (dString: string, locale: Locale) => {
  const d = new Date(dString);
  if (!d || isNaN(d.getTime())) {
    return undefined;
  }

  return d.toLocaleDateString(locale, {
    timeZone: "Europe/Oslo",
  });
};

interface NotificationMenuArgs {
  locale: Locale;
  notifications?: NotificationList;
}

export function NotificationsMenu(props: NotificationMenuArgs) {
  const hasNotifications = !!props.notifications?.length;
  const txt = texts[props.locale];

  return (
    <div class="uniformen-notifications-menu">
      {/* A red dot on the bell shows that there are new notifications, without
          saying how many. The dot is drawn in CSS, so the accessible name says the
          same thing for screen readers. */}
      <button
        type="button"
        class={
          "uniformen-top-nav__action" +
          (hasNotifications ? " uniformen-notifications-button__badge" : "")
        }
        /**
         * Replace aria-label line below with the following, once support for "reading" notifications
         * has been implemented:
         * aria-label={hasNotifications ? txt.newNotifications : txt.noNewNotifications}
         */
        aria-label={txt.title}
        aria-expanded="false"
        aria-haspopup="dialog"
        aria-controls="uniformen-notifications-menu-panel"
        data-uniformen-notifications-menu-toggle
      >
        <BellIcon />
        <span class="uniformen-top-nav__action-label">{txt.title}</span>
      </button>
      <div
        id="uniformen-notifications-menu-panel"
        class="uniformen-notifications-menu__panel"
        role="dialog"
        aria-label={txt.title}
      >
        <div class="uniformen-notifications-menu__surface">
          <div class="uniformen-notifications-menu__header">
            <BellIcon />
            <h2 class="uniformen-notifications-menu__title">{txt.title}</h2>
          </div>
          {hasNotifications ? (
            <ul class="uniformen-notifications-menu__list">
              {props.notifications?.slice(0, 5).map((notification) => (
                <li>
                  <a
                    class="uniformen-notifications-menu__item"
                    href={
                      notification.referenceId
                        ? `${SINGLE_REQUEST_PATH}/${notification.referenceId}`
                        : ROLE_REQUEST_APPROVED_PATH
                    }
                  >
                    <div class="uniformen-notifications-menu__item-badge" aria-hidden="true" />
                    {/* Skip PostHog autocapture for potential personal sensitive data in the following DOM element */}
                    <div class="uniformen-notifications-menu__item-text ph-no-capture">
                      <span>{formatRawDateString(notification.date, props.locale)}</span>
                      <span>{notification.message}</span>
                    </div>
                    <ForwardIcon />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p class="uniformen-notifications-menu__empty">{txt.noNewNotifications}</p>
          )}
          <a class="uniformen-notifications-menu__footer" href={ALL_REQUESTS_PATH}>
            {hasNotifications ? txt.seeAllNumbered(props.notifications!.length) : txt.seeAll}
            <ForwardIcon />
          </a>
        </div>
      </div>
    </div>
  );
}
