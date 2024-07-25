require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.raw({ type: 'application/json' }));

const PORT = process.env.PORT || 4242;
const endpointSecret = process.env.STRIPE_END_POINT_SECRET || '';
const slackBotToken = process.env.SLACK_BOT_TOKEN || '';
const slackEndPoint = process.env.SLACK_API_ENDPOINT || '';

app.post('/webhook', async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
        console.log({ err: err?.message });
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log({ event });

    let info;

    // Handle the event
    switch (event.type) {
        case 'invoice.paid': {
            const invoicePaid = event?.data?.object;
            info = {
                eventName: event?.type,
                eventStatus: invoicePaid?.status,
                customerName: invoicePaid?.customer_name,
                customerEmail: invoicePaid?.customer_email,
                amountPaid: invoicePaid?.amount_paid,
                currency: invoicePaid?.currency,
                viewDetails: invoicePaid?.hosted_invoice_url
            }
            break;
        }
        case 'charge.updated': {
            const chargeUpdated = event?.data?.object;
            info = {
                eventName: event?.type,
                eventStatus: chargeUpdated?.status,
                customerName: chargeUpdated.customer || chargeUpdated.billing_details.name,
                customerEmail: chargeUpdated.billing_details.email,
                amountPaid: chargeUpdated.amount / 100,
                currency: chargeUpdated?.currency,
                viewDetails: chargeUpdated.receipt_url
            }
            break;
        }
        case 'charge.succeeded': {
            const chargeSucceeded = event?.data?.object;
            info = {
                eventName: event?.type,
                eventStatus: chargeSucceeded?.status,
                customerName: chargeSucceeded?.customer || chargeSucceeded?.billing_details?.name,
                customerEmail: chargeSucceeded?.billing_details?.email,
                amountPaid: chargeSucceeded?.amount ? chargeSucceeded.amount * 0.01 : chargeSucceeded?.amount_captured * 0.01,//for converting pennie to dollar
                currency: chargeSucceeded?.currency,
                viewDetails: chargeSucceeded?.receipt_url
            }
            break;
        }
        case 'invoice.created': {
            const chargeSucceeded = event?.data?.object;
            info = {
                eventName: event?.type,
                eventStatus: chargeSucceeded?.status,
                customerName: chargeSucceeded?.customer || chargeSucceeded?.billing_details?.name,
                customerEmail: chargeSucceeded?.billing_details?.email,
                amountPaid: chargeSucceeded?.amount_paid,
                currency: chargeSucceeded?.currency,
                viewDetails: chargeSucceeded?.receipt_url
            }
            break;
        }
        default: {
            console.log(`Unhandled event type ${event.type}`);
        }
    }

    console.log({ info });

    // Send info to Slack
    if (info) {
        const slackPayload = {
            channel: 'C079U6AMQ73',
            text: `Event Name: ${info.eventName}\nEvent Status: ${info.eventStatus}\nCustomer Name: ${info.customerName}\nCustomer Email: ${info.customerEmail}\nAmount Paid: ${info.amountPaid + ' ' + info.currency}\nView Details: ${info.viewDetails}`
        };

        try {
            const result = await axios.post(slackEndPoint, slackPayload, {
                headers: {
                    'Authorization': `Bearer ${slackBotToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Slack API response:', result?.data);
        } catch (error) {
            console.error('Error sending info to Slack:', error);
        }
    }

    return response.status(200).send('ok');
});

app.get('/test', async (request, response) => {
    return response.status(200).send('ok Updated');
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));