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

import * as env from 'env-var'

export const roleAssignmentSvcBasePath = env.get('ROLE_ASSIGNMENT_SVC_BASE_PATH')
  .default('http://localhost:3008')
  .asUrlObject()

// It's useful to parse this as a URL object for validation. But any query strings will be
// discarded, only the origin and path will be used.
const basePathUrl = env.get('ML_INGRESS_BASE_PATH')
  .default('http://bofportal.test.infra.mojatest.live.internal')
  .asUrlObject()
export const mlIngressBasePath = `${basePathUrl.origin}${basePathUrl.pathname}`.replace(/\/*$/, '')
export const proxyPrefix = 'proxy'

export const username = env.get('TEST_USER_NAME')
  .default('shashi')
  .asString()

export const password = env.get('TEST_USER_PASSWORD')
  .default('Pp5uBgLXOeq61KjYZ3SpMXih4cwQgM')
  .asString()

  export const centralLedgerAdminEndpoint = env.get('CENTRAL_LEDGER_ADMIN_ENDPOINT')
  .default('http://bofportal.test.infra.mojatest.live.internal/proxy/central-admin')
  .asUrlObject()
  
  export const centralSettlementEndpoint = env.get('CENTRAL_SETTLEMENT_ENDPOINT')
  .default('http://bofportal.test.infra.mojatest.live.internal/proxy/central-settlements')
  .asUrlObject()
  
  export const reportBasePath = env.get('REPORT_BASE_PATH')
  .default('http://bofportal.test.infra.mojatest.live.internal/proxy/reports')
  .asUrlObject()
  
  export const sendMoneyEndpoint = env.get('SEND_MONEY_ENDPOINT')
  .default('http://test.pm4mlsenderfsp.infratestk3s.test.infra.mojatest.live/cc-send/sendmoney')
  .asUrlObject()
  
  export const payer = env.get('TEST_PAYER')
  .default('pm4mlsenderfsp')
  .asString()

  export const payee = env.get('TEST_PAYEE')
  .default('pm4mlreceiverfsp')
  .asString()

  export const currency = env.get('TEST_CURRENCY')
  .default('USD')
  .asString()

