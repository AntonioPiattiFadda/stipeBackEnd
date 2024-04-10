// Replace if using a different env file or config
require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const { resolve } = require('path');
const session = require('express-session');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4242;
app.use(express.json());

const options = {
  origin: '*',
};

app.use(cors(options));

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: {
    // For sample support and debugging, not required for production:
    name: 'stripe-samples/connect-onboarding-for-standard',
    version: '0.0.1',
    url: 'https://github.com/stripe-samples',
  },
});

app.use(express.static(process.env.STATIC_DIR));
app.use(
  session({
    secret: 'Set this to a random string that is kept secure',
    resave: false,
    saveUninitialized: true,
  })
);

app.get('/', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/index.html');
  res.sendFile(path);
});

app.post('/onboard-user', async (req, res) => {
  try {
    const account = await stripe.accounts.create({
      type: 'standard',
    });

    // Store the ID of the new Standard connected account.
    req.session.accountID = account.id;

    const origin = `${req.headers.origin}`;
    const accountLink = await stripe.accountLinks.create({
      type: 'account_onboarding',
      account: account.id,
      refresh_url: `${origin}/dashboard?success=true&account_id=${account.id}`,
      return_url: `${origin}/dashboard?success=true&account_id=${account.id}`,
    });
    res.json({
      id: account.id,
      url: accountLink.url,
    });

    // res.redirect(303, accountLink.url);
  } catch (err) {
    res.status(500).send({
      error: err.message,
    });
  }
});

app.get('/onboard-user/refresh', async (req, res) => {
  if (!req.session.accountID) {
    res.redirect('/');
    return;
  }

  try {
    const { accountID } = req.session;
    const origin = `${req.secure ? 'https://' : 'http://'}${req.headers.host}`;

    const accountLink = await stripe.accountLinks.create({
      type: 'account_onboarding',
      account: accountID,
      refresh_url: `${origin}/onboard-user/refresh`,
      return_url: `${origin}/success.html`,
    });

    // res.redirect(303, accountLink.url);
  } catch (err) {
    res.status(500).send({
      error: err.message,
    });
  }
});

app.get('/v1/accounts/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const account = await stripe.accounts.retrieve(id);
    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
      });
    }
    res.json({
      account,
    });
  } catch (error) {
    console.error('Error retrieving account:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  console.log(req.body);
  const { stripeId, invoiceTotal } = req.body;

  // Funcion convierta el monto a centavos

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 100,
    currency: 'usd',
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
    transfer_data: {
      destination: stripeId,
    },
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.listen(port, () =>
  console.log(`Node server listening at http://localhost:${port}!`)
);
