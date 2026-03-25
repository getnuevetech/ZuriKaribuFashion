/* eslint-disable no-console */
(function () {
  var ENDPOINTS = [
    "/api/jenks-homepage/config",
    "/api/homepage-sections/jenks-config",
    "/api/homepage-sections/config"
  ];

  var SELECTORS = {
    navigation: 'header[code-path^="src/sections/Navigation.tsx:68:7"]',
    hero: 'section[code-path^="src/sections/HeroSection.tsx:191:5"]',
    shopBy: 'section[code-path^="src/sections/ShopByBlocks.tsx:136:5"]',
    trustBadgesA: 'section[code-path^="src/sections/TrustBadges.tsx:83:7"]',
    trustBadgesB: 'section[code-path^="src/sections/TrustBadges.tsx:130:5"]',
    countries: 'section[code-path^="src/sections/ShopByCountry.tsx:80:5"]',
    featuredRtw: 'section[code-path^="src/sections/ReadyToWear.tsx:109:5"]',
    featuredFabrics: 'section[code-path^="src/sections/FabricsToBuy.tsx:109:5"]',
    featuredCustom: 'section[code-path^="src/sections/CustomToWear.tsx:109:5"]',
    howItWorks: 'section[code-path^="src/sections/HowItWorks.tsx:102:5"]',
    featureCustomSplit: 'section[code-path^="src/sections/FeaturedCustom.tsx:95:5"]',
    featureReadySplit: 'section[code-path^="src/sections/FeaturedReadyToWear.tsx:95:5"]',
    freshDrops: 'section[code-path^="src/sections/FreshDrops.tsx:124:5"]',
    designer: 'section[code-path^="src/sections/DesignerSpotlight.tsx:85:5"]',
    heritage: 'section[code-path^="src/sections/HeritageStory.tsx:113:5"]',
    contact: 'section[code-path^="src/sections/ContactFooter.tsx:73:5"]'
  };

  function asText(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function asHref(value) {
    var v = asText(value);
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.charAt(0) !== "/") return "";
    return v;
  }

  function pick() {
    for (var i = 0; i < arguments.length; i += 1) {
      var text = asText(arguments[i]);
      if (text) return text;
    }
    return "";
  }

  function setText(selector, value) {
    var node = document.querySelector(selector);
    var text = asText(value);
    if (!node || !text) return false;
    node.textContent = text;
    return true;
  }

  function setAttr(selector, attr, value) {
    var node = document.querySelector(selector);
    var text = asText(value);
    if (!node || !text) return false;
    node.setAttribute(attr, text);
    return true;
  }

  function setHref(selector, href) {
    var node = document.querySelector(selector);
    var nextHref = asHref(href);
    if (!node || !nextHref) return false;
    node.setAttribute("href", nextHref);
    return true;
  }

  function setVisible(selector, isVisible) {
    var node = document.querySelector(selector);
    if (!node) return false;
    node.style.display = isVisible ? "" : "none";
    return true;
  }

  function setVisibleAll(selectors, isVisible) {
    for (var i = 0; i < selectors.length; i += 1) {
      setVisible(selectors[i], isVisible);
    }
  }

  function applyStyle(node, prop, value) {
    if (!node) return;
    if (value === null || value === undefined || value === "") return;
    node.style[prop] = String(value);
  }

  function withWordLimit(text, maxWords) {
    var source = asText(text);
    var words = source.split(/\s+/).filter(Boolean);
    var limit = Number(maxWords);
    if (!Number.isFinite(limit) || limit <= 0 || words.length <= limit) return source;
    return words.slice(0, limit).join(" ");
  }

  function normalizeConfig(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.success && payload.data && typeof payload.data === "object") return payload.data;
    return payload;
  }

  function applySectionVisibility(config) {
    var visibility = (config.sections && config.sections.visibility) || {};
    var map = {
      hero: [SELECTORS.hero],
      categories: [SELECTORS.shopBy],
      statsStrip: [SELECTORS.trustBadgesA, SELECTORS.trustBadgesB],
      countries: [SELECTORS.countries],
      featuredReadyToWear: [SELECTORS.featuredRtw, SELECTORS.featureReadySplit],
      featuredFabrics: [SELECTORS.featuredFabrics],
      featuredCustomToWear: [SELECTORS.featuredCustom, SELECTORS.featureCustomSplit],
      howItWorks: [SELECTORS.howItWorks],
      promoBanner: [SELECTORS.freshDrops],
      designerSpotlight: [SELECTORS.designer],
      heritage: [SELECTORS.heritage],
      cta: [SELECTORS.contact]
    };
    Object.keys(map).forEach(function (key) {
      if (typeof visibility[key] === "boolean") {
        setVisibleAll(map[key], visibility[key] !== false);
      }
    });
  }

  function applyCopy(config) {
    var copy = (config.experience && config.experience.jenksCopy) || {};

    setText('[code-path="src/sections/HeroSection.tsx:231:11"]', copy.heroEyebrow);
    setText('[code-path="src/sections/ShopByBlocks.tsx:144:11"]', copy.shopByEyebrow);
    setText(
      '[code-path="src/sections/ShopByBlocks.tsx:145:11"]',
      pick(copy.shopByTitle, config.shopByBlocks && config.shopByBlocks.title)
    );
    setText('[code-path="src/sections/ReadyToWear.tsx:141:11"]', copy.featuredRtwTitle);
    setText('[code-path="src/sections/FabricsToBuy.tsx:141:11"]', copy.featuredFabricsTitle);
    setText('[code-path="src/sections/CustomToWear.tsx:141:11"]', copy.featuredDesignsTitle);
    setText('[code-path="src/sections/DesignerSpotlight.tsx:117:13"]', copy.designerSpotlightTitle);

    var quickPathLabels = [
      copy.quickPathRtwLabel || "",
      copy.quickPathCustomLabel || "",
      copy.quickPathFabricsLabel || ""
    ];
    var quickPathLinks = ["/ready-to-wear", "/custom", "/fabrics"];
    var quickPathLabelNodes = document.querySelectorAll('[code-path="src/sections/HeroSection.tsx:256:17"]');
    var quickPathLinkNodes = document.querySelectorAll('[code-path="src/sections/HeroSection.tsx:250:15"]');
    for (var i = 0; i < quickPathLabelNodes.length && i < 3; i += 1) {
      if (asText(quickPathLabels[i])) quickPathLabelNodes[i].textContent = asText(quickPathLabels[i]);
      if (quickPathLinkNodes[i]) quickPathLinkNodes[i].setAttribute("href", quickPathLinks[i]);
    }
  }

  function applyNavigation(config) {
    var navigation = (config && config.navigation) || {};
    var navRoot = document.querySelector(SELECTORS.navigation);
    if (!navRoot) return;
    var logoText = asText(navigation.logoText);
    if (logoText) {
      var logoNodes = navRoot.querySelectorAll('[code-path="src/sections/Navigation.tsx:84:13"]');
      for (var i = 0; i < logoNodes.length; i += 1) logoNodes[i].textContent = logoText;
    }
    var hamburgerLinks = Array.isArray(navigation.hamburgerMenuLinks) ? navigation.hamburgerMenuLinks : [];
    if (hamburgerLinks.length > 0) {
      var linkNodes = navRoot.querySelectorAll('a[code-path="src/sections/Navigation.tsx:117:13"]');
      var labelNodes = navRoot.querySelectorAll('span[code-path="src/sections/Navigation.tsx:124:15"]');
      var count = Math.min(hamburgerLinks.length, linkNodes.length, labelNodes.length);
      for (var j = 0; j < count; j += 1) {
        var item = hamburgerLinks[j] || {};
        if (item.enabled === false) continue;
        var href = asHref(item.href);
        if (href) linkNodes[j].setAttribute("href", href);
        if (asText(item.label)) labelNodes[j].textContent = asText(item.label);
      }
    }
  }

  function applyHeroBanners(config) {
    var hero = (config && config.hero) || {};
    var banners = Array.isArray(hero.banners) ? hero.banners : [];
    if (banners.length === 0) return;
    var first = banners.filter(function (item) { return item && item.enabled !== false; })[0];
    if (!first) return;
    setText('[code-path="src/sections/HeroSection.tsx:220:11"]', pick(first.title));
    setText('[code-path="src/sections/HeroSection.tsx:231:11"]', pick(first.text, first.eyebrow));
    setText('[code-path="src/sections/HeroSection.tsx:239:11"]', pick(first.subtitle, first.description));
    setText('[code-path="src/sections/HeroSection.tsx:269:15"]', first.primaryCtaText);
    setHref('[code-path="src/sections/HeroSection.tsx:263:13"]', first.primaryCtaLink);
    var secondary = document.querySelector('[code-path="src/sections/HeroSection.tsx:275:11"]');
    if (secondary && asText(first.secondaryCtaText)) {
      secondary.textContent = asText(first.secondaryCtaText);
      if (asHref(first.secondaryCtaLink)) secondary.setAttribute("href", asHref(first.secondaryCtaLink));
    }
    if (asText(first.image)) {
      var imageNode = document.querySelector('[code-path="src/sections/HeroSection.tsx:200:9"] img');
      if (imageNode) imageNode.setAttribute("src", asText(first.image));
    }
  }

  function applyTrustBadges(config) {
    var experience = (config && config.experience) || {};
    var style = experience.trustBadgeStyle || {};
    var badges = Array.isArray(experience.trustBadges) ? experience.trustBadges : [];
    var active = badges.filter(function (item) { return item && item.enabled !== false; });
    var containers = [
      document.querySelector(SELECTORS.trustBadgesA),
      document.querySelector(SELECTORS.trustBadgesB)
    ];
    for (var i = 0; i < containers.length; i += 1) {
      var container = containers[i];
      if (!container) continue;
      var titleNode = container.querySelector('[code-path="src/sections/TrustBadges.tsx:89:17"], [code-path="src/sections/TrustBadges.tsx:102:11"]');
      var subtitleNode = container.querySelector('[code-path="src/sections/TrustBadges.tsx:119:17"], [code-path="src/sections/TrustBadges.tsx:104:13"]');
      if (titleNode && asText(style.sectionTitle)) titleNode.textContent = asText(style.sectionTitle);
      if (subtitleNode && asText(style.sectionSubtitle)) subtitleNode.textContent = asText(style.sectionSubtitle);

      var cardNodes = container.querySelectorAll('[code-path="src/sections/TrustBadges.tsx:92:15"], [code-path="src/sections/TrustBadges.tsx:136:17"]');
      var iconWrapNodes = container.querySelectorAll('[code-path="src/sections/TrustBadges.tsx:97:17"], [code-path="src/sections/TrustBadges.tsx:138:19"]');
      var badgeTitleNodes = container.querySelectorAll('[code-path="src/sections/TrustBadges.tsx:98:17"], [code-path="src/sections/TrustBadges.tsx:140:17"]');
      var badgeSubtitleNodes = container.querySelectorAll('[code-path="src/sections/TrustBadges.tsx:99:17"], [code-path="src/sections/TrustBadges.tsx:119:17"]');

      var cols = Number(style.layoutColumns);
      if (Number.isFinite(cols) && cols > 0 && cardNodes.length > 0) {
        var gridParent = cardNodes[0].parentElement;
        if (gridParent) {
          if (String(style.arrangement || "").toUpperCase() === "ROW") {
            gridParent.style.display = "flex";
            gridParent.style.flexWrap = "wrap";
            gridParent.style.justifyContent = "space-between";
          } else {
            gridParent.style.display = "grid";
            gridParent.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
          }
        }
      }

      for (var j = 0; j < cardNodes.length; j += 1) {
        var item = active[j] || active[active.length - 1] || null;
        if (!item) continue;
        if (item.enabled === false) continue;
        if (badgeTitleNodes[j]) {
          var title = withWordLimit(item.title, item.maxTitleWords || style.maxTitleWords);
          if (title) badgeTitleNodes[j].textContent = title;
          applyStyle(badgeTitleNodes[j], "color", item.titleColor || style.titleColor);
          applyStyle(badgeTitleNodes[j], "fontSize", (item.titleFontSize || style.titleFontSize || 0) + "px");
        }
        if (badgeSubtitleNodes[j]) {
          var subtitle = withWordLimit(item.subtitle, item.maxSubtitleWords || style.maxSubtitleWords);
          if (subtitle) badgeSubtitleNodes[j].textContent = subtitle;
          applyStyle(badgeSubtitleNodes[j], "color", item.subtitleColor || style.subtitleColor);
          applyStyle(badgeSubtitleNodes[j], "fontSize", (item.subtitleFontSize || style.subtitleFontSize || 0) + "px");
        }
        applyStyle(cardNodes[j], "backgroundColor", item.cardBackgroundColor || style.cardBackgroundColor);
        applyStyle(cardNodes[j], "borderColor", item.cardBorderColor || style.cardBorderColor);
        if (iconWrapNodes[j]) {
          applyStyle(iconWrapNodes[j], "color", item.iconColor || style.iconColor);
          var svgNode = iconWrapNodes[j].querySelector("svg");
          if (svgNode && (item.iconSize || style.iconSize)) {
            var size = String(item.iconSize || style.iconSize) + "px";
            svgNode.style.width = size;
            svgNode.style.height = size;
          }
        }
      }
    }
  }

  function applyShopBy(config) {
    var blocks = config.shopByBlocks || {};
    setText('[code-path="src/sections/ShopByBlocks.tsx:148:11"]', blocks.subtitle);
  }

  function applyFreshDrops(config) {
    var fresh = config.freshDrops || {};
    setText('[code-path="src/sections/FreshDrops.tsx:132:13"]', fresh.eyebrow);
    setText(
      '[code-path="src/sections/FreshDrops.tsx:135:13"]',
      pick(fresh.title, fresh.subtitle)
    );
    setText('[code-path="src/sections/FreshDrops.tsx:145:15"]', fresh.ctaText);
    setHref('[code-path="src/sections/FreshDrops.tsx:141:13"]', fresh.ctaLink);
  }

  function applyCta(config) {
    var cta = config.cta || {};
    setText('[code-path="src/sections/HeroSection.tsx:269:15"]', cta.primaryCtaText);
    setHref('[code-path="src/sections/HeroSection.tsx:263:13"]', cta.primaryCtaLink);
    if (cta.backgroundImage && document.querySelector(SELECTORS.contact)) {
      var contactNode = document.querySelector(SELECTORS.contact);
      contactNode.style.backgroundImage =
        "linear-gradient(rgba(248,246,241,0.94), rgba(248,246,241,0.96)), url(" +
        cta.backgroundImage +
        ")";
      contactNode.style.backgroundSize = "cover";
      contactNode.style.backgroundPosition = "center";
    }
  }

  function applyNewsletter(config) {
    var newsletter = config.newsletter || {};
    setText('[code-path="src/sections/ContactFooter.tsx:85:13"]', newsletter.title);
    setText('[code-path="src/sections/ContactFooter.tsx:88:13"]', newsletter.subtitle);
    setAttr('[code-path="src/sections/ContactFooter.tsx:95:15"]', "placeholder", newsletter.emailPlaceholder);
    setText('[code-path="src/sections/ContactFooter.tsx:106:19"]', newsletter.submitLabel);
    if (newsletter.enabled === false) {
      setVisible(SELECTORS.contact, false);
    }
  }

  function applyConfig(config) {
    if (!config) return false;
    applyNavigation(config);
    applySectionVisibility(config);
    applyHeroBanners(config);
    applyTrustBadges(config);
    applyCopy(config);
    applyShopBy(config);
    applyFreshDrops(config);
    applyCta(config);
    applyNewsletter(config);
    return true;
  }

  function loadConfig() {
    var chain = Promise.reject(new Error("no endpoint"));
    ENDPOINTS.forEach(function (endpoint) {
      chain = chain.catch(function () {
        return fetch(endpoint, {
          method: "GET",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache" }
        }).then(function (response) {
          if (!response.ok) throw new Error("request failed");
          return response.json();
        });
      });
    });
    return chain.then(normalizeConfig).catch(function () {
      return null;
    });
  }

  function start() {
    loadConfig().then(function (config) {
      if (!config) return;
      var tries = 0;
      var maxTries = 60;
      var timer = setInterval(function () {
        tries += 1;
        applyConfig(config);
        if (tries >= maxTries) {
          clearInterval(timer);
        }
      }, 250);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
