/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the
 Apache License, Version 2.0 (the 'License') and you may not use these files
 except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files
 are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the specific language
 governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Matt Kingston - matt.kingston@modusbox.com
 - Vijaya Kumar Guthi <vijaya.guthi@modusbox.com>

 --------------
 ******/

import got, { Method, OptionsOfJSONResponseBody } from 'got';
import {
    mlIngressBasePath,
    proxyPrefix,
    username,
    password,
} from '../config';
import login from '../login';
import {
  User,
  TestParameters
} from './types';

import { getUser, clearUserRoles, appendUserRole, getAllowDenyList, allowCheck, denyCheck } from './helpers'
import { CookieJar } from 'tough-cookie';

let testUser: User;
let cookieJarObj: CookieJar;

beforeAll(async () => {
  const user = await getUser();
  const { cookieJar } = await login(username, password, mlIngressBasePath);
  cookieJarObj = cookieJar;
  testUser = user!;
});

beforeEach(async () => {
    await clearUserRoles(testUser.id);
})

afterAll(async () => {
    await clearUserRoles(testUser.id);
});

// Tests start here

const _participantViewTests = getAllowDenyList([
  'operator',
  'manager',
  'clerk',
  'financeManager',
], [
  'dfspReconciliationReports',
  'audit',
], {
  url: new URL(`${proxyPrefix}/central-admin/participants`, mlIngressBasePath),
  method: 'GET'
});

const _positionFundsInOutTests = getAllowDenyList([
  'financeManager',
], [
  'operator',
  'manager',
  'clerk',
  'dfspReconciliationReports',
  'audit',
], {
  url: new URL(`${proxyPrefix}/central-admin/participants/1/accounts/1`, mlIngressBasePath),
  method: 'POST'
});

const _participantDisableEnableTests = getAllowDenyList([
  'manager',
  'financeManager',
  'clerk',
], [
  'dfspReconciliationReports',
  'audit',
  'operator',
], {
  url: new URL(`${proxyPrefix}/central-admin/participants/1/accounts/1`, mlIngressBasePath),
  method: 'PUT'
});

const _positionNdcEditTests = getAllowDenyList([
  'financeManager',
], [
  'operator',
  'manager',
  'clerk',
  'dfspReconciliationReports',
  'audit',
], {
  url: new URL(`${proxyPrefix}/central-admin/participants/1/limits/1`, mlIngressBasePath),
  method: 'PUT'
});

const allow: TestParameters[] = [
  ..._participantViewTests.allow,
  ..._positionFundsInOutTests.allow,
  ..._participantDisableEnableTests.allow,
  ..._positionNdcEditTests.allow,
]

const deny: TestParameters[] = [
  ..._participantViewTests.deny,
  ..._positionFundsInOutTests.deny,
  ..._participantDisableEnableTests.deny,
  ..._positionNdcEditTests.deny,
]

test.each(allow)(
    'Test user with role $role is allowed access to $method $url',
    async (testParams: TestParameters) => {
      await allowCheck(testParams, testUser, cookieJarObj);
    },
);

test.each(deny)(
    'Test user with role $role is denied access to $method $url',
    async (testParams: TestParameters) => {
      await denyCheck(testParams, testUser, cookieJarObj);
    },
);
