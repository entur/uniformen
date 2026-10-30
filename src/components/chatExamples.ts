import type { Locale } from "../types";
import type { PortalApplicationId } from "./portalApplications";

/**
 * The example questions for each application that has its own. Other applications
 * get the general questions in `ChatDrawer`.
 */
export const examplesByApp: Partial<
  Record<PortalApplicationId, Record<Locale, readonly string[]>>
> = {
  // TODO: Write example questions for the apps below, if specific example questions are wanted
  // bedrift: {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
  // cleos: {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
  // nplan: {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
  // "ops-center": {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
  partner: {
    "nb-NO": [
      "Hvor ser jeg mine avtaler?",
      "Hvor kan jeg se terminalrapporter?",
      "Hvem kontakter man ved problemer?",
    ],
    "nn-NO": [
      "Kvar ser eg avtalene mine?",
      "Kvar kan eg sjå terminalrapportar?",
      "Kven kontaktar ein ved problem?",
    ],
    "en-GB": [
      "Where can I see my agreements?",
      "Where can I see terminal reports?",
      "Who do I contact if there are problems?",
    ],
  },
  // skoleskyss: {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
  // sorvis: {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
  // varslingssenter: {
  //   "nb-NO": [],
  //   "nn-NO": [],
  //   "en-GB": [],
  // },
};
