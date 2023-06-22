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

export const centralLedgerAdminEndpoint = env.get('CENTRAL_LEDGER_ADMIN_ENDPOINT')
  .default('http://bofportal.yourdomain.com/proxy/central-admin')
  .asUrlObject()

export const centralSettlementEndpoint = env.get('CENTRAL_SETTLEMENT_ENDPOINT')
  .default('http://bofportal.yourdomain.com/proxy/central-settlements')
  .asUrlObject()

export const reportBasePath = env.get('REPORT_BASE_PATH')
  .default('http://bofportal.yourdomain.com/proxy/reports')
  .asUrlObject()

export const accountLookupSvcBasePath = env.get('ACCOUNT_LOOKUP_SERVICE_BASE_PATH')
  .default('http://account-lookup-service')
  .asString()

export const payerBackendBasePath = env.get('PAYER_BACKEND_BASE_PATH')
  .default('http://sim-payerfsp-backend')
  .asString()

export const payeeBackendBasePath = env.get('PAYEE_BACKEND_BASE_PATH')
  .default('http://sim-payeefsp-backend')
  .asString()

export const payer = env.get('TEST_PAYER')
  .default('pm4mlsenderfsp')
  .asString()

export const payee = env.get('TEST_PAYEE')
  .default('pm4mlreceiverfsp')
  .asString()

export const payerMSISDN = env.get('TEST_PAYER_MSISDN')
  .default('25644444444')
  .asString()

export const payeeMSISDN = env.get('TEST_PAYEE_MSISDN')
  .default('25633333333')
  .asString()

export const currency = env.get('TEST_CURRENCY')
  .default('USD')
  .asString()

export const settlementModel = env.get('TEST_SETTLEMENT_MODEL')
  .default('DEFAULTDEFERREDNET')
  .asString()
