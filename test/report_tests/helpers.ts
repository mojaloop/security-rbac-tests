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

 - Shashikant Hirugade - shashikant.hirugade@modusbox.com

 --------------
 ******/

import { v4 as uuid } from 'uuid'
import axios, { AxiosRequestConfig } from 'axios'

import got, { OptionsOfJSONResponseBody } from 'got'
import {
  TestParameters
} from './types'

import { CookieJar } from 'tough-cookie'

const GOT_JSON_OPTS: OptionsOfJSONResponseBody = {
  isStream: false,
  resolveBodyOnly: false,
  responseType: 'json',
  throwHttpErrors: false,
  headers: {
    'content-type': 'application/json',
    accept: 'application/json'
  }
}

export async function getParticipant ({ url, method } : TestParameters, cookieJar: CookieJar): Promise<any[]> {
  const response = await got.get<any[]>({
    url,
    method,
    ...GOT_JSON_OPTS,
    cookieJar
  })
  expect(response.statusCode).toBe(200)
  return response.body
}

export async function fundsIn ({ url, method }
:TestParameters, cookieJar: CookieJar, currency: string, amount: string, user: string, reference: string):
  Promise<string> {
  const transferId = uuid()

  const body = {
    transferId,
    externalReference: reference,
    action: 'recordFundsIn',
    reason: 'Testing funds in',
    amount: {
      amount,
      currency
    },
    extensionList: {
      extension: [
        {
          key: 'user',
          value: user
        }
      ]
    }
  }
  const response = await got.post({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    body: JSON.stringify(body)
  })
  expect(response.statusCode).toBe(202)
  return transferId
}

export async function fundsOut ({ url, method }
:TestParameters, cookieJar: CookieJar, currency: string, amount: string, user: string, reference: string)
  :Promise<string> {
  const transferId = uuid()

  const body = {
    transferId,
    externalReference: reference,
    action: 'recordFundsOutPrepareReserve',
    reason: 'Testing funds out',
    amount: {
      amount,
      currency
    },
    extensionList: {
      extension: [
        {
          key: 'user',
          value: user
        }
      ]
    }
  }
  const response = await got.post({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    body: JSON.stringify(body)
  })
  expect(response.statusCode).toBe(202)
  return transferId
}

function delay (time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export async function getReport ({ url } : TestParameters, cookieJar: CookieJar): Promise<any> {
  await delay(5000)

  const cookie = await cookieJar.getCookieString(url.toString())

  const options:AxiosRequestConfig = {
    url: url.toString(),
    headers: { Cookie: cookie },
    responseType: 'stream'
  }
  const response = await axios.request(options)
  return response.data
}

export async function closeCurrentOpenSettlementWindow ({ url, method }
:TestParameters, cookieJar: CookieJar) {
  const body = { state: 'CLOSED', reason: 'Automated testing for Settlement Reports' }

  const response = await got.post({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    ...GOT_JSON_OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  expect([200, 400]).toContain(response.statusCode) // 400 is for empty window

  return response.body
}

export async function getCurrentOpenSettlementWindow ({ url, method }
:TestParameters, cookieJar: CookieJar) : Promise<any[]> {
  const response = await got.get<any[]>({
    method,
    url,
    ...GOT_JSON_OPTS,
    cookieJar
  })
  return response.body
}

export async function sendMoney (options: any): Promise<any> {
  const response = await axios(options)
  return response.data
}

export async function createSettlement ({ url, method }
:TestParameters, cookieJar: CookieJar, settlementWindowId: string): Promise<any> {
  const body = {
    settlementModel: 'DEFERREDNET',
    reason: 'Automated testing of Settlement Report',
    settlementWindows: [
      { id: settlementWindowId }
    ]
  }

  const response = await got.post({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    ...GOT_JSON_OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  expect([200]).toContain(response.statusCode)

  return response.body
}

export async function putSettlement ({ url, method }
:TestParameters, cookieJar: CookieJar, body: any): Promise<any> {
  const response = await got.put({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    ...GOT_JSON_OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  expect([200]).toContain(response.statusCode)

  return response.body
}

export async function getSettlement ({ url, method }
:TestParameters, cookieJar: CookieJar) : Promise<any> {
  const response = await got.get<any>({
    method,
    url,
    ...GOT_JSON_OPTS,
    cookieJar
  })
  return response.body
}
