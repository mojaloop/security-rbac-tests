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

import { DateTime } from 'luxon'
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

describe('DFSP Settlements Statement Report', () => {
  describe('Happy Path', () => {
    it('Run a transfer, settle a settlement and extract the report', async () => {
      // Get the start date
      const startDate = DateTime.now().toISO()

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
      const payerFundsInParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts/${payerAccount[0].id}`),
        method: 'POST'
      }
      const fundsInAmount = '4.97'

      const payerFundsInTransferId = await fundsIn(
        payerFundsInParams,
        cookieJarObj,
        currency,
        fundsInAmount,
        'test2@test.com',
        'Test funds in'
      )
      const payeeFundsInParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payee}/accounts/${payeeAccount[0].id}`),
        method: 'POST'
      }

      const payeeFundsInTransferId = await fundsIn(
        payeeFundsInParams,
        cookieJarObj,
        currency,
        fundsInAmount,
        'test2@test.com',
        'Test funds in'
      )

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
      const transferAmount = '12.05'
      const transferResponse = await sendMoney(
        `${payerBackendBasePath}/scenarios`,
        payerMSISDN,
        payeeMSISDN,
        currency,
        transferAmount
      )
      expect(transferResponse.scenario2.result.fulfil.body.transferState).toEqual('COMMITTED')

      // Get the current open window after transfer
      openWindow = await getCurrentOpenSettlementWindow(openWindowParams, cookieJarObj)

      // Close the current open window after transfer
      closeWindowParams = {
        url: new URL(`${centralSettlementEndpoint}/settlementWindows/${openWindow[0].settlementWindowId}`),
        method: 'POST'
      }
      await closeCurrentOpenSettlementWindow(closeWindowParams, cookieJarObj)

      // Create a Settlement and move it till RESERVE phase
      const createSettlementParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlements`),
        method: 'POST'
      }
      const createSettlementResponse =
        await createSettlement(createSettlementParams, cookieJarObj, openWindow[0].settlementWindowId)
      expect(createSettlementResponse.id).not.toEqual(null)
      expect(createSettlementResponse.state).toEqual('PENDING_SETTLEMENT')

      // Get the current settlement
      const getSettlementParams: TestParameters = {
        url: new URL(`${centralSettlementEndpoint}/settlements/${createSettlementResponse.id}`),
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

      const fundsOutTransferId = await fundsOut(
        fundsOutParams,
        cookieJarObj,
        currency,
        transferAmount,
        'test2@test.com',
        'settlementInitiationTest.xlsx'
      )

      // Record the funds in for the net payee
      const fundsInParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payee}/accounts/${payeeAccount[0].id}`),
        method: 'POST'
      }

      const fundsInTransferId = await fundsIn(
        fundsInParams,
        cookieJarObj,
        currency,
        transferAmount,
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

      // Get the end date + 2 mins to allow for the transfers to complete
      const endDate = DateTime.now().plus({ minutes: 2 }).toUTC().toISO()

      // Get the latest settlement statement report for payer
      const getPayerSettlementAuditReportParams: TestParameters = {
        url: new URL(`${reportBasePath}/dfspSettlementStatement?dfspId=${payer}&startDate=${startDate}&endDate=${endDate}&format=xlsx`),
        method: 'GET'
      }
      const payerReportData = await getReport(getPayerSettlementAuditReportParams, cookieJarObj)

      const payerWorkbook = new Excel.Workbook()
      await payerWorkbook.xlsx.read(payerReportData)
        .then(() => {
          const payerWorksheet = payerWorkbook.getWorksheet(`${payer}-${currency}`)

          const payerFirstRow:any = payerWorksheet.getRow(1)
          expect(payerFirstRow.values[1]).toEqual('DFSP')

          const payerSecondRow: any = payerWorksheet.getRow(2)
          expect(payerSecondRow.values[2]).toEqual('SETTLEMENT')

          const payerThirdRow: any = payerWorksheet.getRow(3)
          expect(payerThirdRow.values[1]).toEqual('Date From')
          expect(payerThirdRow.values[2]).toEqual(startDate)

          const payerFourthRow: any = payerWorksheet.getRow(4)
          expect(payerFourthRow.values[1]).toEqual('Date To')
          expect(payerFourthRow.values[2]).toEqual(endDate)

          const payerFifthRow: any = payerWorksheet.getRow(5)
          expect(payerFifthRow.values[1]).toEqual('Currency')
          expect(payerFifthRow.values[2]).toEqual(currency)

          const payerSeventhRow: any = payerWorksheet.getRow(7)
          expect(payerSeventhRow.values[1]).toEqual('Transfer Id')
          expect(payerSeventhRow.values[2]).toEqual('Date Time')
          expect(payerSeventhRow.values[3]).toEqual('Process Description')
          expect(payerSeventhRow.values[4]).toEqual('Funds In')
          expect(payerSeventhRow.values[5]).toEqual('Funds Out')
          expect(payerSeventhRow.values[6]).toEqual('Balance')

          const payerRecords: any = {}

          payerWorksheet.eachRow((row: any, rowNumber :number) => {
            if (rowNumber > 7) {
              payerRecords[row.values[1]] = row.values
            }
          })

          // Validate the first funds in for payer
          const payerFirstFundsIn = payerRecords[payerFundsInTransferId]
          const payerStartingBalance = parseFloat(payerFirstFundsIn[6].replaceAll(',', ''))
          expect(payerFirstFundsIn[1]).toEqual(payerFundsInTransferId) // transferId
          expect(payerFirstFundsIn[2]).not.toBeUndefined() // datetime
          expect(payerFirstFundsIn[3]).toEqual('Testing funds in') // Process Description
          expect(payerFirstFundsIn[4]).toEqual(fundsInAmount) // funds in amount
          expect(payerFirstFundsIn[5]).toBeUndefined() // funds out amount
          expect(payerFirstFundsIn[6]).not.toBeUndefined() // balance

          // validate the first funds out after settlement
          const payerFundsOut = payerRecords[fundsOutTransferId]
          const balanceAfterFundsOut = (payerStartingBalance + parseFloat(transferAmount)).toFixed(2)
          expect(payerFundsOut[1]).toEqual(fundsOutTransferId) // transferId
          expect(payerFundsOut[2]).not.toBeUndefined() // datetime
          expect(payerFundsOut[3]).toEqual('Testing funds out') // Process Description
          expect(payerFundsOut[4]).toBeUndefined() // funds out amount
          expect(payerFundsOut[5].replaceAll(',', '')).toEqual(transferAmount) // funds in amount
          expect(payerFundsOut[6].replaceAll(',', '')).toEqual(balanceAfterFundsOut) // balance
        })

      // Get the latest settlement statement report for payee
      const getPayeeSettlementAuditReportParams: TestParameters = {
        url: new URL(`${reportBasePath}/dfspSettlementStatement?dfspId=${payee}&startDate=${startDate}&endDate=${endDate}&format=xlsx`),
        method: 'GET'
      }
      const payeeReportData = await getReport(getPayeeSettlementAuditReportParams, cookieJarObj)

      const payeeWorkbook = new Excel.Workbook()
      await payeeWorkbook.xlsx.read(payeeReportData)
        .then(() => {
          const payeeWorksheet = payeeWorkbook.getWorksheet(`${payee}-${currency}`)

          // Payee report validations
          const payeeFirstRow:any = payeeWorksheet.getRow(1)
          expect(payeeFirstRow.values[1]).toEqual('DFSP')

          const payeeSecondRow: any = payeeWorksheet.getRow(2)
          expect(payeeSecondRow.values[2]).toEqual('SETTLEMENT')

          const payeeThirdRow: any = payeeWorksheet.getRow(3)
          expect(payeeThirdRow.values[1]).toEqual('Date From')
          expect(payeeThirdRow.values[2]).toEqual(startDate)

          const payeeFourthRow: any = payeeWorksheet.getRow(4)
          expect(payeeFourthRow.values[1]).toEqual('Date To')
          expect(payeeFourthRow.values[2]).toEqual(endDate)

          const payeeFifthRow: any = payeeWorksheet.getRow(5)
          expect(payeeFifthRow.values[1]).toEqual('Currency')
          expect(payeeFifthRow.values[2]).toEqual(currency)

          const payeeSeventhRow: any = payeeWorksheet.getRow(7)
          expect(payeeSeventhRow.values[1]).toEqual('Transfer Id')
          expect(payeeSeventhRow.values[2]).toEqual('Date Time')
          expect(payeeSeventhRow.values[3]).toEqual('Process Description')
          expect(payeeSeventhRow.values[4]).toEqual('Funds In')
          expect(payeeSeventhRow.values[5]).toEqual('Funds Out')
          expect(payeeSeventhRow.values[6]).toEqual('Balance')

          const payeeRecords: any = {}

          payeeWorksheet.eachRow((row: any, rowNumber :number) => {
            if (rowNumber > 7) {
              payeeRecords[row.values[1]] = row.values
            }
          })

          // Validate the first funds in for payee
          const payeeFirstFundsIn = payeeRecords[payeeFundsInTransferId]
          const payeeStartingBalance = parseFloat(payeeFirstFundsIn[6].replaceAll(',', ''))
          expect(payeeFirstFundsIn[1]).toEqual(payeeFundsInTransferId) // transferId
          expect(payeeFirstFundsIn[2]).not.toBeUndefined() // datetime
          expect(payeeFirstFundsIn[3]).toEqual('Testing funds in') // Process Description
          expect(payeeFirstFundsIn[4].replaceAll(',', '')).toEqual(fundsInAmount) // funds in amount
          expect(payeeFirstFundsIn[5]).toBeUndefined() // funds out amount
          expect(payeeFirstFundsIn[6]).not.toBeUndefined() // balance

          // Validate the second funds in for payee after settlement
          const payeeFundsIn = payeeRecords[fundsInTransferId]
          const balanceAfterFundsIn = (payeeStartingBalance - parseFloat(transferAmount)).toFixed(2)
          expect(payeeFundsIn[1]).toEqual(fundsInTransferId) // transferId
          expect(payeeFundsIn[2]).not.toBeUndefined() // datetime
          expect(payeeFundsIn[3]).toEqual('Testing funds in') // Process Description
          expect(payeeFundsIn[4].replaceAll(',', '')).toEqual(transferAmount) // funds in amount
          expect(payeeFundsIn[5]).toBeUndefined() // funds out amount
          expect(payeeFundsIn[6].replaceAll(',', '')).toEqual(balanceAfterFundsIn) // balance
        })
    })
    it('Run funds in and out, run the report ', async () => {
      // Get the start date
      const startDate = DateTime.now().toUTC().toISO()

      const getParticipantParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts`),
        method: 'GET'
      }
      const payerAccounts = await getParticipant(getParticipantParams, cookieJarObj)
      const payerAccount = payerAccounts.filter(acc => acc.ledgerAccountType === 'SETTLEMENT' &&
                                                  acc.currency === currency)

      const fundsInParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts/${payerAccount[0].id}`),
        method: 'POST'
      }

      const fundsInAmount1 = '5.17'
      const fundsInAmount2 = '15.92'
      const fundsOutAmount1 = '7.45'
      const fundsOutAmount2 = '9999999999.99'

      const fundsInTransferId1 = await fundsIn(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsInAmount1,
        'test1@test.com',
        'Test Reference funds in 1'
      )

      const fundsOutTransferId = await fundsOut(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsOutAmount1,
        'test1@test.com',
        'Test Reference funds out'
      )

      const fundsInTransferId2 = await fundsIn(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsInAmount2,
        'test1@test.com',
        'Test Reference funds in 2'
      )

      // DO a funds out that will fail due to insufficient funds
      const fundsOutTransferId2 = await fundsOut(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsOutAmount2,
        'test1@test.com',
        'Test Reference funds out'
      )

      // Get the end date + 2 mins to allow for the transfers to complete
      const endDate = DateTime.now().plus({ minutes: 2 }).toUTC().toISO()

      // Get the latest settlement audit report
      const getDfspSettlementStatementReportParams: TestParameters = {
        url: new URL(`${reportBasePath}/dfspSettlementStatement?dfspId=${payer}&startDate=${startDate}&endDate=${endDate}&format=xlsx`),
        method: 'GET'
      }
      const reportData = await getReport(getDfspSettlementStatementReportParams, cookieJarObj)

      const workbook = new Excel.Workbook()
      await workbook.xlsx.read(reportData)
        .then(() => {
          const worksheet = workbook.getWorksheet(`${payer}-${currency}`)

          const firstRow:any = worksheet.getRow(1)
          expect(firstRow.values[1]).toEqual('DFSP')

          const secondRow: any = worksheet.getRow(2)
          expect(secondRow.values[2]).toEqual('SETTLEMENT')

          const thirdRow: any = worksheet.getRow(3)
          expect(thirdRow.values[1]).toEqual('Date From')
          expect(thirdRow.values[2]).toEqual(startDate)

          const fourthRow: any = worksheet.getRow(4)
          expect(fourthRow.values[1]).toEqual('Date To')
          expect(fourthRow.values[2]).toEqual(endDate)

          const fifthRow: any = worksheet.getRow(5)
          expect(fifthRow.values[1]).toEqual('Currency')
          expect(fifthRow.values[2]).toEqual(currency)

          const seventhRow: any = worksheet.getRow(7)
          expect(seventhRow.values[1]).toEqual('Transfer Id')
          expect(seventhRow.values[2]).toEqual('Date Time')
          expect(seventhRow.values[3]).toEqual('Process Description')
          expect(seventhRow.values[4]).toEqual('Funds In')
          expect(seventhRow.values[5]).toEqual('Funds Out')
          expect(seventhRow.values[6]).toEqual('Balance')

          const reportRecords: any = {}

          worksheet.eachRow((row: any, rowNumber :number) => {
            if (rowNumber > 7) {
              reportRecords[row.values[1]] = row.values
            }
          })

          // Validate the first funds in
          const firstFundsIn = reportRecords[fundsInTransferId1]
          const startingBalance = parseFloat(firstFundsIn[6].replaceAll(',', ''))
          expect(firstFundsIn[1]).toEqual(fundsInTransferId1) // transferId
          expect(firstFundsIn[2]).not.toBeUndefined() // datetime
          expect(firstFundsIn[3]).toEqual('Testing funds in') // Process Description
          expect(firstFundsIn[4]).toEqual(fundsInAmount1) // funds in amount
          expect(firstFundsIn[5]).toBeUndefined() // funds out amount
          expect(firstFundsIn[6]).not.toBeUndefined() // balance

          // validate the first funds out
          const firstFundsOut = reportRecords[fundsOutTransferId]
          const balanceAfterFundsOut = (startingBalance + parseFloat(fundsOutAmount1)).toFixed(2)
          expect(firstFundsOut[1]).toEqual(fundsOutTransferId) // transferId
          expect(firstFundsOut[2]).not.toBeUndefined() // datetime
          expect(firstFundsOut[3]).toEqual('Testing funds out') // Process Description
          expect(firstFundsOut[4]).toBeUndefined() // funds out amount
          expect(firstFundsOut[5].replaceAll(',', '')).toEqual(fundsOutAmount1) // funds in amount
          expect(firstFundsOut[6].replaceAll(',', '')).toEqual(balanceAfterFundsOut) // balance

          // validate the second funds in
          const secondFundsIn = reportRecords[fundsInTransferId2]
          const balanceAfterFundsIn = (parseFloat(balanceAfterFundsOut) - parseFloat(fundsInAmount2)).toFixed(2)
          expect(secondFundsIn[1]).toEqual(fundsInTransferId2) // transferId
          expect(secondFundsIn[2]).not.toBeUndefined() // datetime
          expect(secondFundsIn[3]).toEqual('Testing funds in') // Process Description
          expect(secondFundsIn[4].replaceAll(',', '')).toEqual(fundsInAmount2) // funds in amount
          expect(secondFundsIn[5]).toBeUndefined() // funds out amount
          expect(secondFundsIn[6].replaceAll(',', '')).toEqual(balanceAfterFundsIn) // balance

          // validate the second funds out - failed, should not appear in the report
          const secondFundsOut = reportRecords[fundsOutTransferId2]
          expect(secondFundsOut).toBeUndefined() // should not return any data
        })
    })
  })
})
