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
  Users,
  User,
  Roles,
  Role,
  RolePatch,
  TestParameters
} from './types';
import {
  roleAssignmentSvcBasePath,
  mlIngressBasePath,
  proxyPrefix,
  username,
  password,
} from '../config';
import { CookieJar } from 'tough-cookie';

export function getAllowDenyList(
  allowRoles: string[],
  denyRoles: string[],
  testParameters: { url: URL, method: Method }
) : { allow: TestParameters[], deny: TestParameters[] } {
  return {
    allow: allowRoles.map(role => ({
      ...testParameters,
      role,
    })),
    deny: denyRoles.map(role => ({
      ...testParameters,
      role,
    })),
  }
}

const GOT_JSON_OPTS: OptionsOfJSONResponseBody = {
  isStream: false,
  resolveBodyOnly: false,
  responseType: 'json',
  throwHttpErrors: false,
  headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
  },
};

export async function clearUserRoles(id: User["id"]) {
  const response = await got.get<Roles>(
      `${roleAssignmentSvcBasePath}/users/${id}/roles`,
      GOT_JSON_OPTS,
  );
  expect(response.statusCode).toEqual(200);
  if (response.body.roles.length > 0) {
      const body: RolePatch = {
          roleOperations: response.body.roles.map((role) => ({
              roleId: role,
              action: 'delete',
          })),
      }
      await got.patch<null>(`${roleAssignmentSvcBasePath}/users/${id}/roles`, {
          ...GOT_JSON_OPTS,
          body: JSON.stringify(body),
      });
      expect(response.statusCode).toEqual(200);
  }
}

export async function appendUserRole(id: User["id"], role: Role) {
  const body: RolePatch = {
      roleOperations: [{
          roleId: role,
          action: 'insert',
      }],
  }
  await got.patch<null>(`${roleAssignmentSvcBasePath}/users/${id}/roles`, {
      ...GOT_JSON_OPTS,
      body: JSON.stringify(body),
  });
}

export async function getUser() {
  const response = await got.get<Users>(`${roleAssignmentSvcBasePath}/users`, GOT_JSON_OPTS);
  expect(response.statusCode).toEqual(200);
  const user = response.body.users?.find((user: User) => user.username === username);
  expect(user?.id).toBeDefined();
  return user
}

export async function allowCheck({ url, method, role } : TestParameters, testUser: User, cookieJar: CookieJar) {
  await appendUserRole(testUser.id, role);
  const response = await got({
      method,
      url,
      throwHttpErrors: false,
      cookieJar,
  });
  // TODO: what status codes are we actually expecting?
  expect([401, 403]).not.toContain(response.statusCode);
}

export async function denyCheck({ url, method, role } : TestParameters, testUser: User, cookieJar: CookieJar) {
  await appendUserRole(testUser.id, role);
  const response = await got({
      method,
      url,
      throwHttpErrors: false,
      cookieJar,
  });
  // TODO: what status codes are we actually expecting?
  expect([401, 403]).toContain(response.statusCode);
}