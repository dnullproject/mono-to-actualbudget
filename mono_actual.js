// npm install --save @actual-app/api
let api = require('@actual-app/api');

(async () => {
  await api.init({
    dataDir: '.cache/',
    serverURL: process.env.ACTUAL_URL,
    password: process.env.ACTUAL_PASSWORD,
  });

  await api.downloadBudget(process.env.ACTUAL_SYNC_ID);
  // let from = Math.floor(Date.now() / 1000) - 3600;
  const dateString = "2024-01-13";
  const date = new Date(dateString);
  const unixTimestamp = date.getTime() / 1000;

  const actual_card = process.env.ACTUAL_CARD;
  const mono_card = process.env.MONO_CARD;
  const mono_url = 'https://api.monobank.ua/';
  const mono_api_token = process.env.MONO_TOKEN;
  let mono_trans = Array();
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
      console.log(data);
      const extractedData = data;
      console.log(extractedData);

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

  mono_trans = await useData(); // Call the function to fetch and use the data
  console.log(mono_trans); // Now you can use extractedData outside the fetch function


  const example_actual_trans = [{
    // is_parent: false,
    // is_child: false,
    // parent_id: null,
    account: actual_card,
    // category: '1111',
    amount: -77700,
    // payee: '333',
    // notes: null,
    date: date,
    // imported_id: null,
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

  // ACTUAL BUDGET
  // let budget = await api.getBudgetMonth('2024-01');
  // let accounts = await api.getAccounts()
  // console.log(accounts);
  let existing_trans = await api.getTransactions(actual_card, date);
  // console.log(trans)
  for (const exp of mono_trans) {
    let create_trans = new Object();
    console.log(exp);
    create_trans.account = actual_card;
    create_trans.amount = exp.amount;
    create_trans.date = date;
    create_trans.payee_name = exp.description;
    Transaction.push(create_trans);
  }
  console.log(Transaction)
  let result = await api.addTransactions(actual_card, Transaction);
  console.log(result);

  await api.shutdown();
})();
