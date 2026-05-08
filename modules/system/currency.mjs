const COPPER_PER_SILVER = 100;
const COPPER_PER_GOLD = 10000;

export function getAxiomCurrencySettings() {
  const settings = game.settings;
  const mode = settings?.get("axiom", "currencyMode") ?? "standard";
  const standardName = settings?.get("axiom", "standardCurrencyName") || game.i18n.localize("AXIOM.Currency.DefaultName");
  const standardSymbol = settings?.get("axiom", "standardCurrencySymbol") ?? "$";

  return {
    mode,
    isFantasy: mode === "fantasy",
    isStandard: mode !== "fantasy",
    standardName,
    standardSymbol,
    standardLabel: standardSymbol ? `${standardName} (${standardSymbol})` : standardName
  };
}

export function coerceCurrencyNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function priceCoinsToValue(coins = {}) {
  const gold = coerceCurrencyNumber(coins.gold);
  const silver = coerceCurrencyNumber(coins.silver);
  const copper = coerceCurrencyNumber(coins.copper);
  return (gold * COPPER_PER_GOLD) + (silver * COPPER_PER_SILVER) + copper;
}

export function valueToPriceCoins(value = 0) {
  let remaining = coerceCurrencyNumber(value);
  const gold = Math.floor(remaining / COPPER_PER_GOLD);
  remaining -= gold * COPPER_PER_GOLD;
  const silver = Math.floor(remaining / COPPER_PER_SILVER);
  remaining -= silver * COPPER_PER_SILVER;
  return { gold, silver, copper: remaining };
}

export function getStoredPriceCoins(system = {}) {
  const coins = system.priceCoins ?? {};
  const hasCoins = [coins.gold, coins.silver, coins.copper].some(value => coerceCurrencyNumber(value) > 0);
  return hasCoins ? {
    gold: coerceCurrencyNumber(coins.gold),
    silver: coerceCurrencyNumber(coins.silver),
    copper: coerceCurrencyNumber(coins.copper)
  } : valueToPriceCoins(system.price ?? 0);
}

export function getStoredCurrencyCoins(currency = {}) {
  const coins = currency.coins ?? {};
  const hasCoins = [coins.gold, coins.silver, coins.copper].some(value => coerceCurrencyNumber(value) > 0);
  return hasCoins ? {
    gold: coerceCurrencyNumber(coins.gold),
    silver: coerceCurrencyNumber(coins.silver),
    copper: coerceCurrencyNumber(coins.copper)
  } : valueToPriceCoins(currency.value ?? 0);
}

export function formatAxiomPrice(system = {}) {
  const settings = getAxiomCurrencySettings();

  if (settings.isFantasy) {
    const coins = getStoredPriceCoins(system);
    const parts = [];
    if (coins.gold) parts.push(game.i18n.format("AXIOM.Currency.GoldShort", { value: coins.gold }));
    if (coins.silver) parts.push(game.i18n.format("AXIOM.Currency.SilverShort", { value: coins.silver }));
    if (coins.copper || !parts.length) parts.push(game.i18n.format("AXIOM.Currency.CopperShort", { value: coins.copper }));
    return parts.join(" ");
  }

  const value = coerceCurrencyNumber(system.price ?? 0);
  if (!value) return "";
  return `${settings.standardSymbol}${value}`;
}

export function prepareCurrencyContext() {
  return getAxiomCurrencySettings();
}
