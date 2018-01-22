const grpc = require('grpc');
const fs = require('fs');

const LND_HOMEDIR = `/home/${process.env.USER}/.lnd`;
const lndCert = fs.readFileSync(LND_HOMEDIR + '/tls.cert');
const adminMacaroon = fs.readFileSync(LND_HOMEDIR + '/admin.macaroon');
const meta = new grpc.Metadata();
const credentials = grpc.credentials.createSsl(lndCert);
const lnrpcDescriptor = grpc.load('rpc.proto');
const lnrpc = lnrpcDescriptor.lnrpc;
const lightning = new lnrpc.Lightning('localhost:10009', credentials);

const express = require('express');
const cors = require('cors');
const app = express();

meta.add('macaroon', adminMacaroon.toString('hex'));

app.use(cors());
app.use(express.static(`./web-ui/dist`));

let nodeObj = {
  getInfo: {},
  channelBalance: 0,
};

app.get('/', (req,res) => {
  res.sendFile('index.html');
});

app.get('/v1/getinfo', (req,res) => {
  res.json(nodeObj.getInfo);
});

app.get('/v1/balance/channels', (req,res) => {
  lightning.channelBalance({}, meta, function(err, response) {
    if (err) console.log(err);
    const balanceSatoshi = Number(response.balance);
    const balanceBTC = balanceSatoshi / 100000000;
    console.log('\nChannel Balance:');
    console.log(`${balanceSatoshi} sat`);
    console.log(`${balanceBTC} BTC`);
    nodeObj.channelBalance = balanceSatoshi;
    res.json(nodeObj.channelBalance);
  });
});

// query lnd only every 5 minutes
setInterval(() => {
  lightning.getInfo({}, meta, (err, response) => {
    if (err) {
      console.log(err);
      nodeObj.getInfo = err;
    }
    const timeStamp = Date.now();
    let d = new Date(timeStamp);
    console.log(`\n${d.toLocaleString()} - GetInfo:`);
    console.dir(response, {colors:true});
    nodeObj.getInfo = response;
    nodeObj.getInfo.time = timeStamp;
  });
}, 30000);


lightning.channelBalance({}, meta, function(err, response) {
  if (err) console.log(err);
  const balanceSatoshi = Number(response.balance);
  const balanceBTC = balanceSatoshi / 100000000;
  console.log('\nChannel Balance:');
  console.log(`${balanceSatoshi} sat`);
  console.log(`${balanceBTC} BTC`);
});

lightning.walletBalance({}, meta, function(err, response) {
  if (err) console.log(err);
  console.log('\nWallet Balance:');
  const balanceSatoshi = Number(response.total_balance);
  const balanceBTC = balanceSatoshi / 100000000;
  console.log(`${balanceSatoshi} sat`);
  console.log(`${balanceBTC} BTC`);
});

const call = lightning.subscribeInvoices({}, meta);
call.on('data', function(invoice) {
    console.log(invoice);
})
.on('end', function() {
  // The server has finished sending
})
.on('status', function(status) {
  // Process status
  console.log("Current status" + status);
});

app.listen(3000, () => console.log('vue-lnd listening on port 3000!'));
