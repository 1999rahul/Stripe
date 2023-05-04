const express = require("express");
const keys = require("./keys")
const app = express();
//const { resolve } = require("path");
const bodyParser = require("body-parser");

const stripe = require("stripe")(keys.SecretKey);

app.use(express.static('./public'))
// app.use(express.static(path.join(__dirname, 'public')));


// Use JSON parser for all non-webhook routes.
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});


app.get("/", (req, res) => {
 
  res.send("index.html")
});


app.get("/config", async (req, res) => {
  const plan = await stripe.plans.retrieve(keys.PlanKey);
  res.send({
    publishableKey: keys.PublishableKey,
    plan:plan
  });
});

app.post("/create-customer", async (req, res) => {
  const customer = await stripe.customers.create({
    name: req.body.name,
    email: req.body.email
  });

  // Create a SetupIntent to set up our payment methods recurring usage
  const setupIntent = await stripe.setupIntents.create({
    payment_method_types: ["card"],
    customer: customer.id
  });

  res.send({ customer, setupIntent });
});

app.post("/subscription", async (req, res) => {
  // Set the default payment method on the customer
  await stripe.customers.update(req.body.customerId, {
    invoice_settings: {
      default_payment_method: req.body.paymentMethodId
    }
  });

  // Create the subscription
  const subscription = await stripe.subscriptions.create({
    customer: req.body.customerId,
    items: [{ plan: keys.PlanKey }],
    expand: ["latest_invoice.payment_intent"]
  });
  res.send(subscription);
});

// Webhook handler for asynchronous events.
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    const dataObject = event.data.object;

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch (event.type) {
      case "customer.created":
        console.log(`✅ Successfully created customer: ${dataObject.id}`);
        break;
      case "customer.updated":
        // console.log(dataObject);
        break;
      case "setup_intent.created":
        // console.log(dataObject);
        break;
      case "invoice.upcoming":
        // console.log(dataObject);
        break;
      case "invoice.created":
        // console.log(dataObject);
        break;
      case "invoice.finalized":
        // console.log(dataObject);
        break;
      case "invoice.payment_succeeded":
        // console.log(dataObject);
        break;
      case "invoice.payment_failed":
        // console.log(dataObject);
        break;
      case "customer.subscription.created":
        console.log(`✅ Successfully created subscription: ${dataObject.id}`);
        break;
      // ... handle other event types
      default:
      // Unexpected event type
    }
    res.sendStatus(200);
  }
);

app.listen(3000, () => console.log(`Node server listening on port ${3000}!`));
