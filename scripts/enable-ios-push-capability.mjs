/**
 * Enable Push Notifications on Apple App ID + delete stale Expo provisioning profile.
 * Non-interactive EAS skips capability sync, so profiles are created without aps-environment.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createPrivateKey, createSign } from 'crypto';

const BUNDLE_ID = 'com.fabricaapps.setmatch';
const PROJECT = '@gabrieljorda0/setmatch-app';

const state = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8')
);
const session =
  state.auth?.sessionSecret || state.session?.sessionSecret || state.auth?.session || null;
const token = state.auth?.accessToken || null;
if (!session && !token) {
  console.error('NO_SESSION');
  process.exit(1);
}

const expoHeaders = {
  'content-type': 'application/json',
  ...(session ? { 'expo-session': session } : {}),
  ...(token ? { authorization: `Bearer ${token}` } : {}),
};

async function expoGql(query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: expoHeaders,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    throw new Error('expo gql');
  }
  return json.data;
}

function makeAscJwt(keyId, issuerId, keyP8) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: 'appstoreconnect-v1',
    })
  ).toString('base64url');
  const data = `${header}.${payload}`;
  const key = createPrivateKey(keyP8);
  const sign = createSign('SHA256');
  sign.update(data);
  sign.end();
  const sig = sign.sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${data}.${sig}`;
}

async function ascFetch(jwt, urlPath, options = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error('ASC error', res.status, JSON.stringify(body, null, 2));
    throw new Error(`ASC ${res.status}`);
  }
  return body;
}

// 1) Get ASC API key from Expo
const keyData = await expoGql(`
  query {
    app {
      byFullName(fullName: "${PROJECT}") {
        iosAppCredentials {
          id
          appleAppIdentifier { bundleIdentifier }
          appStoreConnectApiKeyForSubmissions {
            id
            keyIdentifier
            issuerIdentifier
            keyP8
            name
          }
        }
      }
    }
  }
`);

const cred = (keyData.app.byFullName.iosAppCredentials || []).find(
  (c) => c.appleAppIdentifier?.bundleIdentifier === BUNDLE_ID
);
const ascKey = cred?.appStoreConnectApiKeyForSubmissions;
if (!ascKey?.keyP8 || !ascKey.keyIdentifier || !ascKey.issuerIdentifier) {
  console.error('ASC key missing on Expo credentials');
  process.exit(1);
}
console.log('ASC_KEY', ascKey.name, ascKey.keyIdentifier);

const jwt = makeAscJwt(ascKey.keyIdentifier, ascKey.issuerIdentifier, ascKey.keyP8);

// 2) Find bundle ID resource
const bundles = await ascFetch(
  jwt,
  `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}`
);
const bundle = bundles.data?.[0];
if (!bundle) {
  console.error('Bundle ID not found on Apple');
  process.exit(1);
}
console.log('BUNDLE', bundle.id, bundle.attributes?.identifier);

// 3) List current capabilities
const caps = await ascFetch(jwt, `/v1/bundleIds/${bundle.id}/bundleIdCapabilities`);
const hasPush = (caps.data || []).some(
  (c) => c.attributes?.capabilityType === 'PUSH_NOTIFICATIONS'
);
console.log('HAS_PUSH', hasPush);

if (!hasPush) {
  console.log('Enabling PUSH_NOTIFICATIONS...');
  await ascFetch(jwt, '/v1/bundleIdCapabilities', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'bundleIdCapabilities',
        attributes: { capabilityType: 'PUSH_NOTIFICATIONS', settings: [] },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        },
      },
    }),
  });
  console.log('PUSH_ENABLED');
} else {
  console.log('Push already enabled on App ID');
}

// 4) Delete Expo provisioning profiles so next build recreates with Push
const profiles = [];
for (const c of keyData.app.byFullName.iosAppCredentials || []) {
  if (c.appleAppIdentifier?.bundleIdentifier !== BUNDLE_ID) continue;
  // re-query build credentials with profile
}
const full = await expoGql(`
  query {
    app {
      byFullName(fullName: "${PROJECT}") {
        iosAppCredentials {
          appleAppIdentifier { bundleIdentifier }
          iosAppBuildCredentialsList {
            iosDistributionType
            provisioningProfile { id developerPortalIdentifier }
          }
        }
      }
    }
  }
`);
const ids = [];
for (const c of full.app.byFullName.iosAppCredentials || []) {
  if (c.appleAppIdentifier?.bundleIdentifier !== BUNDLE_ID) continue;
  for (const b of c.iosAppBuildCredentialsList || []) {
    if (b.provisioningProfile?.id) {
      ids.push(b.provisioningProfile.id);
      console.log(
        'DELETE_PROFILE',
        b.iosDistributionType,
        b.provisioningProfile.developerPortalIdentifier
      );
    }
  }
}
if (ids.length) {
  await expoGql(
    `mutation($ids: [ID!]!) {
      appleProvisioningProfile {
        deleteAppleProvisioningProfiles(ids: $ids) { id }
      }
    }`,
    { ids }
  );
  console.log('PROFILES_DELETED', ids.length);
} else {
  console.log('NO_PROFILES_TO_DELETE');
}

console.log('DONE — run eas build again');
