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

import Excel from 'exceljs'

import {
  mlIngressBasePath,
  username,
  password
} from '../config'

import {
  payer,
  payee,
  payerMSISDN,
  payeeMSISDN,
  centralLedgerAdminEndpoint,
  reportBasePath,
  currency,
  centralSettlementEndpoint,
  payerBackendBasePath,
  payeeBackendBasePath,
  accountLookupSvcBasePath
} from './config'

import {
  getUser,
  appendUserRole,
  clearUserRoles,
  appendUserParticipant,
  clearUserParticipants
} from '../roles_check_tests/helpers'

import login from '../login'
import {
  TestParameters
} from './types'

import {
  User
} from '../roles_check_tests/types'

import {
  getParticipant,
  fundsIn,
  fundsOut,
  getReport,
  closeCurrentOpenSettlementWindow,
  getCurrentOpenSettlementWindow,
  sendMoney,
  createSettlement,
  putSettlement,
  getSettlement,
  addParticipant,
  registerParticipantMSISDN
} from './helpers'
import { CookieJar } from 'tough-cookie'

let testUser: User
let cookieJarObj: CookieJar

beforeAll(async () => {
  const user = <User> await getUser()
  const { cookieJar } = await login(username, password, mlIngressBasePath)
  cookieJarObj = cookieJar
  testUser = user!
  await appendUserRole(user?.id, 'financeManager')
  await appendUserRole(user?.id, 'dfspReconciliationReports')
  await appendUserParticipant(user?.id, payer)
  await appendUserParticipant(user?.id, payee)
})

afterAll(async () => {
  await clearUserParticipants(testUser?.id)
  await clearUserRoles(testUser?.id)
})

const validateDfspSettlementReport = (worksheet: Excel.Worksheet, settlementWindowId: string,
  settlementId: string, totalSentAmount: number, totalReceivedAmount: number, totalNetAmount: number,
  netAmount: number, currency: string, dfspIdSender: string, dfspIdReceiver: string,
  sendTransactions: number, receiveTransactions: number, totalTransactions: number) => {
  const firstRow:any = worksheet.getRow(1)
  expect(firstRow.values[1]).toEqual('Report for:')
  expect(firstRow.values[2]).toEqual('FSP ID')
  expect(firstRow.values[3]).toEqual(dfspIdSender)
  expect(firstRow.values[4]).toEqual('Settlement ID')
  expect(firstRow.values[5]).toEqual(settlementId.toString())
  expect(firstRow.values[8]).toEqual('Created Date')
  expect(firstRow.values[9]).not.toBeUndefined()

  const secondRow: any = worksheet.getRow(2)
  expect(secondRow.values[8]).toEqual('Last Action Date')
  expect(secondRow.values[9]).not.toBeUndefined()

  const fourthRow: any = worksheet.getRow(4)
  expect(fourthRow.values[1]).toEqual('Window ID')
  expect(fourthRow.values[2]).toEqual('FSP ID')
  expect(fourthRow.values[3]).toEqual('Sent to FSP')
  expect(fourthRow.values[4]).toBeUndefined()
  expect(fourthRow.values[5]).toEqual('Received from FSP')
  expect(fourthRow.values[6]).toBeUndefined()
  expect(fourthRow.values[7]).toEqual('Total')
  expect(fourthRow.values[8]).toEqual('Total Value of All Transactions')
  expect(fourthRow.values[9]).toEqual('Net Position vs. Each DFSP')

  const fifthRow: any = worksheet.getRow(5)
  expect(fifthRow.values[1]).toBeUndefined()
  expect(fifthRow.values[2]).toBeUndefined()
  expect(fifthRow.values[3]).toEqual('Volume')
  expect(fifthRow.values[4]).toEqual('Value')
  expect(fifthRow.values[5]).toEqual('Volume')
  expect(fifthRow.values[6]).toEqual('Value')
  expect(fifthRow.values[7]).toEqual('Volume')
  expect(fifthRow.values[8]).toBeUndefined()
  expect(fifthRow.values[9]).toBeUndefined()

  const sixthRow: any = worksheet.getRow(6)
  expect(sixthRow.values[1]).toEqual(settlementWindowId.toString()) // settlementWindowId
  expect(sixthRow.values[2]).toEqual(dfspIdReceiver)
  expect(sixthRow.values[3]).toEqual(`${sendTransactions}`) // 2 send transactions
  expect(sixthRow.values[4]).toEqual(`${totalSentAmount} ${currency}`) // total amount sent
  expect(sixthRow.values[5]).toEqual(`${receiveTransactions}`) // 1 receive transaction
  expect(sixthRow.values[6]).toEqual(`${totalReceivedAmount} ${currency}`) // 1 receive transaction
  expect(sixthRow.values[7]).toEqual(`${totalTransactions}`) // 3 total transactions
  expect(sixthRow.values[8]).toEqual(`${totalNetAmount} ${currency}`) // total sum of all transaction amounts
  if (netAmount >= 0) {
    expect(sixthRow.values[9]).toEqual(`${Math.abs(netAmount)} ${currency}`) // net amount >= 0
  } else {
    expect(sixthRow.values[9]).toEqual(`(${Math.abs(netAmount)}) ${currency}`) // net amount < 0
  }

  const seventhRow: any = worksheet.getRow(7)
  expect(seventhRow.values[1]).toEqual('Aggregated Net Positions') // Aggregated Net Positions
  if (netAmount >= 0) {
    expect(seventhRow.values[9]).toEqual(`${Math.abs(netAmount)} ${currency}`) // net amount >= 0
  } else {
    expect(seventhRow.values[9]).toEqual(`(${Math.abs(netAmount)}) ${currency}`) // net amount < 0
  }
}

describe('DFSP Settlements Report', () => {
  describe('Happy Path', () => {
    it('Run a transfer, settle a settlement and extract the report', async () => {
      // Do funds in for payer and payee to get the balance
      let getParticipantParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts`),
        method: 'GET'
      }
      const payerAccounts = await getParticipant(getParticipantParams, cookieJarObj)
      const payerAccount = payerAccounts.filter(acc => acc.ledgerAccountType === 'SETTLEMENT' &&
                                                  acc.currency === currency)

      getParticipantParams = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payee}/accounts`),
        method: 'GET'
      }
      const payeeAccounts = await getParticipant(getParticipantParams, cookieJarObj)
      const payeeAccount = payeeAccounts.filter(acc => acc.ledgerAccountType === 'SETTLEMENT' &&
                                                  acc.currency === currency)
      // Get the current open window before transfer
      const openWindowParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlementWindows?state=OPEN`),
        method: 'GET'
      }
      let openWindow = await getCurrentOpenSettlementWindow(openWindowParams, cookieJarObj)

      // Close the current open window before transfer
      let closeWindowParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlementWindows/${openWindow[0].settlementWindowId}`),
        method: 'POST'
      }

      await closeCurrentOpenSettlementWindow(closeWindowParams, cookieJarObj)

      // Add payer and payee to accountlookup service
      await addParticipant(accountLookupSvcBasePath, payer, payerMSISDN, currency)
      await addParticipant(accountLookupSvcBasePath, payee, payeeMSISDN, currency)

      // Register the fsp MSISDNs
      await registerParticipantMSISDN(payerBackendBasePath, payer, payerMSISDN)
      await registerParticipantMSISDN(payeeBackendBasePath, payee, payeeMSISDN)

      // Run a transfer between payerfsp and payeefsp
      const transferAmount1 = '11.95' // payer to payee
      const transferAmount2 = '7.24' // payer to payee
      const transferAmount3 = '4.68' // payee to payer
      const totalSentAmount = (parseFloat(transferAmount1) + parseFloat(transferAmount2)).toFixed(2)
      const totalNetAmount = (parseFloat(transferAmount1) + parseFloat(transferAmount2) +
                              parseFloat(transferAmount3)).toFixed(2)
      const netAmount = (parseFloat(transferAmount1) + parseFloat(transferAmount2) -
                              parseFloat(transferAmount3)).toFixed(2)

      // Send money from payer to payee
      const transferResponse1 = await sendMoney(
        `${payerBackendBasePath}/scenarios`,
        payerMSISDN,
        payeeMSISDN,
        currency,
        transferAmount1
      )
      expect(transferResponse1.scenario2.result.fulfil.body.transferState).toEqual('COMMITTED')

      // Send money from payer to payee
      const transferResponse2 = await sendMoney(
        `${payerBackendBasePath}/scenarios`,
        payerMSISDN,
        payeeMSISDN,
        currency,
        transferAmount2
      )
      expect(transferResponse2.scenario2.result.fulfil.body.transferState).toEqual('COMMITTED')

      // Send money from payee to payer
      const transferResponse3 = await sendMoney(
        `${payeeBackendBasePath}/scenarios`,
        payeeMSISDN,
        payerMSISDN,
        currency,
        transferAmount3
      )
      expect(transferResponse3.scenario2.result.fulfil.body.transferState).toEqual('COMMITTED')

      // Get the current open window after transfer
      openWindow = await getCurrentOpenSettlementWindow(openWindowParams, cookieJarObj)
      const settlementWindowId = openWindow[0].settlementWindowId

      // Close the current open window after transfer
      closeWindowParams = {
        url: new URL(`${centralSettlementEndpoint}/settlementWindows/${settlementWindowId}`),
        method: 'POST'
      }
      await closeCurrentOpenSettlementWindow(closeWindowParams, cookieJarObj)

      // Create a Settlement and move it till RESERVE phase
      const createSettlementParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlements`),
        method: 'POST'
      }
      const createSettlementResponse =
        await createSettlement(createSettlementParams, cookieJarObj, settlementWindowId)
      expect(createSettlementResponse.id).not.toEqual(null)
      expect(createSettlementResponse.state).toEqual('PENDING_SETTLEMENT')

      const settlementId = createSettlementResponse.id

      // Get the current settlement
      const getSettlementParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlements/${settlementId}`),
        method: 'GET'
      }
      const settlement = await getSettlement(getSettlementParams, cookieJarObj)

      // Create a Settlement and move it till PS_TRANSFERS_RECORDED phase
      const settlementParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlements/${settlement.id}`),
        method: 'PUT'
      }

      let settlementParticipants = settlement.participants.map((p:any) => {
        return {
          id: p.id,
          accounts: [
            {
              id: p.accounts[0].id,
              reason: 'Transfers recorded for payer',
              state: 'PS_TRANSFERS_RECORDED'
            }
          ]
        }
      })

      let putSettlementResponse =
        await putSettlement(settlementParams, cookieJarObj, { participants: settlementParticipants })
      expect(putSettlementResponse.state).toEqual('PS_TRANSFERS_RECORDED')

      // Create a Settlement and move it till PS_TRANSFERS_RESERVED phase
      settlementParticipants = settlement.participants.map((p:any) => {
        return {
          id: p.id,
          accounts: [
            {
              id: p.accounts[0].id,
              reason: 'Transfers reserved',
              state: 'PS_TRANSFERS_RESERVED'
            }
          ]
        }
      })

      putSettlementResponse =
        await putSettlement(settlementParams, cookieJarObj, { participants: settlementParticipants })
      expect(putSettlementResponse.state).toEqual('PS_TRANSFERS_RESERVED')

      // Create a Settlement and move it till PS_TRANSFERS_COMMITTED phase
      settlementParticipants = settlement.participants.map((p:any) => {
        return {
          id: p.id,
          accounts: [
            {
              id: p.accounts[0].id,
              reason: 'Transfers committed',
              state: 'PS_TRANSFERS_COMMITTED'
            }
          ]
        }
      })

      putSettlementResponse =
        await putSettlement(settlementParams, cookieJarObj, { participants: settlementParticipants })
      expect(putSettlementResponse.state).toEqual('PS_TRANSFERS_COMMITTED')

      // Record the funds out for the net payer
      const fundsOutParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts/${payerAccount[0].id}`),
        method: 'POST'
      }

      await fundsOut(
        fundsOutParams,
        cookieJarObj,
        currency,
        netAmount.toString(),
        'test2@test.com',
        'settlementInitiationTest.xlsx'
      )

      // Record the funds in for the net payee
      const fundsInParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payee}/accounts/${payeeAccount[0].id}`),
        method: 'POST'
      }

      await fundsIn(
        fundsInParams,
        cookieJarObj,
        currency,
        netAmount.toString(),
        'test2@test.com',
        'settlementInitiationTest.xlsx'
      )

      // Create a Settlement and move it till SETTLED phase
      settlementParticipants = settlement.participants.map((p:any) => {
        return {
          id: p.id,
          accounts: [
            {
              id: p.accounts[0].id,
              reason: 'Transfers settled for payer',
              state: 'SETTLED'
            }
          ]
        }
      })

      putSettlementResponse =
        await putSettlement(settlementParams, cookieJarObj, { participants: settlementParticipants })
      expect(putSettlementResponse.state).toEqual('SETTLED')

      // Get the latest settlement statement report for payer and payee
      const getPayerSettlementAuditReportParams: TestParameters = {
        url: new URL(`${reportBasePath}/dfspSettlement?dfspId=${payer}&settlementId=${settlementId}&format=xlsx`),
        method: 'GET'
      }
      const getPayeeSettlementAuditReportParams: TestParameters = {
        url: new URL(`${reportBasePath}/dfspSettlement?dfspId=${payee}&settlementId=${settlementId}&format=xlsx`),
        method: 'GET'
      }

      // Get Payee report
      const payerReportData = await getReport(getPayerSettlementAuditReportParams, cookieJarObj)

      const payerWorkbook = new Excel.Workbook()
      await payerWorkbook.xlsx.read(payerReportData)
        .then(() => {
          const payerWorksheet = payerWorkbook.getWorksheet(1)
          // Validate Payer
          validateDfspSettlementReport(payerWorksheet, settlementWindowId,
            settlementId, parseFloat(totalSentAmount), parseFloat(transferAmount3), parseFloat(totalNetAmount),
            -parseFloat(netAmount), currency, payer, payee, 2, 1, 3)
        })

      // Get Payee report
      const payeeReportData = await getReport(getPayeeSettlementAuditReportParams, cookieJarObj)

      // Validate Payee
      const payeeWorkbook = new Excel.Workbook()
      await payeeWorkbook.xlsx.read(payeeReportData)
        .then(() => {
          const payeeWorksheet = payeeWorkbook.getWorksheet(1)
          validateDfspSettlementReport(payeeWorksheet, settlementWindowId,
            settlementId, parseFloat(transferAmount3), parseFloat(totalSentAmount), parseFloat(totalNetAmount),
            parseFloat(netAmount), currency, payee, payer, 1, 2, 3)
        })
    })
  })
})
