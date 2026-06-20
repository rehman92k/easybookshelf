'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PublisherProfile } from '@easybookshelf/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  PageLoading,
  inputClassName,
  labelClassName,
} from '@easybookshelf/ui';
import { PublisherAuthGate } from '@/components/publisher-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { updateProfile } from '@/lib/auth';
import {
  isValidIndianMobile,
  normalizeIndianMobile,
} from '@/lib/phone';
import { fetchPublisherProfile, updatePublisherProfile } from '@/lib/publisher';
import {
  COUNTRIES,
  getPostalCodeLabel,
  getRegionLabelForCountry,
  getRegionsForCountry,
  isValidPostalCode,
  matchGeoOption,
  normalizePostalCode,
} from '@/lib/geo';
import { ComboboxField } from '@/components/combobox-field';

export default function PublisherProfilePage() {
  const { user, refreshUser } = useAuth();
  const [publisher, setPublisher] = useState<PublisherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regionOptions = useMemo(() => getRegionsForCountry(country), [country]);
  const regionLabel = useMemo(() => getRegionLabelForCountry(country), [country]);
  const postalCodeLabel = useMemo(() => getPostalCodeLabel(country), [country]);

  function handleCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    const nextRegions = getRegionsForCountry(nextCountry);
    if (nextRegions.length > 0 && !matchGeoOption(nextRegions, state)) {
      setState('');
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const profile = await fetchPublisherProfile();
        setPublisher(profile);
        setBrandName(profile.name);
        setAddressLine(profile.addressLine ?? '');
        setState(profile.state ?? '');
        setCountry(profile.country?.trim() ?? '');
        setPincode(profile.pincode ?? '');
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load publisher profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    setName(user.displayName);
    setPhone(user.phone ?? '');
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const trimmedName = name.trim();
      const trimmedBrandName = brandName.trim();

      if (!trimmedName) {
        setError('Name is required');
        return;
      }
      if (!trimmedBrandName) {
        setError('Publishing brand name is required');
        return;
      }
      if (!phone.trim()) {
        setError('Mobile number is required');
        return;
      }
      if (!isValidIndianMobile(phone)) {
        setError('Enter a valid 10-digit Indian mobile number');
        return;
      }
      if (!addressLine.trim()) {
        setError('Address is required');
        return;
      }
      if (!country.trim()) {
        setError('Country is required');
        return;
      }
      const normalizedCountry = matchGeoOption(COUNTRIES, country);
      if (!normalizedCountry) {
        setError('Choose a valid country from the list');
        return;
      }
      const regionLabelForCountry = getRegionLabelForCountry(normalizedCountry);
      const postalLabelForCountry = getPostalCodeLabel(normalizedCountry);
      if (!state.trim()) {
        setError(`${regionLabelForCountry} is required`);
        return;
      }
      const regions = getRegionsForCountry(normalizedCountry);
      let normalizedState = state.trim();
      if (regions.length > 0) {
        const matchedState = matchGeoOption(regions, state);
        if (!matchedState) {
          setError(`Choose a valid ${regionLabelForCountry.toLowerCase()} from the list`);
          return;
        }
        normalizedState = matchedState;
      } else if (normalizedState.length < 2) {
        setError(`${regionLabelForCountry} is required`);
        return;
      }
      if (!pincode.trim()) {
        setError(`${postalLabelForCountry} is required`);
        return;
      }
      if (!isValidPostalCode(normalizedCountry, pincode)) {
        setError(
          normalizedCountry === 'India'
            ? 'Enter a valid 6-digit PIN code'
            : 'Enter a valid postal code',
        );
        return;
      }

      const [, updatedPublisher] = await Promise.all([
        updateProfile({
          displayName: trimmedName,
          phone: normalizeIndianMobile(phone),
        }),
        updatePublisherProfile({
          name: trimmedBrandName,
          addressLine: addressLine.trim(),
          state: normalizedState,
          country: normalizedCountry,
          pincode: normalizePostalCode(normalizedCountry, pincode),
        }),
      ]);

      await refreshUser();
      setPublisher(updatedPublisher);
      setMessage('Profile saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PublisherAuthGate loginNext="/profile">
      <PageHeader
        title="Profile"
        description="Manage your account and publisher details."
      />

      {loading ? (
        <PageLoading message="Loading profile…" />
      ) : loadError ? (
        <Alert variant="error">
          {loadError}
          <p className="mt-2">
            <Link href="/onboard" className="underline">
              Complete publisher onboarding
            </Link>
          </p>
        </Alert>
      ) : (
        <Card className="max-w-4xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold">Your profile</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                Your name is for your account. Your publishing brand name appears on books you publish.
                Fields marked with <span className="text-red-600 dark:text-red-400">*</span> are required.
              </p>
            </div>
            {publisher && (
              <Badge variant="muted">{publisher.status.replace('_', ' ')}</Badge>
            )}
          </div>

          {message && (
            <Alert variant="success" className="mt-4">
              {message}
            </Alert>
          )}
          {error && (
            <Alert variant="error" className="mt-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSave} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelClassName}>
                  Name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClassName}
                />
                <p className="mt-1 text-xs text-stone-500">Shown on your account and in the portal sidebar.</p>
              </div>
              <div>
                <label htmlFor="brand-name" className={labelClassName}>
                  Publishing brand name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="brand-name"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                  className={inputClassName}
                  placeholder="e.g. Sharma Publishing or your author pen name"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Shown on your books and in the admin review queue.
                </p>
              </div>
              <div>
                <label htmlFor="email" className={labelClassName}>
                  Email
                </label>
                <input
                  id="email"
                  value={user?.email ?? ''}
                  readOnly
                  className={`${inputClassName} bg-stone-50 dark:bg-stone-800/50`}
                />
              </div>
              <div>
                <label htmlFor="phone" className={labelClassName}>
                  Mobile <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="account-type" className={labelClassName}>
                  Account type
                </label>
                <input
                  id="account-type"
                  value={publisher?.type === 'author' ? 'Self-published author' : 'Publisher'}
                  readOnly
                  className={`${inputClassName} bg-stone-50 dark:bg-stone-800/50`}
                />
              </div>
              <div>
                <label htmlFor="slug" className={labelClassName}>
                  Public slug
                </label>
                <input
                  id="slug"
                  value={publisher?.slug ?? ''}
                  readOnly
                  className={`${inputClassName} bg-stone-50 dark:bg-stone-800/50`}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="address" className={labelClassName}>
                  Address <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <textarea
                  id="address"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  rows={2}
                  required
                  className={inputClassName}
                  placeholder="Street, area, city"
                />
              </div>
              <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="country" className={labelClassName}>
                    Country <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <ComboboxField
                    id="country"
                    value={country}
                    onChange={handleCountryChange}
                    options={COUNTRIES}
                    placeholder="Search or choose country"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="state" className={labelClassName}>
                    {regionLabel} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  {regionOptions.length > 0 ? (
                    <ComboboxField
                      key={country}
                      id="state"
                      value={state}
                      onChange={setState}
                      options={regionOptions}
                      placeholder={
                        country
                          ? `Search or choose ${regionLabel.toLowerCase()}`
                          : 'Choose country first'
                      }
                      required
                      disabled={!country}
                    />
                  ) : (
                    <input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      disabled={!country}
                      className={inputClassName}
                      placeholder={`Enter ${regionLabel.toLowerCase()}`}
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="pincode" className={labelClassName}>
                    {postalCodeLabel} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="pincode"
                    type="text"
                    inputMode={country === 'India' ? 'numeric' : 'text'}
                    value={pincode}
                    onChange={(e) => setPincode(normalizePostalCode(country, e.target.value))}
                    required
                    className={inputClassName}
                    placeholder={country === 'India' ? '6-digit PIN' : 'Postal code'}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="mt-6">
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Card>
      )}
    </PublisherAuthGate>
  );
}
