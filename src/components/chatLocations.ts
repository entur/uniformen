import type { Locale } from "../types";
import type { PortalApplicationId } from "./portalApplications";

/** The location names of one application. */
type AppLocations = {
  /** The names shown in the chat drawer for the parts of the URL path, per language. */
  names: Record<Locale, Record<string, string>>;

  /**
   * Path parts that are used for a page in more than one part of the app, like `users`.
   * The drawer shows the name of the part before it as well, for example
   * "Tilgangsstyring - Brukere". Add a part here when its name is not clear on its own.
   * Every part must have a name in each language.
   */
  genericPages: string[];
};

/**
 * Add a name here when a new page is added to the app. An application that is not
 * listed shows the parts of the URL path as they are.
 */
const partnerNb = {
  //outside of partnerNames, since its used by both nn and nb
  "price-and-product": "Pris og produkt",
  "fare-structures": "Prisstrukturer",
  products: "Produkter",
  "combined-products": "Reiseprodukt",
  "sales-packages": "Salgspakker",
  "rules-and-parameters": "Regler og parametre",
  "usage-rules": "Bruksregler",
  passengers: "Passasjerer",
  sales: "Salg",
  entitlements: "Tilleggsrettigheter",
  "journey-patterns": "Strekninger og reisemønstre",
  roundings: "Avrunding",
  facilities: "Fasiliteter",
  "luggage-allowance": "Bagasje",
  charging: "Gebyr og betaling",
  "temporal-validity": "Tidsbegrensninger",
  "tariff-codes": "Tariffkoder",
  warnings: "Varsler",
  "distribution-channels": "Salgskanaler",
  turnover: "Omsetning",
  "point-of-sales": "Kassapunkter",
  locations: "Kassapunktplasseringer",
  settlements: "Kassaoppgjør",
  "terminal-report": "Terminalrapport",
  "agreement-service": "Avtaletjenesten",
  "handle-agreements": "Avtalehåndtering",
  "choose-template": "Velg avtaletype",
  agreements: "Avtaler",
  "permission-admin": "Tilgangsstyring",
  requests: "Forespørsler",
  roles: "Roller",
  "my-profile": "Min profil",
  auditlog: "Sporingslogg",
  users: "Brukere",
  clients: "Klienter",
  permissions: "Rettigheter",
  applications: "Applikasjoner",
  tags: "Tags",
  "entur-seating": "Plass",
  departure: "Avganger",
  schedule: "Kjøreplaner",
  material: "Materiell",
  operation: "Veileder for avvik",
  help: "Hjelp",
  debug: "Debug",
  "data-dashboards": "Innsikt",
  admin: "Administrer dashbord",
  ruteinnsikt: "Ruteinnsikt",
  distance: "Avstand og nettverk",
  farezones: "Soner",
  distances: "Avstander",
};

const partnerNames: Record<Locale, Record<string, string>> = {
  "nb-NO": partnerNb,
  // nynorsk pages are currently unavailable (October 2026), so bokmål is displayed instead
  "nn-NO": partnerNb,
  "en-GB": {
    "price-and-product": "Price and product",
    "fare-structures": "Fare structures",
    products: "Products",
    "combined-products": "Combined products",
    "sales-packages": "Sales packages",
    "rules-and-parameters": "Parameters",
    "usage-rules": "Travel",
    passengers: "Eligibility",
    sales: "Booking",
    entitlements: "Entitlement",
    "journey-patterns": "Journey patterns and fare sections",
    roundings: "Roundings",
    facilities: "Facilities",
    "luggage-allowance": "Luggage allowance",
    charging: "Charging",
    "temporal-validity": "Temporal validity",
    "tariff-codes": "Tariff codes",
    warnings: "Warnings",
    "distribution-channels": "Distribution channels",
    turnover: "Turnover",
    "point-of-sales": "Point of sale",
    locations: "Point of sale locations",
    settlements: "Settlements",
    "terminal-report": "Terminal report",
    "agreement-service": "Agreement service",
    "handle-agreements": "Handle agreements",
    "choose-template": "Choose agreement type",
    agreements: "Agreements",
    "permission-admin": "Permission admin",
    requests: "Requests",
    roles: "Roles",
    "my-profile": "My profile",
    auditlog: "Audit log",
    users: "Users",
    clients: "Clients",
    permissions: "Permissions",
    applications: "Applications",
    tags: "Tags",
    "entur-seating": "Seating",
    departure: "Departures",
    schedule: "Schedules",
    material: "Material",
    operation: "Guide for deviations",
    help: "Help",
    debug: "Debug",
    "data-dashboards": "Insights",
    admin: "Manage dashboards",
    ruteinnsikt: "Ruteinnsikt",
    distance: "Distance and network",
    farezones: "Fare Zones",
    distances: "Distances",
  },
};

// How the record of names should look like before filling with locations and their location-names.
// const cleosNames: Record<Locale, Record<string, string>> = {
//   "nb-NO": {},
//   "nn-NO": {},
//   "en-GB": {},
// };

const partnerGenericPages = ["users", "help"];

export const locationsByApp: Partial<Record<PortalApplicationId, AppLocations>> = {
  // TODO: Write location names for the apps below, then remove the comment marks.
  // bedrift: { names: { "nb-NO": {}, "nn-NO": {}, "en-GB": {} }, genericPages: [] },
  // cleos: { names: cleosNames, genericPages: [] },
  // nplan: { names: { "nb-NO": {}, "nn-NO": {}, "en-GB": {} }, genericPages: [] },
  // "ops-center": { names: { "nb-NO": {}, "nn-NO": {}, "en-GB": {} }, genericPages: [] },
  partner: { names: partnerNames, genericPages: partnerGenericPages },
  // skoleskyss: { names: { "nb-NO": {}, "nn-NO": {}, "en-GB": {} }, genericPages: [] },
  // sorvis: { names: { "nb-NO": {}, "nn-NO": {}, "en-GB": {} }, genericPages: [] },
  // varslingssenter: { names: { "nb-NO": {}, "nn-NO": {}, "en-GB": {} }, genericPages: [] },
};
