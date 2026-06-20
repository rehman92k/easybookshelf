import { CITIES_BY_COUNTRY, COUNTRY_GEO, type CountryGeoConfig, type RegionKind } from './regions-data';

export { INDIAN_STATES } from './indian-states';
export type { CountryGeoConfig, RegionKind };

const OTHER_COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Argentina',
  'Australia',
  'Austria',
  'Bangladesh',
  'Belgium',
  'Bhutan',
  'Brazil',
  'Canada',
  'China',
  'Colombia',
  'Denmark',
  'Egypt',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hong Kong',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Kenya',
  'Kuwait',
  'Malaysia',
  'Maldives',
  'Mexico',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Oman',
  'Pakistan',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Russia',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Sweden',
  'Switzerland',
  'Thailand',
  'Turkey',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
] as const;

/** India first, then other countries alphabetically. */
export const COUNTRIES = ['India', ...OTHER_COUNTRIES] as const;

export function matchGeoOption(options: readonly string[], input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const exact = options.find((option) => option === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  return options.find((option) => option.toLowerCase() === lower) ?? null;
}

export function getCountryGeo(country: string): CountryGeoConfig | null {
  return COUNTRY_GEO[country] ?? null;
}

export function getRegionsForCountry(country: string): readonly string[] {
  const geo = getCountryGeo(country);
  if (geo) return geo.regions;
  return CITIES_BY_COUNTRY[country] ?? [];
}

export function getRegionKindForCountry(country: string): RegionKind {
  const geo = getCountryGeo(country);
  if (geo) return geo.regionKind;
  if (CITIES_BY_COUNTRY[country]) return 'city';
  return 'state';
}

export function getRegionLabelForCountry(country: string): string {
  const geo = getCountryGeo(country);
  if (geo) return geo.regionLabel;
  if (CITIES_BY_COUNTRY[country]) return 'City';
  return 'State / region';
}

export function getPostalCodeLabel(country: string): string {
  return country === 'India' ? 'PIN code' : 'Postal code';
}

export function isValidPostalCode(country: string, input: string): boolean {
  const code = input.trim();
  if (!code) return false;
  if (country === 'India') return /^\d{6}$/.test(code);
  if (country === 'United States') return /^\d{5}(-\d{4})?$/.test(code);
  if (country === 'United Kingdom') return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(code);
  if (country === 'Canada') return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(code);
  return /^[A-Za-z0-9\s-]{3,12}$/.test(code);
}

export function normalizePostalCode(country: string, input: string): string {
  const trimmed = input.trim();
  if (country === 'India') return trimmed.replace(/\D/g, '').slice(0, 6);
  if (country === 'United States') return trimmed.replace(/[^\d-]/g, '').slice(0, 10);
  return trimmed.slice(0, 12);
}
