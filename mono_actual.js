// npm install --save @actual-app/api
let actualApi = require('@actual-app/api');

(async () => {
  await actualApi.init({
    dataDir: '.cache/',
    serverURL: process.env.ACTUAL_URL,
    password: process.env.ACTUAL_PASSWORD,
  });

  await actualApi.downloadBudget(process.env.ACTUAL_SYNC_ID);
  // let from = Math.floor(Date.now() / 1000) - 3600;
  // const dateString = "2024-01-13";
  const currentDate = new Date();
  const dateString = currentDate.toISOString().slice(0, 10);
  console.log('current date: ' + dateString);
  const date = new Date(dateString);
  const unixTimestamp = date.getTime() / 1000;

  const actual_card = process.env.ACTUAL_CARD;
  const mono_card = process.env.MONO_CARD;
  const mono_url = 'https://api.monobank.ua/';
  const mono_api_token = process.env.MONO_TOKEN;
  let mono_data = Array();
  let Transaction = [];


  // MONO
  async function fetchMonoData() {
    try {
      const response = await fetch(mono_url + '/personal/statement/' + mono_card + '/' + unixTimestamp, {
        headers: { 'X-Token': mono_api_token, },
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const extractedData = data;

      return extractedData; // Return the refactored data
    } catch (error) {
      console.error(error);
    }
  }

  // Example usage:
  async function useData() {
    const extractedData = await fetchMonoData();
    return extractedData;
  }

  async function fetchActualData() {
    try {
      // let budget = await api.getBudgetMonth('2024-01');
      // let accounts = await api.getAccounts()
      // console.log(accounts);
      // console.log(trans)
      let actual_data = await actualApi.getTransactions(actual_card, date);
      return actual_data
    } catch (error) {
      console.error(error);
    }
  }



  const example_actual_trans = [{
    // is_parent: false,
    // is_child: false,
    // parent_id: null,
    account: actual_card,
    // category: '1111',
    amount: -77700,
    payee: '333',
    // notes: null,
    date: date,
    imported_id: null,
    // error: null,
    // imported_payee: null,
    // starting_balance_flag: false,
    // transfer_id: null,
    // sort_order: 1705047040628,
    // cleared: false,
    // reconciled: false,
    // tombstone: false,
    // schedule: null,
    // subtransactions: []
  }];
  const example_mono_trans = [
    {
      id: 'aaaa',
      time: 1705091543,
      description: 'test',
      mcc: 4829,
      originalMcc: 4829,
      amount: -100,
      operationAmount: -100,
      currencyCode: 980,
      commissionRate: 0,
      cashbackAmount: 0,
      balance: 536687,
      hold: true,
      receiptId: 'xxxxx'
    }
  ];

  async function deduplicate(transaction, actual_data) {
    let match = false;
    for (const actual of actual_data) {
      if (transaction.amount == actual.amount) {
        if (transaction.payee_name == actual.imported_payee) {
          console.log('deduplicate: amount' + transaction.amount + ' payee:' + transaction.payee_name);
          match = true
        }
        if (transaction.payee_name == actual.payee) {
          console.log('deduplicate: amount' + transaction.amount + ' payee:' + transaction.payee_name);
          match = true
        }
      }
    }
    return match;
  }

  actual_data = await fetchActualData();
  console.log(actual_data);
  mono_data = await useData();
  console.log(mono_data);

  for (const exp of mono_data) {
    let create_trans = new Object();
    create_trans.account = actual_card;
    create_trans.amount = exp.amount;
    create_trans.date = date;
    create_trans.payee_name = exp.description;
    if (deduplicate(create_trans, actual_data) == false) {
      console.log('create: amount' + create.amount + ' payee:' + create.payee_name);
      Transaction.push(create_trans);
    }
  }

  if (Transaction.length > 0) {
    console.log(Transaction)
    let result = await actualApi.addTransactions(actual_card, Transaction);
    console.log(result);
  } else {
    console.log('No new data to be added')
  }

  await actualApi.shutdown();
})();
