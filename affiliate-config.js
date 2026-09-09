/*
  SMART BUYER GUIDE — AFFILIATE CONFIGURATION
  ------------------------------------------------
  This is the ONLY file you need to edit for affiliate links.
*/

window.SBG_CONFIG = {
  defaultAffiliateLink: "https://bluehost.sjv.io/c/7706622/1376228/11352",

  links: {
    crm: "",
    hosting: "https://bluehost.sjv.io/c/7706622/1376228/11352",
    "business-software": "",
    "email-marketing": ""
  }
};

/*
  COMPATIBILITY SHIM — TOEGEVOEGD
  ------------------------------------------------
  guide-crm.html, guide-hosting-cheap.html, guide-hosting-beginners.html en
  guide-hosting-small-business.html roepen SBG.affiliateLink('key') aan.
  Die functie bestond nergens, waardoor de affiliate-link op die 4 pagina's
  NOOIT werd ingevuld — ook niet als er wel een link geconfigureerd stond.

  Deze shim voegt die functie toe zodat alle bestaande pagina's, ongeacht
  welk patroon ze gebruiken, dezelfde SBG_CONFIG-data correct uitlezen.
  Geen enkele HTML-pagina hoeft hiervoor aangepast te worden.
*/
window.SBG = window.SBG || {};
window.SBG.affiliateLink = function (key) {
  const cfg = window.SBG_CONFIG || {};
  return (cfg.links && cfg.links[key]) || cfg.defaultAffiliateLink || "";
};
