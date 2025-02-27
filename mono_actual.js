// npm install --save @actual-app/api
// npm install --save node-cron@3.0.3
const actualApi = require('@actual-app/api');

const CACHE_DIR_PATH = '.cache/';
const MONO_URL = 'https://api.monobank.ua';
const DAYS_TO_SYNC = parseInt(process.env.DAYS_TO_SYNC);
const DEFAULT_DAYS_SYNC = DAYS_TO_SYNC < 7 ? DAYS_TO_SYNC : 7;
const MONO_TOKEN = process.env.MONO_TOKEN;
const ACTUAL_URL = process.env.ACTUAL_URL;
const ACTUAL_PASSWORD = process.env.ACTUAL_PASSWORD;
const ACTUAL_SYNC_ID = process.env.ACTUAL_SYNC_ID;
let ACTUAL_ACCOUNTS = []

function create_cache_dir() {
  const fs = require('fs');
  const dir = CACHE_DIR_PATH;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// const example_mono_trans = [
    //   {
    //     id: 'aaaa',
    //     time: 1705091543,
    //     description: 'test',
    //     mcc: 4829,
    //     originalMcc: 4829,
    //     amount: -100,
    //     operationAmount: -100,
    //     currencyCode: 980,
    //     commissionRate: 0,
    //     cashbackAmount: 0,
    //     balance: 536687,
    //     hold: true,
    //     receiptId: 'xxxxx'
    //   }
    // ];
async function fetch_data() {
  let TOTAL_DAYS_SYNC = DAYS_TO_SYNC;

  // MONO
  async function getMonoDataFromCards(startDateTimestamp, endDateTimestamp) {
    let card_index = 0;
    let result = [];
    try {
      while (true) {
        console.log("Parsing card number " + card_index);
        const cards_data = process.env["MONO_CARD_" + card_index];
        if (!cards_data) {
          console.log("Card number " + card_index + " is absent");
          break;
        }
        card_index++;

        const array = cards_data.split(":");
        console.log("splited card data " + array);
        const mono_card = array[0];
        const actual_card = ACTUAL_ACCOUNTS.find((account) => {
          return account.name.toUpperCase() === array[1].toUpperCase()
                || account.id.toUpperCase() === array[1].toUpperCase();
        });
        if (!actual_card) {
          console.log("No actual card for " + array[1]);
          continue;
        }

        const actual_id = actual_card.id;

        const new_data = await fetchMonoData(mono_card, startDateTimestamp, endDateTimestamp, TOTAL_DAYS_SYNC > 0).catch((error) => {
          console.error(error);
        });

        if (actual_id && new_data) {
          result.push({
            actual_card: actual_id,
            mono_data: new_data
          });
        }
      }
    } catch(error) {
      console.error(error);
    }
    return result;
  }

  async function fetchMonoData(card, startDateTimestamp, endDateTimestamp, sleepToAllowNextRequest) {
    try {
      const mono_url = new URL(MONO_URL + '/personal/statement/' + card + '/' + startDateTimestamp + '/' + endDateTimestamp);
      const response = await fetch(mono_url, {
        headers: { 'X-Token': MONO_TOKEN, },
      }).catch((error) => {
        console.error(error);
      });

      if (!response.ok) {
        throw new Error(mono_url + ' failed: ' + ' ' + response.status + ' ' + response.statusText);
      }

      const data = await response.json().catch((error) => {
        console.error(error);
      });

      // Mono allows 1 request per 60 seconds
      if (sleepToAllowNextRequest) {
        // console.log('sleeping for 60 seconds');
        await sleep(60 * 1000); // 60 seconds
      }

      return data;
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  async function fetchActualData(startDateIso, endDateIso) {
    try {
      const actual_data = await actualApi.runQuery(
          actualApi.q('transactions')
                  .filter({
                    date: [
                      { $gte: startDateIso },
                      { $lte: endDateIso }
                    ]
                  })
                  .select('*')
        ).catch((error) => {
        console.error(error);
      });
      // actual_data structure
      // const actual_data = {
      //   data: [
      //     {
      //       id: '8eb6241f-3d36-48aa-aab6-c2c8e',
      //       is_parent: false,
      //       is_child: false,
      //       parent_id: null,
      //       account: null,
      //       category: null,
      //       amount: -15200,
      //       payee: '13c21c0a-284a-4689-b4',
      //       notes: null,
      //       date: '2024-01-35',
      //       imported_id: null,
      //       error: null,
      //       imported_payee: '...',
      //       starting_balance_flag: false,
      //       transfer_id: null,
      //       sort_order: 1706225650763,
      //       cleared: true,
      //       reconciled: false,
      //       tombstone: false,
      //       schedule: null
      //     },
      //   ],
      //   dependencies: [ 'transactions', 'accounts', 'categories', 'payees', 'schedules' ]
      // }
      return actual_data.data
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  // START
  create_cache_dir();

  await actualApi.init({
    dataDir: CACHE_DIR_PATH,
    serverURL: ACTUAL_URL,
    password: ACTUAL_PASSWORD,
  }).catch((error) => {
    console.error(error);
  });

  await actualApi.downloadBudget(ACTUAL_SYNC_ID).catch((error) => {
    console.error(error);
  });

  await actualApi.sync()

  // accounts = [
  //     {
  //       "id":"19525deb-b8d8-4681-af43-69ddc3d7110e",
  //       "name":"name of the budget",
  //       "offbudget":true,
  //       "closed":false
  //     }
  //   ]
  ACTUAL_ACCOUNTS = await actualApi.getAccounts().catch((error) => {
    console.error(error);
  });
  console.log("actual accounts " + JSON.stringify(ACTUAL_ACCOUNTS, null, 4));

  let endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  while (TOTAL_DAYS_SYNC > 0) {
    const endDateIso = endDate.toISOString().slice(0, 10);
    const endDateTimestamp = endDate.getTime();

    // set date as end - DAYS_TO_SYNC
    startDate.setDate(endDate.getDate() - DEFAULT_DAYS_SYNC);

    const startDateIso = startDate.toISOString().slice(0, 10);
    const startDateTimestamp = startDate.getTime();

    console.log('Sync: ' + startDateIso + ' ' + endDateIso);

    let transactions = [];

    const actual_data = await fetchActualData(startDateIso, endDateIso).catch((error) => {
      console.error(error);
    });
    console.log("actual data-----------------------------------------------------------")
    console.log(actual_data);
    console.log("end actual data-----------------------------------------------------------")

    if (actual_data) {
      const cards_data = await getMonoDataFromCards(startDateTimestamp, endDateTimestamp).catch((error) => {
        console.error(error);
      });
      console.log("mono data-----------------------------------------------------------")
      console.log(cards_data);
      console.log("end mono data-----------------------------------------------------------")

      if (cards_data && cards_data.length > 0) {
        // cards_data = {
        //   actual_card: actual_card
        //   mono_data: mono_data_array
        // }
        for (const data of cards_data) {
          for (const exp of data.mono_data) {
            let create_trans = {};

            create_trans.account = data.actual_card;
            create_trans.amount = exp.amount;
            create_trans.date = new Date(exp.time * 1000).toISOString().slice(0, 10);
            create_trans.payee_name = exp.description;
            create_trans.imported_id = exp.id

            transactions.push(create_trans);
          }

          if (transactions.length > 0) {
            console.log("adding " + transactions.length + " transactions");
            console.log(transactions)
            console.log("end transactions")
            let result = await actualApi.importTransactions(data.actual_card, transactions).catch((error) => {
              console.error(error);
            });
            console.log(result);
          } else {
            console.log('No new data to be added: ' + transactions.length)
          }

          transactions = [];
        }
      }
    }

    endDate = startDate;
    TOTAL_DAYS_SYNC -= DEFAULT_DAYS_SYNC;
  }

  await actualApi.sync()
  await actualApi.shutdown();
};

// fetch initial data
(async () => {
  await fetch_data();
})()
